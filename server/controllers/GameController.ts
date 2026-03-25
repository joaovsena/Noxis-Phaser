import { randomUUID } from 'crypto';
import { PersistenceService } from '../services/PersistenceService';
import { MobService } from '../services/MobService';
import { ChatService } from '../services/ChatService';
import { PartyService, Party } from '../services/PartyService';
import { FriendService } from '../services/FriendService';
import { MapService } from '../services/MapService';
import { MovementService } from '../services/MovementService';
import { CombatService } from '../services/CombatService';
import { InventoryService } from '../services/InventoryService';
import { SkillEffectsService } from '../services/SkillEffectsService';
import { SkillService } from '../services/SkillService';
import { CombatRuntimeService } from '../services/CombatRuntimeService';
import { CombatCoreService } from '../services/CombatCoreService';
import { QuestService } from '../services/QuestService';
import { EventService } from '../services/EventService';
import { DistributedLockService } from '../services/DistributedLockService';
import { DungeonService } from '../services/DungeonService';
import { TradeService } from '../services/TradeService';
import { StorageService } from '../services/StorageService';
import { GuildService } from '../services/GuildService';
import { PetService } from '../services/PetService';
import { PlayerRuntime, GroundItem, AuthMessage, MoveMessage, PetRuntime } from '../models/types';
import { hashPassword } from '../utils/hash';
import { clamp, distance, xpRequired } from '../utils/math';
import { CURRENCY_LABELS, CurrencyName, formatWallet, normalizeWallet, parseCurrencyName, toCopperByCurrency, walletFromCopper, walletToCopper, Wallet } from '../utils/currency';
import { getMapMetadata } from '../maps/mapMetadata';
import { SKILL_CHAINS, SKILL_DEFS, SKILL_UNLOCK_LEVELS, type SkillDef } from '../content/skillCatalog';
import {
    CLASS_TEMPLATES,
    WORLD,
    DEFAULT_MAP_ID,
    DEFAULT_MAP_KEY,
    MAP_IDS,
    MAP_KEYS,
    DEFAULT_PLAYER_SPAWN_BY_MAP_KEY,
    BASE_MOVE_SPEED,
    PLAYER_HALF_SIZE,
    STATUS_IDS,
    COMBAT_LOCK_MS,
    MAP_THEMES,
    MAP_KEY_BY_CODE,
    PORTALS_BY_MAP_KEY,
    PORTAL_COOLDOWN_MS,
    composeMapInstanceId,
    INVENTORY_SIZE,
    WEAPON_TEMPLATE,
    STATUS_BY_ID,
    GROUND_ITEM_TTL_MS,
    mapCodeFromKey,
    MAP_FEATURES_BY_KEY,
    HP_POTION_TEMPLATE,
    SKILL_RESET_HOURGLASS_TEMPLATE,
    BUILTIN_ITEM_TEMPLATE_BY_ID,
    pickMapMaterialTemplateId,
    pickProgressionLootTemplate
} from '../config';
import { logEvent, logNamedEvent } from '../utils/logger';
import { perfStats } from '../utils/perfStats';

interface AuthSocket {
    send: (payload: string) => void;
    playerId?: number;
    authUserId?: string;
    authUsername?: string;
    authRole?: string;
    pendingPlayerProfiles?: any[];
}

type DebugSocket = AuthSocket & {
    readyState?: number;
};

const PRIMARY_STATS = ['str', 'int', 'dex', 'vit'] as const;
type PrimaryStat = typeof PRIMARY_STATS[number];
const LEGACY_ALLOC_MAP: Record<string, PrimaryStat> = {
    physicalAttack: 'str',
    magicAttack: 'int',
    physicalDefense: 'vit',
    magicDefense: 'dex'
};
const BASE_POINT_COST = 1;
const LUCKY_STRIKE_CHANCE = 0.15;
const AFK_THINK_MS = 260;
const AFK_VISION_RANGE = 900;
const AFK_RETURN_EPSILON = 10;
const parsedAutosaveMs = Number(process.env.AUTOSAVE_MS);
const AUTOSAVE_MS = Number.isFinite(parsedAutosaveMs)
    ? Math.max(10_000, Math.min(300_000, Math.floor(parsedAutosaveMs)))
    : 60_000;
const parsedPersistMaxRetries = Number(process.env.PERSIST_MAX_RETRIES);
const PERSIST_MAX_RETRIES = Number.isFinite(parsedPersistMaxRetries)
    ? Math.max(0, Math.min(8, Math.floor(parsedPersistMaxRetries)))
    : 3;
const parsedPersistRetryBaseMs = Number(process.env.PERSIST_RETRY_BASE_MS);
const PERSIST_RETRY_BASE_MS = Number.isFinite(parsedPersistRetryBaseMs)
    ? Math.max(25, Math.min(5_000, Math.floor(parsedPersistRetryBaseMs)))
    : 120;
const ATTRIBUTE_DRIVEN_OVERRIDE_KEYS = [
    'physicalAttack',
    'magicAttack',
    'physicalDefense',
    'magicDefense',
    'accuracy',
    'evasion',
    'criticalChance',
    'luck',
    'maxHp'
];

type WorldSnapshotCacheEntry = {
    signature: string;
    serialized: string;
};

type PublicPlayerCacheEntry = {
    signature: string;
    snapshot: any;
};

type StaticWorldSnapshotEntry = {
    type: 'world_static';
    mapCode: string;
    mapKey: string;
    mapId?: string;
    mapTheme: string;
    mapFeatures: any[];
    portals: any[];
    world: any;
    mapTiled: any;
};

export class GameController {
    private persistence: PersistenceService;
    private mobService: MobService;
    private chatService: ChatService;
    private partyService: PartyService;
    private friendService: FriendService;
    private mapService: MapService;
    private movementService: MovementService;
    private combatService: CombatService;
    private inventoryService: InventoryService;
    private skillEffectsService: SkillEffectsService;
    private skillService: SkillService;
    private combatRuntimeService: CombatRuntimeService;
    private combatCoreService: CombatCoreService;
    private questService: QuestService;
    private eventService: EventService;
    private lockService: DistributedLockService;
    private dungeonService: DungeonService;
    private tradeService: TradeService;
    private storageService: StorageService;
    private guildService: GuildService;
    private petService: PetService;
    players: Map<number, PlayerRuntime> = new Map();
    usernameToPlayerId: Map<string, number> = new Map();
    groundItems: GroundItem[] = [];
    private lastPartySyncAt = 0;
    private lastAutosaveAt = 0;
    private mobsPeacefulMode = false;
    private dirtyPlayerIds: Set<number> = new Set();
    private persistInFlightByPlayerId: Set<number> = new Set();
    private persistRevisionByPlayerId: Map<number, number> = new Map();
    private lastPersistSignatureByPlayerId: Map<number, string> = new Map();
    private autosaveInFlight = false;
    private persistStats = {
        enqueued: 0,
        saved: 0,
        skipped: 0,
        failed: 0,
        retried: 0
    };
    private worldSnapshotCache: Map<string, WorldSnapshotCacheEntry> = new Map();
    private publicPlayerCache: Map<number, PublicPlayerCacheEntry> = new Map();
    private staticWorldSnapshotCache: Map<string, StaticWorldSnapshotEntry> = new Map();

    constructor(persistence: PersistenceService, mobService: MobService, lockService: DistributedLockService) {
        this.persistence = persistence;
        this.mobService = mobService;
        this.lockService = lockService;
        this.mapService = new MapService();
        this.chatService = new ChatService(this.players, this.sendRaw.bind(this), this.broadcastRaw.bind(this));
        this.partyService = new PartyService(
            this.players,
            this.sendRaw.bind(this),
            this.broadcastRaw.bind(this),
            this.persistPlayer.bind(this),
            this.getAreaIdForPlayer.bind(this)
        );
        this.friendService = new FriendService(this.players, this.persistence, this.sendRaw.bind(this));
        this.movementService = new MovementService(this.mapService, this.getActiveSkillEffectAggregate.bind(this));
        this.combatService = new CombatService(
            this.players,
            this.mapInstanceId.bind(this),
            this.sendRaw.bind(this),
            this.partyService.hasParty.bind(this.partyService),
            this.partyService.arePlayersInSameParty.bind(this.partyService),
            this.tryPlayerAttack.bind(this)
        );
        this.inventoryService = new InventoryService(
            () => this.groundItems,
            (items) => { this.groundItems = items; },
            this.mapInstanceId.bind(this),
            this.persistPlayer.bind(this),
            this.recomputePlayerStats.bind(this),
            this.sendInventoryState.bind(this),
            this.sendStatsUpdated.bind(this),
            this.normalizeHotbarBindings.bind(this),
            this.firstFreeInventorySlot.bind(this),
            this.getSpentSkillPoints.bind(this),
            this.sendRaw.bind(this),
            this.normalizeClassId.bind(this),
            this.onItemCollected.bind(this)
        );
        this.tradeService = new TradeService(
            this.players,
            this.sendRaw.bind(this),
            this.persistPlayerCritical.bind(this),
            this.sendInventoryState.bind(this),
            this.sendStatsUpdated.bind(this),
            this.normalizeInventorySlots.bind(this),
            this.addItemToInventory.bind(this)
        );
        this.storageService = new StorageService(
            this.sendRaw.bind(this),
            this.persistPlayer.bind(this),
            this.sendInventoryState.bind(this),
            this.normalizeInventorySlots.bind(this),
            this.addItemToInventory.bind(this)
        );
        this.guildService = new GuildService(
            this.players,
            this.persistence,
            this.sendRaw.bind(this)
        );
        this.petService = new PetService(
            this.players,
            this.persistence,
            this.sendRaw.bind(this),
            this.resolveTargetMobForPet.bind(this),
            this.applyDamageToMobAndHandleDeath.bind(this),
            this.sendStatsUpdated.bind(this)
        );
        this.questService = new QuestService(
            this.sendRaw.bind(this),
            this.persistPlayer.bind(this),
            this.persistPlayerCritical.bind(this),
            this.grantXp.bind(this),
            this.grantRewardItem.bind(this),
            this.grantCurrency.bind(this),
            (player, npcId) => this.dungeonService?.getNpcUiStateForPlayer(player, npcId) || null
        );
        this.eventService = new EventService(
            this.mobService,
            this.broadcastMapInstance.bind(this),
            this.getMapWorld.bind(this),
            this.projectToWalkable.bind(this)
        );
        this.dungeonService = new DungeonService(
            this.players,
            this.mobService,
            this.sendRaw.bind(this),
            this.sendStatsUpdated.bind(this),
            this.persistPlayer.bind(this),
            this.persistPlayerCritical.bind(this),
            this.grantCurrency.bind(this),
            this.getMapWorld.bind(this),
            this.projectToWalkable.bind(this),
            this.removeGroundItemsByMapInstance.bind(this),
            this.dropTemplateAt.bind(this)
        );
        this.skillEffectsService = new SkillEffectsService(this.players, this.sendRaw.bind(this));
        this.skillService = new SkillService(
            SKILL_DEFS,
            this.sendRaw.bind(this),
            this.normalizeClassId.bind(this),
            this.getSkillLevel.bind(this),
            this.pruneExpiredSkillEffects.bind(this),
            this.applyTimedSkillEffect.bind(this),
            this.sendSkillEffect.bind(this),
            this.computeMobDamage.bind(this),
            this.applyDamageToMobAndHandleDeath.bind(this),
            this.broadcastMobHit.bind(this),
            this.applyOnHitSkillEffects.bind(this),
            this.hasActiveSkillEffect.bind(this),
            this.removeSkillEffectById.bind(this),
            this.getSkillPowerWithLevel.bind(this),
            this.sendStatsUpdated.bind(this),
            this.mapInstanceId.bind(this),
            this.mobService.getMobByIdInMap.bind(this.mobService),
            (mapId) => this.mobService.getMobsByMap(mapId),
            this.assignPathTo.bind(this),
            this.getSkillPrerequisite.bind(this),
            this.getSkillRequiredLevel.bind(this),
            this.normalizeSkillLevels.bind(this),
            this.getAvailableSkillPoints.bind(this),
            this.recomputePlayerStats.bind(this),
            this.persistPlayer.bind(this),
            (playerId) => this.players.get(playerId)
        );
        this.combatRuntimeService = new CombatRuntimeService(
            this.players,
            this.mobService,
            () => this.mobsPeacefulMode,
            this.mapInstanceId.bind(this),
            this.getMapWorld.bind(this),
            this.projectToWalkable.bind(this),
            this.recalculatePathToward.bind(this),
            this.getActiveSkillEffectAggregate.bind(this),
            this.computeHitChance.bind(this),
            this.getMobEvasion.bind(this),
            this.computeMobDamage.bind(this),
            this.applyDamageToMobAndHandleDeath.bind(this),
            this.applyOnHitSkillEffects.bind(this),
            this.sendStatsUpdated.bind(this),
            this.broadcastMobHit.bind(this),
            this.sendRaw.bind(this),
            this.persistPlayer.bind(this),
            this.syncAllPartyStates.bind(this),
            this.tryPlayerAttack.bind(this),
            this.getPvpAttackPermission.bind(this),
            this.isBlockedAt.bind(this),
            this.hasLineOfSight.bind(this),
            this.computeDamageAfterMitigation.bind(this)
        );
        this.combatCoreService = new CombatCoreService(
            this.players,
            this.mobService,
            this.getPvpAttackPermission.bind(this),
            this.sendRaw.bind(this),
            this.getActiveSkillEffectAggregate.bind(this),
            this.computeHitChance.bind(this),
            this.shouldLuckyStrike.bind(this),
            this.computeDamageAfterMitigation.bind(this),
            this.applyOnHitSkillEffects.bind(this),
            this.sendStatsUpdated.bind(this),
            this.persistPlayer.bind(this),
            this.syncAllPartyStates.bind(this),
            this.grantXp.bind(this),
            this.grantMobCurrency.bind(this),
            this.mapInstanceId.bind(this),
            this.computeLootDropPosition.bind(this),
            this.pickRandomWeaponTemplate.bind(this),
            this.dropWeaponAt.bind(this),
            this.dropHpPotionAt.bind(this),
            this.dropSkillResetHourglassAt.bind(this),
            this.hasLineOfSight.bind(this)
        );
    }

    async handleAuth(ws: any, msg: AuthMessage) {
        if (msg.type === 'auth_register') {
            await this.handleRegister(ws, msg);
            return;
        }
        if (msg.type === 'auth_login') {
            await this.handleLogin(ws, msg);
        }
    }

    private async handleRegister(ws: AuthSocket, msg: AuthMessage) {
        const username = String(msg.username || '').trim().toLowerCase();
        const password = String(msg.password || '');
        if (username.length < 3 || password.length < 3) {
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Preencha usuario e senha com ao menos 3 caracteres.' }));
            return;
        }

        const existing = await this.persistence.getUser(username);
        if (existing) {
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Usuario ja existe.' }));
            return;
        }

        await this.persistence.createUser(username, password);
        ws.send(JSON.stringify({ type: 'auth_ok', message: 'Registro concluido. Agora faca login.' }));
    }

    private async handleLogin(ws: AuthSocket, msg: AuthMessage) {
        const username = String(msg.username || '').trim().toLowerCase();
        const password = String(msg.password || '');

        try {
            const account = await this.persistence.getUser(username);

            if (!account) {
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Usuario ou senha invalidos.' }));
                return;
            }

            const incomingHash = hashPassword(password, account.salt);
            if (incomingHash !== account.passwordHash) {
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Usuario ou senha invalidos.' }));
                return;
            }

            if (this.usernameToPlayerId.has(username)) {
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Esse usuario ja esta online.' }));
                return;
            }

            ws.authUserId = String(account.id);
            ws.authUsername = username;
            const characters = Array.isArray((account as any).players) ? (account as any).players : [];
            ws.authRole = characters.some((ch: any) => ch?.role === 'adm') ? 'adm' : 'player';
            ws.pendingPlayerProfiles = characters;

            if (!characters.length) {
                ws.send(JSON.stringify({
                    type: 'auth_character_required',
                    message: 'Conta criada. Crie seu personagem para continuar.'
                }));
                logEvent('INFO', 'user_login_waiting_character', { username });
                return;
            }

            this.sendCharacterSelection(ws, characters);
            logEvent('INFO', 'user_login_character_select', { username, characters: characters.length });
        } catch (error) {
            logEvent('ERROR', 'login_error', { username, error: String(error) });
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Erro ao fazer login.' }));
        }
    }

    private sendCharacterSelection(ws: AuthSocket, profiles: any[]) {
        const slots = [null, null, null] as Array<any>;
        const maxSlots = 3;
        for (const profile of Array.isArray(profiles) ? profiles : []) {
            const slot = Number(profile?.slot);
            if (!Number.isInteger(slot) || slot < 0 || slot >= maxSlots) continue;
            slots[slot] = {
                slot,
                id: Number(profile.id),
                name: String(profile.name || ''),
                class: this.normalizeClassId(profile.class),
                gender: String(profile.gender || 'male'),
                level: Math.max(1, Number(profile.level || 1))
            };
        }
        ws.send(JSON.stringify({
            type: 'auth_character_select',
            slots,
            maxSlots
        }));
    }

    async handleCharacterCreate(ws: AuthSocket, msg: { name?: string; class?: string; gender?: string }) {
        try {
            if (!ws.authUserId || !ws.authUsername) {
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Faca login antes de criar personagem.' }));
                return;
            }

            const account = await this.persistence.getUserById(String(ws.authUserId));
            if (!account) {
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Sessao invalida. Faca login novamente.' }));
                return;
            }

            const characters = Array.isArray((account as any).players) ? (account as any).players : [];
            ws.pendingPlayerProfiles = characters;
            const maxSlots = 3;
            if (characters.length >= maxSlots) {
                ws.send(JSON.stringify({
                    type: 'auth_error',
                    message: 'Sua conta ja atingiu o limite de 3 personagens.'
                }));
                this.sendCharacterSelection(ws, characters);
                return;
            }

            const name = String(msg?.name || '').trim();
            const normalizedName = name.replace(/\s+/g, ' ');
            const selectedClass = this.normalizeClassId(msg?.class);
            const gender = String(msg?.gender || 'male').toLowerCase() === 'female' ? 'female' : 'male';
            const validName = /^[a-zA-Z0-9_ ]{3,12}$/;

            if (!validName.test(normalizedName)) {
                ws.send(JSON.stringify({
                    type: 'auth_error',
                    message: 'Nome invalido. Use 3-12 caracteres (letras, numeros, espaco ou _).'
                }));
                return;
            }

            const existingPlayer = await this.persistence.getPlayerByName(normalizedName);
            if (existingPlayer) {
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Ja existe um personagem com esse nome.' }));
                return;
            }

            const usedSlots = new Set(characters.map((ch: any) => Number(ch?.slot)).filter((v: number) => Number.isInteger(v)));
            let freeSlot = -1;
            for (let i = 0; i < maxSlots; i++) {
                if (!usedSlots.has(i)) {
                    freeSlot = i;
                    break;
                }
            }
            if (freeSlot === -1) {
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Nao ha slot livre para novo personagem.' }));
                this.sendCharacterSelection(ws, characters);
                return;
            }

            const profile = this.buildNewPlayerProfile(ws.authUsername, normalizedName, selectedClass, gender);
            const created = await this.persistence.createPlayerForUser(String(ws.authUserId), freeSlot, profile);
            const nextCharacters = [...characters, created].sort((a: any, b: any) => Number(a.slot || 0) - Number(b.slot || 0));
            ws.pendingPlayerProfiles = nextCharacters;
            ws.authRole = nextCharacters.some((ch: any) => ch?.role === 'adm') ? 'adm' : 'player';
            this.sendCharacterSelection(ws, nextCharacters);
        } catch (error) {
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Nao foi possivel criar personagem.' }));
            logEvent('ERROR', 'character_create_error', { error: String(error), userId: ws.authUserId || null });
        }
    }

    async handleCharacterEnter(ws: AuthSocket, msg: { slot?: number }) {
        try {
            if (!ws.authUserId || !ws.authUsername) {
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Faca login antes de entrar.' }));
                return;
            }

            const username = ws.authUsername;
            if (this.usernameToPlayerId.has(username)) {
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Esse usuario ja esta online.' }));
                return;
            }

            const account = await this.persistence.getUserById(String(ws.authUserId));
            const characters = Array.isArray((account as any)?.players)
                ? (account as any).players
                : (Array.isArray(ws.pendingPlayerProfiles) ? ws.pendingPlayerProfiles : []);
            if (!characters.length) {
                ws.send(JSON.stringify({ type: 'auth_character_required', message: 'Crie um personagem para continuar.' }));
                return;
            }

            const requestedSlot = Number(msg?.slot);
            const profile = Number.isInteger(requestedSlot)
                ? characters.find((ch: any) => Number(ch?.slot) === requestedSlot)
                : characters[0];
            if (!profile) {
                this.sendCharacterSelection(ws, characters);
                ws.send(JSON.stringify({ type: 'auth_error', message: 'Slot de personagem invalido.' }));
                return;
            }

            const flowStartedAt = Date.now();
            const trace = (event: string, data: Record<string, unknown> = {}) => {
                logNamedEvent('character-enter', 'INFO', event, {
                    atMs: Date.now() - flowStartedAt,
                    authUserId: ws.authUserId || null,
                    authUsername: ws.authUsername || null,
                    runtimePlayerId: ws.playerId || null,
                    ...data
                });
            };
            trace('profile_selected', {
                requestedSlot: Number.isInteger(requestedSlot) ? requestedSlot : null,
                resolvedSlot: Number(profile?.slot ?? -1),
                characters: characters.length
            });

            const runtimeStartedAt = Date.now();
            const player = this.createRuntimePlayer(username, profile);
            trace('runtime_created', {
                elapsedMs: Date.now() - runtimeStartedAt,
                runtimePlayerId: player.id,
                mapKey: player.mapKey,
                mapId: player.mapId
            });
            player.ws = ws as any;
            this.players.set(player.id, player);
            this.usernameToPlayerId.set(username, player.id);
            ws.playerId = player.id;
            await this.petService.hydratePetsForPlayer(player);
            const mapMetadata = getMapMetadata(player.mapKey);
            this.sendDebugStep(ws, 'character_enter: runtime criado');
            trace('debug_step_sent', { step: 'character_enter: runtime criado' });

            this.sendDebugPacket(ws, 1, 'auth_success');
            trace('debug_packet_sent', { order: 1, packetType: 'auth_success' });
            const hotbarBindings = this.getPlayerHotbarBindings(player);
            const authSuccessPayload = {
                type: 'auth_success',
                playerId: player.id,
                mapKey: player.mapKey,
                mapId: player.mapId,
                world: mapMetadata?.world || WORLD,
                mapTiled: mapMetadata
                    ? {
                        mapCode: mapMetadata.mapCode,
                        assetKey: mapMetadata.assetKey,
                        tmjUrl: mapMetadata.tmjUrl,
                        tilesBaseUrl: mapMetadata.tilesBaseUrl,
                        orientation: mapMetadata.orientation,
                        worldTileSize: mapMetadata.worldTileSize,
                        worldScale: mapMetadata.worldScale
                    }
                    : null,
                role: player.role,
                statusIds: STATUS_IDS,
                hotbarBindings
            };
            const hotbarStatePayload = {
                type: 'hotbar.state',
                bindings: hotbarBindings
            };
            trace('auth_payload_ready', {
                hasMapMetadata: Boolean(mapMetadata),
                hotbarBindings: Object.keys(hotbarBindings || {}).length
            });
            const worldStaticStartedAt = Date.now();
            const worldStatic = this.buildWorldStaticSnapshot(player.mapId, player.mapKey);
            trace('world_static_ready', {
                elapsedMs: Date.now() - worldStaticStartedAt,
                mapKey: worldStatic?.mapKey || player.mapKey,
                mapId: worldStatic?.mapId || player.mapId
            });
            const worldStateStartedAt = Date.now();
            const worldState = this.buildWorldSnapshot(player.mapId, player.mapKey);
            trace('world_state_ready', {
                elapsedMs: Date.now() - worldStateStartedAt,
                players: Object.keys(worldState?.players || {}).length,
                mobs: Array.isArray(worldState?.mobs) ? worldState.mobs.length : 0,
                groundItems: Array.isArray(worldState?.groundItems) ? worldState.groundItems.length : 0,
                activeEvents: Array.isArray(worldState?.activeEvents) ? worldState.activeEvents.length : 0,
                npcs: Array.isArray(worldState?.npcs) ? worldState.npcs.length : 0
            });
            const worldStateSerializedStartedAt = Date.now();
            const worldStateSerialized = JSON.stringify(worldState);
            trace('world_state_serialized', {
                elapsedMs: Date.now() - worldStateSerializedStartedAt,
                bytes: Buffer.byteLength(worldStateSerialized, 'utf8')
            });
            logEvent('INFO', 'character_enter_world_state_meta', {
                playerId: player.id,
                mapKey: player.mapKey,
                mapId: player.mapId,
                bytes: Buffer.byteLength(worldStateSerialized, 'utf8'),
                players: Object.keys(worldState?.players || {}).length,
                mobs: Array.isArray(worldState?.mobs) ? worldState.mobs.length : 0,
                groundItems: Array.isArray(worldState?.groundItems) ? worldState.groundItems.length : 0,
                activeEvents: Array.isArray(worldState?.activeEvents) ? worldState.activeEvents.length : 0,
                npcs: Array.isArray(worldState?.npcs) ? worldState.npcs.length : 0
            });
            const inventoryStartedAt = Date.now();
            const inventoryState = this.buildInventoryState(player);
            trace('inventory_state_ready', {
                elapsedMs: Date.now() - inventoryStartedAt,
                items: Array.isArray(inventoryState?.inventory) ? inventoryState.inventory.length : 0
            });

            this.sendDebugPacket(ws, 1, 'bootstrap.auth');
            trace('debug_packet_sent', { order: 1, packetType: 'bootstrap.auth' });
            const bootstrapAuthPayload = {
                type: 'bootstrap.auth',
                authSuccess: authSuccessPayload,
                hotbarState: hotbarStatePayload
            };
            const bootstrapAuthSerializeStartedAt = Date.now();
            const bootstrapAuthSerialized = JSON.stringify(bootstrapAuthPayload);
            trace('bootstrap_auth_serialized', {
                elapsedMs: Date.now() - bootstrapAuthSerializeStartedAt,
                bytes: Buffer.byteLength(bootstrapAuthSerialized, 'utf8')
            });
            const bootstrapAuthSendStartedAt = Date.now();
            player.ws?.send(bootstrapAuthSerialized);
            trace('bootstrap_auth_sent', {
                elapsedMs: Date.now() - bootstrapAuthSendStartedAt,
                bytes: Buffer.byteLength(bootstrapAuthSerialized, 'utf8')
            });
            logEvent('INFO', 'character_enter_send', { order: 1, type: 'bootstrap.auth', playerId: player.id });
            this.sendDebugStep(ws, 'character_enter: bootstrap.auth enviado');
            await this.sleep(10);

            this.sendDebugPacket(ws, 2, 'bootstrap.world');
            trace('debug_packet_sent', { order: 2, packetType: 'bootstrap.world' });
            const bootstrapWorldPayload = {
                type: 'bootstrap.world',
                worldStatic,
                worldState,
                inventoryState
            };
            const bootstrapWorldSerializeStartedAt = Date.now();
            const bootstrapWorldSerialized = JSON.stringify(bootstrapWorldPayload);
            trace('bootstrap_world_serialized', {
                elapsedMs: Date.now() - bootstrapWorldSerializeStartedAt,
                bytes: Buffer.byteLength(bootstrapWorldSerialized, 'utf8')
            });
            const bootstrapWorldSendStartedAt = Date.now();
            player.ws?.send(bootstrapWorldSerialized);
            trace('bootstrap_world_sent', {
                elapsedMs: Date.now() - bootstrapWorldSendStartedAt,
                bytes: Buffer.byteLength(bootstrapWorldSerialized, 'utf8')
            });
            logEvent('INFO', 'character_enter_send', { order: 2, type: 'bootstrap.world', playerId: player.id });
            this.sendDebugStep(ws, 'character_enter: bootstrap.world enviado');
            await this.sleep(10);

            this.sendDebugPacket(ws, 3, 'quest.state');
            this.questService.sendQuestState(player);
            logEvent('INFO', 'character_enter_send', { order: 3, type: 'quest.state', playerId: player.id });
            this.sendDebugStep(ws, 'character_enter: quest.state enviado');
            this.sendPartyStateToPlayer(player, null);
            this.sendPartyAreaList(player);
            this.sendDebugStep(ws, 'character_enter: party enviado');
            if (player.role === 'adm') {
                this.sendRaw(player.ws, {
                    type: 'admin.mobPeacefulState',
                    enabled: this.mobsPeacefulMode
                });
                this.sendDebugStep(ws, 'character_enter: admin state enviado');
            }
            await this.hydrateFriendStateForPlayer(player);
            trace('friend_state_hydrated');
            this.sendFriendState(player);
            this.sendDebugStep(ws, 'character_enter: friend.state enviado');
            await this.hydrateGuildStateForPlayer(player);
            trace('guild_state_hydrated');
            await this.sendGuildState(player);
            if (player.guildId) await this.guildService.broadcastGuildStateForGuild(String(player.guildId || ''));
            this.sendDebugStep(ws, 'character_enter: guild.state enviado');
            this.tradeService.sendState(player);
            this.storageService.sendState(player);
            await this.petService.sendState(player);
            this.sendDebugStep(ws, 'character_enter: pet.state enviado');
            ws.pendingPlayerProfiles = [];
            logEvent('INFO', 'user_login', { username, playerId: player.id });
            trace('character_enter_completed', { totalMs: Date.now() - flowStartedAt });
        } catch (error) {
            logNamedEvent('character-enter', 'ERROR', 'character_enter_failed', {
                authUserId: ws.authUserId || null,
                authUsername: ws.authUsername || null,
                runtimePlayerId: ws.playerId || null,
                error: String(error)
            });
            this.sendDebugStep(ws, `character_enter: erro ${String(error)}`);
            ws.send(JSON.stringify({ type: 'auth_error', message: 'Nao foi possivel entrar no personagem.' }));
            logEvent('ERROR', 'character_enter_error', { error: String(error), userId: ws.authUserId || null });
        }
    }

    async handleCharacterBack(ws: AuthSocket) {
        try {
            const playerId = Number(ws?.playerId || 0);
            const hasActiveRuntime = Number.isInteger(playerId) && playerId > 0 && this.players.has(playerId);
            const activePlayer = hasActiveRuntime ? this.players.get(playerId)! : null;
            const authUserId = String(ws.authUserId || activePlayer?.userId || '').trim();
            if (!authUserId) {
                this.sendRaw(ws as any, { type: 'auth_error', message: 'Sessao invalida para troca de personagem.' });
                return;
            }
            if (hasActiveRuntime) await this.handleDisconnect(playerId);
            ws.playerId = undefined;
            ws.authUserId = authUserId;
            const account = await this.persistence.getUserById(authUserId);
            const characters = Array.isArray((account as any)?.players)
                ? (account as any).players
                : [];
            ws.pendingPlayerProfiles = characters;
            ws.authRole = characters.some((ch: any) => ch?.role === 'adm') ? 'adm' : 'player';
            if (!characters.length) {
                ws.send(JSON.stringify({ type: 'auth_character_required', message: 'Crie um personagem para continuar.' }));
                return;
            }
            this.sendCharacterSelection(ws, characters);
        } catch (error) {
            this.sendRaw(ws as any, { type: 'auth_error', message: 'Nao foi possivel voltar para a selecao.' });
            logEvent('ERROR', 'character_back_error', { error: String(error), userId: ws?.authUserId || null });
        }
    }

    private buildNewPlayerProfile(username: string, name: string, selectedClass: string, gender: 'male' | 'female') {
        const baseStats = this.buildClassBaseStats(selectedClass);
        const isSena = String(username || '').toLowerCase() === 'sena' || String(name || '').toLowerCase() === 'sena';
        return {
            name,
            class: selectedClass,
            gender,
            level: 1,
            xp: 0,
            hp: Number(baseStats.initialHp || 100),
            maxHp: Number(baseStats.initialHp || 100),
            role: isSena ? 'adm' : 'player',
            statusOverrides: {},
            pvpMode: 'peace',
            allocatedStats: {
                str: 0,
                int: 0,
                dex: 0,
                vit: 0
            },
            unspentPoints: 0,
            inventory: [],
            equippedWeaponId: null,
            currencyCopper: 0,
            currencySilver: 0,
            currencyGold: 0,
            currencyDiamond: 0,
            mapKey: DEFAULT_MAP_KEY,
            mapId: DEFAULT_MAP_ID,
            posX: DEFAULT_PLAYER_SPAWN_BY_MAP_KEY[DEFAULT_MAP_KEY]?.x || 500,
            posY: DEFAULT_PLAYER_SPAWN_BY_MAP_KEY[DEFAULT_MAP_KEY]?.y || 500,
            baseStats,
            stats: {}
        };
    }

    private createRuntimePlayer(username: string, profile: any): PlayerRuntime {
        const mapKey = MAP_KEYS.includes(profile?.mapKey) ? profile.mapKey : DEFAULT_MAP_KEY;
        const mapId = MAP_IDS.includes(profile?.mapId) ? profile.mapId : DEFAULT_MAP_ID;
        const mapWorld = this.mapService.getMapWorld(mapKey);
        const defaultSpawn = DEFAULT_PLAYER_SPAWN_BY_MAP_KEY[mapKey]
            || DEFAULT_PLAYER_SPAWN_BY_MAP_KEY[DEFAULT_MAP_KEY]
            || { x: 500, y: 500 };
        const spawn = this.projectToWalkable(
            mapKey,
            clamp(Number.isFinite(Number(profile?.posX)) ? Number(profile.posX) : defaultSpawn.x, 0, mapWorld.width),
            clamp(Number.isFinite(Number(profile?.posY)) ? Number(profile.posY) : defaultSpawn.y, 0, mapWorld.height)
        );
        const parsedId = Number(profile?.id);
        const id = Number.isInteger(parsedId) ? parsedId : Math.floor(Date.now() % 2147483647);
        const normalizedClass = this.normalizeClassId(profile?.class);
        const baseStats = this.buildClassBaseStats(normalizedClass, profile?.baseStats);
        const maxHp = Number.isFinite(Number(profile?.maxHp)) ? Number(profile.maxHp) : Number(baseStats.initialHp || 100);
        const allocatedStats = this.normalizeAllocatedStats(profile.allocatedStats);
        const unspentRaw = Number(profile.unspentPoints);
        const unspentPoints = Number.isInteger(unspentRaw) && unspentRaw > 0 ? unspentRaw : 0;
        const isSena = String(username || '').toLowerCase() === 'sena' || String(profile?.name || '').toLowerCase() === 'sena';
        const runtime: PlayerRuntime = {
            ...profile,
            id,
            ws: null,
            username,
            class: normalizedClass,
            baseStats,
            role: isSena ? 'adm' : profile?.role === 'adm' ? 'adm' : 'player',
            pvpMode: profile?.pvpMode === 'evil' ? 'evil' : 'peace',
            allocatedStats,
            unspentPoints,
            inventory: this.normalizeInventorySlots(
                Array.isArray(profile.inventory) ? profile.inventory : [],
                profile?.equippedWeaponId ? String(profile.equippedWeaponId) : null
            ),
            wallet: normalizeWallet({
                copper: Number(profile?.wallet?.copper ?? profile?.currencyCopper ?? 0),
                silver: Number(profile?.wallet?.silver ?? profile?.currencySilver ?? 0),
                gold: Number(profile?.wallet?.gold ?? profile?.currencyGold ?? 0),
                diamond: Number(profile?.wallet?.diamond ?? profile?.currencyDiamond ?? 0)
            }),
            persistenceVersion: Number.isFinite(Number(profile?.stateVersion)) ? Number(profile.stateVersion) : 0,
            mapKey,
            mapId,
            x: spawn.x,
            y: spawn.y,
            targetX: spawn.x,
            targetY: spawn.y,
            autoAttackActive: false,
            attackTargetId: null,
            lastAttackAt: 0,
            lastCombatAt: 0,
            lastPortalAt: 0,
            pvpAutoAttackActive: false,
            attackTargetPlayerId: null,
            dead: false,
            deathX: spawn.x,
            deathY: spawn.y,
            partyId: null,
            guildId: null,
            guildName: null,
            guildRank: null,
            skillCooldowns: {},
            skillLevels: this.normalizeSkillLevels(profile?.statusOverrides?.__skillLevels || {}),
            activeSkillEffects: [],
            movePath: [],
            rawMovePath: [],
            nextPathfindAt: 0,
            pathDestinationX: spawn.x,
            pathDestinationY: spawn.y,
            lastMoveCheckX: spawn.x,
            lastMoveCheckY: spawn.y,
            lastMoveProgressAt: Date.now(),
            pendingSkillCast: null,
            afkActive: false,
            afkOriginX: spawn.x,
            afkOriginY: spawn.y,
            afkOriginMapKey: mapKey,
            afkOriginMapId: mapId,
            afkNextThinkAt: 0,
            petOwnerships: [],
            activePetOwnershipId: null,
            petBehavior: 'assist'
        };
        this.recomputePlayerStats(runtime);
        return runtime;
    }

    handleMove(player: PlayerRuntime, msg: MoveMessage) {
        if (player.afkActive) {
            this.setAfkState(player, false);
        }
        player.pendingSkillCast = null;
        this.movementService.handleMove(player, msg);
    }

    handleTargetMob(player: PlayerRuntime, msg: any) {
        if (player.dead || player.hp <= 0) return;
        const mobId = String(msg.mobId || '');
        const mob = this.mobService.getMobs().find((m) => m.id === mobId && m.mapId === this.mapInstanceId(player.mapKey, player.mapId));
        if (!mob) {
            player.autoAttackActive = false;
            player.attackTargetId = null;
            player.movePath = [];
            player.rawMovePath = [];
            player.pathDestinationX = player.x;
            player.pathDestinationY = player.y;
            return;
        }
        player.pvpAutoAttackActive = false;
        player.attackTargetPlayerId = null;
        player.autoAttackActive = true;
        player.attackTargetId = mob.id;
    }

    handleChat(player: PlayerRuntime, msg: any) {
        this.chatService.handleChat(player, msg);
    }

    handleSwitchInstance(player: PlayerRuntime, msg: any) {
        if (player.dead || player.hp <= 0) return;
        if (!MAP_IDS.includes(player.mapId as any)) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Voce esta em uma dungeon. Aguarde o retorno automatico.' });
            return;
        }
        const target = MAP_IDS.includes(msg.mapId) ? msg.mapId : null;
        if (!target || target === player.mapId) return;
        const inCombat = Date.now() - (player.lastCombatAt || 0) < COMBAT_LOCK_MS;
        if (inCombat) {
            player.ws.send(JSON.stringify({ type: 'system_message', text: 'Voce esta em combate. Aguarde 10s sem atacar.' }));
            return;
        }

        // Regra pedida: ao trocar E1 <-> E2, mantem a mesma coordenada X,Y.
        player.mapId = target;
        player.targetX = player.x;
        player.targetY = player.y;
        player.movePath = [];
        player.rawMovePath = [];
        player.pathDestinationX = player.x;
        player.pathDestinationY = player.y;
        player.attackTargetId = null;
        player.autoAttackActive = false;
        this.setAfkState(player, false);
        player.ws.send(JSON.stringify({ type: 'system_message', text: `Instancia alterada para ${target}.` }));
        this.sendPartyAreaList(player);
    }

    handlePickupItem(player: PlayerRuntime, msg: any) {
        this.inventoryService.handlePickupItem(player, msg);
    }

    handleHotbarSet(player: PlayerRuntime, msg: any) {
        this.inventoryService.handleHotbarSet(player, msg);
    }

    handleEquipItem(player: PlayerRuntime, msg: any) {
        this.inventoryService.handleEquipItem(player, msg);
    }

    handleInventoryMove(player: PlayerRuntime, msg: any) {
        this.inventoryService.handleInventoryMove(player, msg);
    }

    handleInventorySort(player: PlayerRuntime) {
        this.inventoryService.handleInventorySort(player);
    }

    handleInventoryDelete(player: PlayerRuntime, msg: any) {
        this.inventoryService.handleInventoryDelete(player, msg);
    }

    handleInventorySplit(player: PlayerRuntime, msg: any) {
        this.inventoryService.handleInventorySplit(player, msg);
    }

    handleInventoryUnequipToSlot(player: PlayerRuntime, msg: any) {
        this.inventoryService.handleInventoryUnequipToSlot(player, msg);
    }

    handleItemUse(player: PlayerRuntime, msg: any) {
        this.inventoryService.handleItemUse(player, msg);
    }

    async handleAdminCommand(player: PlayerRuntime, msg: any) {
        if (player.role !== 'adm') return;
        const raw = String(msg.command || '').trim();
        const parts = raw.split(/\s+/);
        const command = String(parts[0] || '').toLowerCase();
        if (!command) {
            this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: 'Comando vazio.' });
            return;
        }

        if (command === 'setstatus') {
            if (parts.length < 3) {
                this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: 'Uso: setstatus {id} {quantia} {jogador?}' });
                return;
            }
            const statusId = String(parts[1]);
            const key = STATUS_BY_ID[statusId];
            const value = Number(parts[2]);
            const target = this.resolveAdminTarget(player, parts[3]);
            if (!key || !Number.isFinite(value) || !target) {
                this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: 'Comando invalido.' });
                return;
            }

            target.statusOverrides = target.statusOverrides || {};
            const leveled = this.computeDerivedStats(target);
            const hasOverride = Object.prototype.hasOwnProperty.call(target.statusOverrides, key);
            const currentOverride = hasOverride
                ? Number(target.statusOverrides[key])
                : Number((leveled as any)[key]);
            const safeCurrentOverride = Number.isFinite(currentOverride) ? currentOverride : 0;
            target.statusOverrides[key] = safeCurrentOverride + value;
            this.recomputePlayerStats(target);
            this.persistPlayer(target);
            this.sendStatsUpdated(target);
            const total = Number(target.stats?.[key]);
            const safeTotal = Number.isFinite(total) ? total : target.statusOverrides[key];
            this.sendRaw(player.ws, {
                type: 'admin_result',
                ok: true,
                message: `Status ${key} de ${target.name}: ${value >= 0 ? '+' : ''}${value} aplicado. Total: ${safeTotal}`
            });
            return;
        }

        if (command === 'setrolelevel') {
            if (parts.length < 2) {
                this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: 'Uso: setrolelevel {nivel} {jogador?}' });
                return;
            }
            const level = Number(parts[1]);
            const target = this.resolveAdminTarget(player, parts[2]);
            if (!target || !Number.isInteger(level) || level < 1) {
                this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: 'Nivel/jogador invalido.' });
                return;
            }
            target.level = level;
            target.xp = 0;
            this.recomputePlayerStats(target);
            this.persistPlayer(target);
            this.sendStatsUpdated(target);
            this.sendRaw(player.ws, {
                type: 'admin_result',
                ok: true,
                message: `${target.name} agora esta no nivel ${level} com ${target.unspentPoints} ponto(s) disponiveis.`
            });
            return;
        }

        if (command === 'gotomap') {
            if (parts.length < 2) {
                this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: 'Uso: gotomap {codigodomapa} {jogador?}' });
                return;
            }
            const targetMapCode = String(parts[1] || '').toUpperCase();
            const mapKey = MAP_KEY_BY_CODE[targetMapCode] || null;
            const target = this.resolveAdminTarget(player, parts[2]);
            if (!target || !mapKey) {
                this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: 'Mapa/jogador invalido. Use A1, A2 ou A3.' });
                return;
            }
            target.mapKey = mapKey;
            const targetWorld = this.mapService.getMapWorld(target.mapKey);
            const projected = this.projectToWalkable(
                target.mapKey,
                clamp(target.x, 0, targetWorld.width),
                clamp(target.y, 0, targetWorld.height)
            );
            target.x = projected.x;
            target.y = projected.y;
            target.targetX = target.x;
            target.targetY = target.y;
            target.movePath = [];
            target.rawMovePath = [];
            target.pathDestinationX = target.x;
            target.pathDestinationY = target.y;
            target.attackTargetId = null;
            target.autoAttackActive = false;
            target.attackTargetPlayerId = null;
            target.pvpAutoAttackActive = false;
            this.persistPlayer(target);
            this.sendPartyAreaList(target);
            this.sendRaw(target.ws, { type: 'system_message', text: `ADM: voce foi para o mapa ${targetMapCode} (instancia ${target.mapId}).` });
            this.sendRaw(player.ws, { type: 'admin_result', ok: true, message: `${target.name} enviado para ${targetMapCode} mantendo instancia ${target.mapId}.` });
            return;
        }

        if (command === 'teleport') {
            const target = this.resolveAdminTarget(player, parts[1]);
            if (!target) {
                this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: 'Jogador nao encontrado.' });
                return;
            }
            player.mapKey = target.mapKey;
            player.mapId = target.mapId;
            const playerWorld = this.mapService.getMapWorld(player.mapKey);
            const projected = this.projectToWalkable(
                player.mapKey,
                clamp(target.x, 0, playerWorld.width),
                clamp(target.y, 0, playerWorld.height)
            );
            player.x = projected.x;
            player.y = projected.y;
            player.targetX = player.x;
            player.targetY = player.y;
            player.movePath = [];
            player.rawMovePath = [];
            player.pathDestinationX = player.x;
            player.pathDestinationY = player.y;
            player.attackTargetId = null;
            player.autoAttackActive = false;
            player.attackTargetPlayerId = null;
            player.pvpAutoAttackActive = false;
            this.persistPlayer(player);
            this.sendPartyAreaList(player);
            this.sendRaw(player.ws, { type: 'admin_result', ok: true, message: `Teleportado para ${target.name}.` });
            return;
        }

        if (command === 'summonplayer') {
            const target = this.resolveAdminTarget(player, parts[1]);
            if (!target) {
                this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: 'Jogador nao encontrado.' });
                return;
            }
            target.mapKey = player.mapKey;
            target.mapId = player.mapId;
            const summonWorld = this.mapService.getMapWorld(target.mapKey);
            const projected = this.projectToWalkable(
                target.mapKey,
                clamp(player.x, 0, summonWorld.width),
                clamp(player.y, 0, summonWorld.height)
            );
            target.x = projected.x;
            target.y = projected.y;
            target.targetX = target.x;
            target.targetY = target.y;
            target.movePath = [];
            target.rawMovePath = [];
            target.pathDestinationX = target.x;
            target.pathDestinationY = target.y;
            target.attackTargetId = null;
            target.autoAttackActive = false;
            target.attackTargetPlayerId = null;
            target.pvpAutoAttackActive = false;
            this.persistPlayer(target);
            this.sendPartyAreaList(target);
            this.sendRaw(target.ws, { type: 'system_message', text: `ADM: voce foi invocado por ${player.name}.` });
            this.sendRaw(player.ws, { type: 'admin_result', ok: true, message: `${target.name} invocado ate voce.` });
            return;
        }

        if (command === 'additem') {
            if (parts.length < 3) {
                this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: 'Uso: additem {iddoitem} {quantia} {jogador?}' });
                return;
            }
            const itemId = String(parts[1]);
            const quantity = Number(parts[2]);
            const target = this.resolveAdminTarget(player, parts[3]);
            if (!target || !Number.isInteger(quantity) || quantity <= 0) {
                this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: 'Item/quantia/jogador invalido.' });
                return;
            }
            const template = (await this.persistence.getItemById(itemId)) || (BUILTIN_ITEM_TEMPLATE_BY_ID[itemId] ?? null);
            if (!template) {
                this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: `Item ${itemId} nao encontrado.` });
                return;
            }
            const templateAny = template as any;

            let added = 0;
            for (let i = 0; i < quantity; i++) {
                const slot = this.firstFreeInventorySlot(target.inventory);
                if (slot === -1) break;
                target.inventory.push({
                    id: randomUUID(),
                    templateId: String(templateAny.id || templateAny.type || itemId),
                    type: String(templateAny.type || 'misc'),
                    name: String(templateAny.name || itemId),
                    rarity: String(templateAny.rarity || 'branco'),
                    quality: String(templateAny.quality || 'normal'),
                    spriteId: templateAny.spriteId ? String(templateAny.spriteId) : undefined,
                    iconUrl: templateAny.iconUrl ? String(templateAny.iconUrl) : undefined,
                    slot: String(templateAny.slot || ''),
                    bonuses: templateAny.bonuses || {},
                    bonusPercents: templateAny.bonusPercents || {},
                    quantity: 1,
                    stackable: Boolean(templateAny.stackable),
                    maxStack: Number(templateAny.stackable ? 250 : (templateAny.maxStack || 1)),
                    healPercent: Number.isFinite(Number(templateAny.healPercent)) ? Number(templateAny.healPercent) : undefined,
                    requiredClass: templateAny.requiredClass ? String(templateAny.requiredClass) : null,
                    requiredLevel: Number.isFinite(Number(templateAny.requiredLevel)) ? Number(templateAny.requiredLevel) : null,
                    bindingType: templateAny.bindingType ? String(templateAny.bindingType) : 'unbound',
                    slotIndex: slot
                });
                added += 1;
            }
            target.inventory = this.normalizeInventorySlots(target.inventory, target.equippedWeaponId || null);
            this.persistPlayerCritical(target, 'admin_additem');
            this.sendInventoryState(target);
            this.sendRaw(player.ws, {
                type: 'admin_result',
                ok: true,
                message: `${added}/${quantity}x ${template.name} adicionado(s) para ${target.name}.`
            });
            return;
        }

        if (command === 'settag') {
            if (parts.length < 2) {
                this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: 'Uso: settag {player|adm} {jogador?}' });
                return;
            }
            const rawTag = String(parts[1] || '').toLowerCase();
            const tag = rawTag === 'players' ? 'player' : rawTag;
            const target = this.resolveAdminTarget(player, parts[2]);
            if (!target || (tag !== 'player' && tag !== 'adm')) {
                this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: 'Tag/jogador invalido. Use player ou adm.' });
                return;
            }
            target.role = tag;
            this.persistPlayer(target);
            this.sendRaw(target.ws, { type: 'system_message', text: `Sua tag foi alterada para ${tag}.` });
            this.sendRaw(player.ws, { type: 'admin_result', ok: true, message: `${target.name} agora possui tag ${tag}.` });
            return;
        }

        if (command === 'addgold') {
            if (parts.length < 3) {
                this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: 'Uso: addgold {quantia} {moeda} {jogador?}' });
                return;
            }
            const amount = Number(parts[1]);
            const currency = parseCurrencyName(parts[2]);
            const target = this.resolveAdminTarget(player, parts[3]);
            if (!target || !Number.isInteger(amount) || amount <= 0 || !currency) {
                this.sendRaw(player.ws, { type: 'admin_result', ok: false, message: 'Comando invalido. Moeda: cobre, prata, ouro ou diamante.' });
                return;
            }
            const addCopper = toCopperByCurrency(amount, currency);
            this.addWalletCopper(target, addCopper, 'comando addgold');
            this.persistPlayerCritical(target, 'admin_addgold');
            this.sendInventoryState(target);
            this.sendStatsUpdated(target);
            this.sendRaw(player.ws, {
                type: 'admin_result',
                ok: true,
                message: `${amount} ${CURRENCY_LABELS[currency]} adicionado(s) para ${target.name}. Saldo: ${formatWallet(target.wallet)}.`
            });
            return;
        }

        if (command === 'dungeon.debug') {
            const snapshot = this.dungeonService.getDebugSnapshot();
            if (!snapshot.length) {
                this.sendRaw(player.ws, { type: 'admin_result', ok: true, message: 'Dungeon Debug: nenhuma instancia ativa.' });
                this.sendRaw(player.ws, { type: 'system_message', text: 'Dungeon Debug: nenhuma instancia ativa.' });
                return;
            }
            const lines: string[] = [];
            for (const instance of snapshot) {
                const bossText = instance.boss
                    ? `boss=${instance.boss.hp}/${instance.boss.maxHp}`
                    : 'boss=none';
                const membersText = instance.members
                    .map((m) => `${m.name}[${m.connected ? 'on' : 'off'}|${m.onlineInside ? 'in' : 'out'}|${m.dead ? 'dead' : `hp:${m.hp}`}|${m.ready ? 'ready' : 'wait'}]`)
                    .join(', ');
                lines.push(
                    `${instance.id} ${instance.templateId} state=${instance.state} lock=${instance.locked ? 'on' : 'off'} `
                    + `door=${instance.doorLocked ? 'on' : 'off'} mobs=${instance.mobCount} ${bossText} `
                    + `map=${instance.mapKey}/${instance.mapId} members={${membersText}}`
                );
            }
            const message = `Dungeon Debug (${snapshot.length}): ${lines.join(' || ')}`;
            this.sendRaw(player.ws, { type: 'admin_result', ok: true, message });
            this.sendRaw(player.ws, { type: 'system_message', text: message });
            return;
        }

        this.sendRaw(player.ws, {
            type: 'admin_result',
            ok: false,
            message: 'Comando invalido. Use: setstatus, setrolelevel, gotomap, teleport, summonplayer, additem, addgold, settag, dungeon.debug.'
        });
    }

    handlePartyCreate(player: PlayerRuntime) {
        this.partyService.handlePartyCreate(player);
    }

    handlePartyInvite(player: PlayerRuntime, msg: any) {
        this.partyService.handlePartyInvite(player, msg);
    }

    handlePartyAcceptInvite(player: PlayerRuntime, msg: any) {
        this.partyService.handlePartyAcceptInvite(player, msg);
    }

    handlePartyDeclineInvite(player: PlayerRuntime, msg: any) {
        this.partyService.handlePartyDeclineInvite(player, msg);
    }

    handlePartyLeave(player: PlayerRuntime) {
        this.dungeonService.leaveDungeon(player, 'Voce saiu do grupo e deixou a dungeon.');
        this.partyService.handlePartyLeave(player);
    }

    handlePartyKick(player: PlayerRuntime, msg: any) {
        this.partyService.handlePartyKick(player, msg);
    }

    handlePartyPromote(player: PlayerRuntime, msg: any) {
        this.partyService.handlePartyPromote(player, msg);
    }

    handlePartyRequestAreaParties(player: PlayerRuntime) {
        this.partyService.handlePartyRequestAreaParties(player);
    }

    handlePartyRequestJoin(player: PlayerRuntime, msg: any) {
        this.partyService.handlePartyRequestJoin(player, msg);
    }

    handlePartyApproveJoin(player: PlayerRuntime, msg: any) {
        this.partyService.handlePartyApproveJoin(player, msg);
    }

    handlePartyWaypointPing(player: PlayerRuntime, msg: any) {
        this.partyService.handlePartyWaypointPing(player, msg);
    }

    async handleFriendRequest(player: PlayerRuntime, msg: any) {
        await this.friendService.handleFriendRequest(player, msg);
    }

    async handleFriendAccept(player: PlayerRuntime, msg: any) {
        await this.friendService.handleFriendAccept(player, msg);
    }

    async handleFriendDecline(player: PlayerRuntime, msg: any) {
        await this.friendService.handleFriendDecline(player, msg);
    }

    async handleFriendRemove(player: PlayerRuntime, msg: any) {
        await this.friendService.handleFriendRemove(player, msg);
    }

    handleFriendList(player: PlayerRuntime) {
        this.friendService.handleFriendList(player);
    }

    handleTradeRequest(player: PlayerRuntime, msg: any) {
        this.tradeService.handleTradeRequest(player, msg);
    }

    handleTradeRespond(player: PlayerRuntime, msg: any) {
        this.tradeService.handleTradeRespond(player, msg);
    }

    handleTradeSetItem(player: PlayerRuntime, msg: any) {
        this.tradeService.handleTradeSetItem(player, msg);
    }

    handleTradeRemoveItem(player: PlayerRuntime, msg: any) {
        this.tradeService.handleTradeRemoveItem(player, msg);
    }

    handleTradeSetCurrency(player: PlayerRuntime, msg: any) {
        this.tradeService.handleTradeSetCurrency(player, msg);
    }

    handleTradeLock(player: PlayerRuntime) {
        this.tradeService.handleTradeLock(player);
    }

    handleTradeConfirm(player: PlayerRuntime) {
        this.tradeService.handleTradeConfirm(player);
    }

    handleTradeCancel(player: PlayerRuntime) {
        this.tradeService.handleTradeCancel(player);
    }

    handleStorageOpen(player: PlayerRuntime, msg: any) {
        this.storageService.handleOpenStorage(player, msg?.npcId);
    }

    handleStorageClose(player: PlayerRuntime) {
        this.storageService.handleCloseStorage(player);
    }

    handleStorageDeposit(player: PlayerRuntime, msg: any) {
        this.storageService.handleDeposit(player, msg);
    }

    handleStorageWithdraw(player: PlayerRuntime, msg: any) {
        this.storageService.handleWithdraw(player, msg);
    }

    async handlePetSummon(player: PlayerRuntime, msg: any) {
        await this.petService.handleSummon(player, msg);
    }

    async handlePetUnsummon(player: PlayerRuntime) {
        await this.petService.handleUnsummon(player);
    }

    async handlePetFeed(player: PlayerRuntime, msg: any) {
        await this.petService.handleFeed(player, msg);
    }

    async handlePetRename(player: PlayerRuntime, msg: any) {
        await this.petService.handleRename(player, msg);
    }

    async handlePetSetBehavior(player: PlayerRuntime, msg: any) {
        await this.petService.handleSetBehavior(player, msg);
    }

    async handlePetState(player: PlayerRuntime) {
        await this.petService.sendState(player);
    }

    async handleGuildCreate(player: PlayerRuntime, msg: any) {
        await this.guildService.handleGuildCreate(player, msg);
    }

    async handleGuildInvite(player: PlayerRuntime, msg: any) {
        await this.guildService.handleGuildInvite(player, msg);
    }

    async handleGuildRespondInvite(player: PlayerRuntime, msg: any) {
        await this.guildService.handleGuildRespondInvite(player, msg);
    }

    async handleGuildLeave(player: PlayerRuntime) {
        await this.guildService.handleGuildLeave(player);
    }

    async handleGuildKick(player: PlayerRuntime, msg: any) {
        await this.guildService.handleGuildKick(player, msg);
    }

    async handleGuildSetRank(player: PlayerRuntime, msg: any) {
        await this.guildService.handleGuildSetRank(player, msg);
    }

    async handleGuildState(player: PlayerRuntime) {
        await this.guildService.sendGuildState(player);
    }

    handleAdminSetMobPeaceful(player: PlayerRuntime, msg: any) {
        if (player.role !== 'adm') return;
        this.mobsPeacefulMode = Boolean(msg?.enabled);
        for (const mob of this.mobService.getMobs()) {
            mob.targetPlayerId = null;
            mob.lastAttackAt = 0;
        }
        for (const receiver of this.players.values()) {
            if (receiver.role !== 'adm') continue;
            this.sendRaw(receiver.ws, {
                type: 'admin.mobPeacefulState',
                enabled: this.mobsPeacefulMode
            });
        }
        this.sendRaw(player.ws, {
            type: 'system_message',
            text: this.mobsPeacefulMode ? 'Modo pacifico de mobs ativado.' : 'Modo pacifico de mobs desativado.'
        });
    }

    handleSetPvpMode(player: PlayerRuntime, msg: any) {
        const rawMode = String(msg?.mode || 'peace');
        const mode = rawMode === 'evil' ? 'evil' : rawMode === 'group' ? 'group' : 'peace';
        if (mode === 'group' && !this.partyService.hasParty(player.partyId)) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Modo Grupo exige estar em grupo.' });
            return;
        }
        if (player.pvpMode === mode) return;
        player.pvpMode = mode;
        if (mode === 'peace') {
            player.pvpAutoAttackActive = false;
            player.attackTargetPlayerId = null;
        }
        this.persistPlayer(player);
        this.broadcastRaw({
            type: 'player.pvpModeUpdated',
            playerId: player.id,
            mode
        });
    }

    handleCombatTargetPlayer(player: PlayerRuntime, msg: any) {
        this.combatService.handleCombatTargetPlayer(player, msg);
    }

    handleCombatClearTarget(player: PlayerRuntime) {
        this.combatService.handleCombatClearTarget(player);
    }

    handleCombatAttack(player: PlayerRuntime, msg: any) {
        this.combatService.handleCombatAttack(player, msg);
    }

    handlePlayerRevive(player: PlayerRuntime) {
        if (!player.dead && player.hp > 0) return;
        player.dead = false;
        player.hp = player.maxHp;
        const reviveX = Number.isFinite(Number(player.deathX)) ? Number(player.deathX) : player.x;
        const reviveY = Number.isFinite(Number(player.deathY)) ? Number(player.deathY) : player.y;
        const mapWorld = this.mapService.getMapWorld(player.mapKey);
        const projected = this.projectToWalkable(
            player.mapKey,
            clamp(reviveX, 0, mapWorld.width),
            clamp(reviveY, 0, mapWorld.height)
        );
        player.x = projected.x;
        player.y = projected.y;
        player.targetX = player.x;
        player.targetY = player.y;
        player.movePath = [];
        player.rawMovePath = [];
        player.pathDestinationX = player.x;
        player.pathDestinationY = player.y;
        player.autoAttackActive = false;
        player.attackTargetId = null;
        player.pvpAutoAttackActive = false;
        player.attackTargetPlayerId = null;
        this.setAfkState(player, false);
        this.persistPlayer(player);
        this.sendRaw(player.ws, { type: 'system_message', text: 'Voce reviveu no local da morte.' });
    }

    handleSkillCast(player: PlayerRuntime, msg: any) {
        this.skillService.handleSkillCast(player, msg);
    }

    handleSkillLearn(player: PlayerRuntime, msg: any) {
        this.skillService.handleSkillLearn(player, msg);
    }

    handleNpcInteract(player: PlayerRuntime, msg: any) {
        const npcId = String(msg?.npcId || '');
        const npc = this.questService.getNpcById(npcId);
        if (npc?.role === 'chest_keeper') {
            this.storageService.handleOpenStorage(player, npcId);
            return;
        }
        this.questService.handleNpcInteract(player, msg);
    }

    handleNpcBuy(player: PlayerRuntime, msg: any) {
        const npcId = String(msg?.npcId || '');
        const offerId = String(msg?.offerId || '');
        const quantity = Math.max(1, Math.floor(Number(msg?.quantity || 1)));
        if (!npcId || !offerId || quantity <= 0) return;

        const npc = this.questService.getNpcById(npcId);
        if (!npc) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'NPC nao encontrado.' });
            return;
        }
        if (String(npc.mapKey || '') !== String(player.mapKey || '') || String(npc.mapId || '') !== String(player.mapId || '')) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Esse NPC nao esta neste mapa.' });
            return;
        }
        const range = Math.max(80, Number(npc.interactRange || 170));
        if (distance(player, npc as any) > range) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Aproxime-se do NPC para comprar.' });
            return;
        }

        const offer = this.questService.getShopOffers(npcId).find((entry: any) => String(entry.offerId || '') === offerId);
        if (!offer) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Oferta nao encontrada.' });
            return;
        }
        const template = BUILTIN_ITEM_TEMPLATE_BY_ID[String(offer.templateId || '')];
        if (!template) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Item da oferta nao encontrado.' });
            return;
        }
        const itemQuantity = Math.max(1, Number(offer.quantity || 1));
        const totalToGrant = itemQuantity * quantity;
        const priceCopper = this.computeTemplatePriceCopper(template) * quantity;
        if (priceCopper <= 0) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Oferta com preco invalido.' });
            return;
        }
        if (!this.trySpendCopper(player, priceCopper)) {
            this.sendRaw(player.ws, { type: 'system_message', text: `Moedas insuficientes. Saldo: ${formatWallet(player.wallet)}.` });
            return;
        }

        const baseItem = {
            ...template,
            id: randomUUID()
        };
        const remaining = this.addItemToInventory(player, baseItem, totalToGrant);
        const granted = Math.max(0, totalToGrant - remaining);
        if (granted <= 0) {
            this.addWalletCopper(player, priceCopper, 'estorno');
            this.sendRaw(player.ws, { type: 'system_message', text: 'Inventario cheio. Compra cancelada.' });
            return;
        }

        if (remaining > 0) {
            const unitCopper = Math.max(1, Math.floor(priceCopper / totalToGrant));
            const refundCopper = unitCopper * remaining;
            this.addWalletCopper(player, refundCopper, 'estorno');
            this.sendRaw(player.ws, {
                type: 'system_message',
                text: `Inventario cheio: recebido ${granted}/${totalToGrant}. ${refundCopper} cobre devolvido.`
            });
        } else {
            this.sendRaw(player.ws, {
                type: 'system_message',
                text: `Compra concluida: ${granted}x ${template.name}.`
            });
        }

        this.persistPlayerCritical(player, 'npc_buy');
        this.sendInventoryState(player);
        this.sendStatsUpdated(player);
    }

    handleSellItem(player: PlayerRuntime, msg: any) {
        const npcId = String(msg?.npcId || msg?.shopNpcId || '');
        const itemId = String(msg?.itemId || '');
        const slotIndex = Number(msg?.slotIndex);
        if (!npcId) return;
        const npc = this.questService.getNpcById(npcId);
        if (!npc) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'NPC nao encontrado.' });
            return;
        }
        if (String(npc.mapKey || '') !== String(player.mapKey || '') || String(npc.mapId || '') !== String(player.mapId || '')) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Esse NPC nao esta neste mapa.' });
            return;
        }
        const range = Math.max(80, Number(npc.interactRange || 170));
        if (distance(player, npc as any) > range) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Aproxime-se do NPC para vender.' });
            return;
        }
        if (!this.questService.getShopOffers(npcId).length) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Esse NPC nao compra itens.' });
            return;
        }
        const index = itemId
            ? player.inventory.findIndex((it: any) => String(it?.id || '') === itemId)
            : (Number.isInteger(slotIndex) ? player.inventory.findIndex((it: any) => Number(it?.slotIndex) === slotIndex) : -1);
        if (index === -1) return;
        const item = player.inventory[index];
        if (!this.inventoryService.isItemSellable(item)) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Esse item nao pode ser vendido.' });
            return;
        }
        const sellCopper = this.computeSellPriceCopper(item);
        if (sellCopper <= 0) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Esse item nao possui valor de venda.' });
            return;
        }
        player.inventory.splice(index, 1);
        if (player.equippedWeaponId === String(item?.id || '')) player.equippedWeaponId = null;
        this.addWalletCopper(player, sellCopper, 'Venda');
        player.inventory = this.inventoryService.normalizeInventorySlots(player.inventory, player.equippedWeaponId);
        this.recomputePlayerStats(player);
        this.persistPlayerCritical(player, 'npc_sell');
        this.sendInventoryState(player);
        this.sendStatsUpdated(player);
    }

    handleQuestAccept(player: PlayerRuntime, msg: any) {
        this.questService.handleQuestAccept(player, msg);
    }

    handleQuestComplete(player: PlayerRuntime, msg: any) {
        this.questService.handleQuestComplete(player, msg);
    }

    handleDungeonEnter(player: PlayerRuntime, msg: any) {
        const npcId = String(msg?.npcId || '');
        const mode = String(msg?.mode || '').toLowerCase();
        if (!npcId) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'NPC de entrada invalido.' });
            return;
        }
        const npc = this.questService.getNpcById(npcId);
        if (!npc) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'NPC nao encontrado.' });
            return;
        }
        const result = this.dungeonService.tryEnterByNpc(player, npc, mode);
        if (!result.ok) {
            this.sendRaw(player.ws, { type: 'system_message', text: String(result.message || 'Nao foi possivel entrar na dungeon.') });
            return;
        }
        this.sendPartyAreaList(player);
        this.sendRaw(player.ws, { type: 'system_message', text: 'Entrada na dungeon confirmada.' });
    }

    handleDungeonReady(player: PlayerRuntime, msg: any) {
        const requestId = String(msg?.requestId || '');
        const accept = Boolean(msg?.accept);
        if (!requestId) return;
        this.dungeonService.handleReadyResponse(player, requestId, accept);
    }

    handleDungeonLeave(player: PlayerRuntime) {
        const ok = this.dungeonService.leaveDungeon(player, 'Voce deixou a dungeon.');
        if (!ok) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Voce nao esta em uma dungeon instanciada.' });
            return;
        }
        this.sendPartyAreaList(player);
    }

    handleToggleAfk(player: PlayerRuntime) {
        if (player.dead || player.hp <= 0) return;
        this.setAfkState(player, !Boolean(player.afkActive));
    }

    handleStatsAllocate(player: PlayerRuntime, msg: any) {
        const allocation = msg && typeof msg.allocation === 'object' ? msg.allocation : {};
        const sanitized: Record<PrimaryStat, number> = {
            str: 0,
            int: 0,
            dex: 0,
            vit: 0
        };

        for (const key of PRIMARY_STATS) {
            const value = Number(allocation[key] ?? allocation[this.primaryToLegacyKey(key)]);
            if (!Number.isInteger(value) || value < 0) {
                this.sendRaw(player.ws, { type: 'system_message', text: 'Distribuicao invalida de atributos.' });
                return;
            }
            sanitized[key] = value;
        }
        for (const [legacyKey, primaryKey] of Object.entries(LEGACY_ALLOC_MAP)) {
            if (Object.prototype.hasOwnProperty.call(allocation, legacyKey)) {
                const value = Number(allocation[legacyKey]);
                if (!Number.isInteger(value) || value < 0) {
                    this.sendRaw(player.ws, { type: 'system_message', text: 'Distribuicao invalida de atributos.' });
                    return;
                }
                sanitized[primaryKey] = value;
            }
        }

        const requestedTotal = this.getAllocatedTotal(sanitized);

        if (requestedTotal <= 0) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Nenhum ponto foi alocado.' });
            return;
        }

        const current = this.normalizeAllocatedStats(player.allocatedStats);
        const requestedCost = this.getAllocationCost(current, sanitized);
        const maxSpend = this.maxSpendablePointsByLevel(player.level);
        const alreadySpent = this.getAllocatedCost(current);

        player.unspentPoints = Number.isInteger(player.unspentPoints) && player.unspentPoints > 0 ? player.unspentPoints : 0;
        if (requestedCost > player.unspentPoints) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Pontos insuficientes para essa distribuicao.' });
            return;
        }
        if (alreadySpent + requestedCost > maxSpend) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Distribuicao invalida para o nivel atual.' });
            return;
        }

        const next: Record<PrimaryStat, number> = { ...current };
        for (const key of PRIMARY_STATS) {
            next[key] = Number(current[key] || 0) + Number(sanitized[key] || 0);
        }

        // Overrides absolutos antigos podem congelar PATK/PDEF/HP e invalidar ganhos de atributos.
        // Ao alocar pontos, removemos os overrides dependentes de atributo para manter consistencia.
        let clearedAttributeOverrides = 0;
        if (player.statusOverrides && typeof player.statusOverrides === 'object') {
            for (const key of ATTRIBUTE_DRIVEN_OVERRIDE_KEYS) {
                if (Object.prototype.hasOwnProperty.call(player.statusOverrides, key)) {
                    delete player.statusOverrides[key];
                    clearedAttributeOverrides += 1;
                }
            }
        }

        player.allocatedStats = next;
        player.unspentPoints -= requestedCost;
        this.recomputePlayerStats(player);
        this.persistPlayer(player);
        this.sendRaw(player.ws, {
            type: 'system_message',
            text: `${requestedTotal} ponto(s) aplicado(s) (custo ${requestedCost}). Restantes: ${player.unspentPoints}.`
        });
        if (clearedAttributeOverrides > 0) {
            this.sendRaw(player.ws, {
                type: 'system_message',
                text: 'Overrides de combate foram limpos para aplicar os atributos corretamente.'
            });
        }
        this.sendStatsUpdated(player);
    }

    tick(deltaSeconds: number, now: number) {
        perfStats.time('tick.events', () => this.eventService.tick(now));
        perfStats.time('tick.dungeons', () => this.dungeonService.tick(now));
        perfStats.time('tick.pruneGroundItems', () => this.pruneExpiredGroundItems(now));
        perfStats.time('tick.prunePartyInvites', () => this.pruneExpiredPartyInvites(now));
        perfStats.time('tick.prunePartyJoinRequests', () => this.pruneExpiredPartyJoinRequests(now));
        perfStats.time('tick.pruneFriendRequests', () => this.pruneExpiredFriendRequests(now));
        perfStats.time('tick.pruneTradeRequests', () => this.tradeService.pruneExpiredRequests(now));
        perfStats.time('tick.pruneGuildInvites', () => { void this.pruneExpiredGuildInvites(now); });
        perfStats.time('tick.mobs', () => this.processMobAggroAndCombat(deltaSeconds, now));
        perfStats.time('tick.pets', () => this.petService.tick(deltaSeconds, now));
        let activePlayers = 0;
        for (const player of this.players.values()) {
            activePlayers += 1;
            this.pruneExpiredSkillEffects(player, now);
            if (player.dead || player.hp <= 0) continue;
            this.processAfkBehavior(player, now);
            this.movePlayerTowardTarget(player, deltaSeconds, now);
            this.skillService.processPendingSkillCast(player, now);
            this.processPortalCollision(player, now);
            this.processAutoAttack(player, now);
            this.processAutoAttackPlayer(player, now);
        }
        perfStats.increment('tick.playersProcessed', activePlayers);
        if (now - this.lastPartySyncAt >= 200) {
            this.lastPartySyncAt = now;
            perfStats.time('tick.partySync', () => this.syncAllPartyStates());
        }
        if (now - this.lastAutosaveAt >= AUTOSAVE_MS) {
            this.lastAutosaveAt = now;
            void this.flushAutosavePlayers();
        }
    }

    buildWorldSnapshot(mapId: string = DEFAULT_MAP_ID, mapKey: string = DEFAULT_MAP_KEY) {
        return perfStats.time('snapshot.buildWorld', () => {
            const mapInstanceId = this.mapInstanceId(mapKey, mapId);
            const publicPlayers: Record<string, any> = {};
            for (const [id, player] of this.players.entries()) {
                if (player.mapId !== mapId || player.mapKey !== mapKey) continue;
                publicPlayers[String(id)] = this.sanitizePublicPlayer(player);
            }
            perfStats.increment('snapshot.playersVisible', Object.keys(publicPlayers).length);
            return {
                type: 'world_state',
                players: publicPlayers,
                pets: this.petService
                    .getPetsByMap(mapKey, mapId)
                    .map((pet) => this.sanitizePetForNetwork(pet))
                    .filter(Boolean),
                mobs: this.mobService
                    .getMobsByMap(mapInstanceId)
                    .map((mob) => this.sanitizeMobForNetwork(mob))
                    .filter(Boolean),
                groundItems: this.groundItems
                    .filter((it) => it.mapId === mapInstanceId)
                    .map((it) => this.sanitizeGroundItemForNetwork(it))
                    .filter(Boolean),
                activeEvents: this.eventService.getActiveEventsForMap(mapKey, mapId),
                npcs: this.questService.getNpcsForMap(mapKey, mapId),
                mapKey,
                mapId,
            };
        });
    }

    buildWorldStaticSnapshot(mapId: string = DEFAULT_MAP_ID, mapKey: string = DEFAULT_MAP_KEY) {
        const staticWorld = this.getStaticWorldSnapshot(mapKey);
        return {
            ...staticWorld,
            mapId
        };
    }

    serializeWorldSnapshot(mapId: string = DEFAULT_MAP_ID, mapKey: string = DEFAULT_MAP_KEY) {
        return perfStats.time('snapshot.serializeWorld', () => {
            const instanceKey = `${String(mapKey)}::${String(mapId)}`;
            const signature = this.computeWorldSnapshotSignature(mapId, mapKey);
            const cached = this.worldSnapshotCache.get(instanceKey);
            if (cached && cached.signature === signature) {
                perfStats.increment('snapshot.cache.hit');
                return cached.serialized;
            }
            perfStats.increment('snapshot.cache.miss');
            const serialized = JSON.stringify(this.buildWorldSnapshot(mapId, mapKey));
            this.worldSnapshotCache.set(instanceKey, { signature, serialized });
            return serialized;
        });
    }

    serializeWorldStaticSnapshot(mapId: string = DEFAULT_MAP_ID, mapKey: string = DEFAULT_MAP_KEY) {
        return perfStats.time('snapshot.serializeWorldStatic', () =>
            JSON.stringify(this.buildWorldStaticSnapshot(mapId, mapKey))
        );
    }

    getPlayerByRuntimeId(playerId: number) {
        return this.players.get(playerId);
    }

    async handleDisconnect(playerId: number) {
        const player = this.players.get(playerId);
        if (!player) return;
        const previousGuildId = String(player.guildId || '');
        this.dungeonService.onPlayerDisconnected(player.id);
        this.tradeService.clearStateForPlayer(player.id, `${player.name} desconectou e a troca foi encerrada.`);
        this.storageService.clearForPlayer(player.id);
        this.petService.clearForPlayer(player.id);
        this.removePlayerFromParty(player);
        await this.persistPlayerNow(player, 'disconnect');
        await this.clearGuildInvitesForPlayer(player.id);
        this.usernameToPlayerId.delete(player.username);
        this.players.delete(playerId);
        this.dirtyPlayerIds.delete(playerId);
        this.persistRevisionByPlayerId.delete(playerId);
        this.lastPersistSignatureByPlayerId.delete(playerId);
        this.publicPlayerCache.delete(playerId);
        this.clearPendingInvitesForPlayer(player.id);
        this.clearJoinRequestsForPlayer(player.id);
        this.clearFriendRequestsForPlayer(player.id);
        this.worldSnapshotCache.delete(`${String(player.mapKey)}::${String(player.mapId)}`);
        if (previousGuildId) await this.guildService.broadcastGuildStateForGuild(previousGuildId);
    }

    private computeWorldSnapshotSignature(mapId: string, mapKey: string) {
        return perfStats.time('snapshot.signatureWorld', () => {
            const mapInstanceId = this.mapInstanceId(mapKey, mapId);
            const playersSignature = Array.from(this.players.values())
                .filter((player) => player.mapId === mapId && player.mapKey === mapKey)
                .sort((a, b) => Number(a.id) - Number(b.id))
                .map((player) => [
                    player.id,
                    Math.round(Number(player.x || 0)),
                    Math.round(Number(player.y || 0)),
                    Number(player.hp || 0),
                    Number(player.maxHp || 0),
                    player.dead ? 1 : 0,
                    Number(player.level || 0),
                    String(player.pvpMode || 'peace'),
                    String(player.equippedWeaponId || ''),
                    Number(player.xp || 0),
                    Number(player.unspentPoints || 0),
                    player.afkActive ? 1 : 0,
                    Array.isArray(player.movePath) ? player.movePath.length : 0
                ].join(':'))
                .join('|');
            const petsSignature = this.petService.getPetsByMap(mapKey, mapId)
                .sort((a: PetRuntime, b: PetRuntime) => String(a.id).localeCompare(String(b.id)))
                .map((pet: PetRuntime) => [
                    String(pet.id),
                    Math.round(Number(pet.x || 0)),
                    Math.round(Number(pet.y || 0)),
                    Number(pet.hp || 0),
                    Number(pet.maxHp || 0),
                    String(pet.behavior || 'assist'),
                    Number(pet.ownerPlayerId || 0)
                ].join(':'))
                .join('|');
            const mobsSignature = this.mobService.getMobsByMap(mapInstanceId)
                .sort((a: any, b: any) => String(a.id).localeCompare(String(b.id)))
                .map((mob: any) => [
                    String(mob.id),
                    Math.round(Number(mob.x || 0)),
                    Math.round(Number(mob.y || 0)),
                    Number(mob.hp || 0),
                    Number(mob.maxHp || 0),
                    String(mob.state || ''),
                    Number(mob.targetPlayerId || 0)
                ].join(':'))
                .join('|');
            const groundSignature = this.groundItems
                .filter((item) => item.mapId === mapInstanceId)
                .sort((a, b) => String(a.id).localeCompare(String(b.id)))
                .map((item) => [
                    String(item.id),
                    Math.round(Number(item.x || 0)),
                    Math.round(Number(item.y || 0)),
                    Number(item.quantity || 0),
                    Number(item.reservedUntil || 0),
                    Number(item.expiresAt || 0)
                ].join(':'))
                .join('|');
            const activeEvents = JSON.stringify(this.eventService.getActiveEventsForMap(mapKey, mapId));
            const npcs = JSON.stringify(this.questService.getNpcsForMap(mapKey, mapId));
            return [
                mapKey,
                mapId,
                playersSignature,
                petsSignature,
                mobsSignature,
                groundSignature,
                activeEvents,
                npcs
            ].join('#');
        });
    }

    private firstFreeInventorySlot(items: any[], ignoreItemIds: Set<string> = new Set()): number {
        const used = new Set(
            items
                .filter((it) => !ignoreItemIds.has(String(it?.id || '')))
                .map((it) => it.slotIndex)
                .filter((n) => Number.isInteger(n) && n >= 0)
        );
        for (let i = 0; i < INVENTORY_SIZE; i++) {
            if (!used.has(i)) return i;
        }
        return -1;
    }

    private sanitizePublicPlayer(player: PlayerRuntime) {
        const signature = this.computePublicPlayerSignature(player);
        const cached = this.publicPlayerCache.get(player.id);
        if (cached && cached.signature === signature) return cached.snapshot;
        const weapon = Array.isArray(player.inventory) ? player.inventory.find((it: any) => it.id === player.equippedWeaponId) : null;
        const equippedBySlot = this.getEquippedItemsBySlot(player);
        const snapshot = {
            id: player.id,
            username: player.username,
            name: player.name,
            class: player.class,
            gender: player.gender,
            x: player.x,
            y: player.y,
            mapKey: player.mapKey,
            mapId: player.mapId,
            pvpMode: player.pvpMode === 'evil' ? 'evil' : player.pvpMode === 'group' ? 'group' : 'peace',
            dead: Boolean(player.dead || player.hp <= 0),
            role: player.role || 'player',
            level: player.level,
            hp: player.hp,
            maxHp: player.maxHp,
            afkActive: Boolean(player.afkActive),
            equippedWeaponName: weapon ? weapon.name : null,
            equippedBySlot,
            wallet: normalizeWallet(player.wallet),
            xp: player.xp,
            xpToNext: xpRequired(player.level),
            stats: player.stats,
            skillLevels: this.normalizeSkillLevels(player.skillLevels || {}),
            skillCooldowns: this.serializeSkillCooldowns(player),
            skillPointsAvailable: this.getAvailableSkillPoints(player),
            allocatedStats: this.normalizeAllocatedStats(player.allocatedStats),
            unspentPoints: Number.isInteger(player.unspentPoints) ? player.unspentPoints : 0,
            activeSkillEffects: this.serializeActiveSkillEffects(player)
        };
        this.publicPlayerCache.set(player.id, { signature, snapshot });
        return snapshot;
    }

    private sanitizeNetworkBonuses(raw: any) {
        if (!raw || typeof raw !== 'object') return {};
        const out: Record<string, number | string | boolean> = {};
        for (const [key, value] of Object.entries(raw)) {
            if (typeof value === 'number' && Number.isFinite(value)) {
                out[key] = value;
                continue;
            }
            if (typeof value === 'string' || typeof value === 'boolean') {
                out[key] = value;
            }
        }
        return out;
    }

    private sanitizeNetworkItem(item: any) {
        if (!item || typeof item !== 'object') return null;
        return {
            id: item.id ? String(item.id) : '',
            templateId: item.templateId ? String(item.templateId) : '',
            type: item.type ? String(item.type) : '',
            name: item.name ? String(item.name) : 'Item',
            rarity: item.rarity ? String(item.rarity) : 'branco',
            quality: item.quality ? String(item.quality) : 'normal',
            spriteId: item.spriteId ? String(item.spriteId) : null,
            iconUrl: item.iconUrl ? String(item.iconUrl) : null,
            slot: item.slot ? String(item.slot) : null,
            slotIndex: Number.isFinite(Number(item.slotIndex)) ? Number(item.slotIndex) : -1,
            quantity: Math.max(1, Number(item.quantity || 1)),
            stackable: Boolean(item.stackable),
            maxStack: Math.max(1, Number(item.maxStack || 1)),
            equipped: Boolean(item.equipped),
            equippedSlot: item.equippedSlot ? String(item.equippedSlot) : null,
            requiredClass: item.requiredClass ? String(item.requiredClass) : null,
            requiredLevel: Number.isFinite(Number(item.requiredLevel)) ? Number(item.requiredLevel) : null,
            bindingType: item.bindingType ? String(item.bindingType) : 'unbound',
            healPercent: Number.isFinite(Number(item.healPercent)) ? Number(item.healPercent) : undefined,
            bonuses: this.sanitizeNetworkBonuses(item.bonuses),
            bonusPercents: this.sanitizeNetworkBonuses(item.bonusPercents)
        };
    }

    private sanitizeGroundItemForNetwork(item: any) {
        if (!item || typeof item !== 'object') return null;
        return {
            id: item.id ? String(item.id) : '',
            templateId: item.templateId ? String(item.templateId) : '',
            type: item.type ? String(item.type) : '',
            name: item.name ? String(item.name) : 'Item',
            rarity: item.rarity ? String(item.rarity) : 'branco',
            quality: item.quality ? String(item.quality) : 'normal',
            spriteId: item.spriteId ? String(item.spriteId) : null,
            iconUrl: item.iconUrl ? String(item.iconUrl) : null,
            slot: item.slot ? String(item.slot) : null,
            quantity: Math.max(1, Number(item.quantity || 1)),
            stackable: Boolean(item.stackable),
            maxStack: Math.max(1, Number(item.maxStack || 1)),
            requiredClass: item.requiredClass ? String(item.requiredClass) : null,
            requiredLevel: Number.isFinite(Number(item.requiredLevel)) ? Number(item.requiredLevel) : null,
            bindingType: item.bindingType ? String(item.bindingType) : 'unbound',
            healPercent: Number.isFinite(Number(item.healPercent)) ? Number(item.healPercent) : undefined,
            bonuses: this.sanitizeNetworkBonuses(item.bonuses),
            bonusPercents: this.sanitizeNetworkBonuses(item.bonusPercents),
            x: Number(item.x || 0),
            y: Number(item.y || 0),
            mapId: item.mapId ? String(item.mapId) : '',
            ownerId: Number.isFinite(Number(item.ownerId)) ? Number(item.ownerId) : null,
            ownerPartyId: item.ownerPartyId ? String(item.ownerPartyId) : null,
            reservedUntil: Number.isFinite(Number(item.reservedUntil)) ? Number(item.reservedUntil) : undefined,
            expiresAt: Number.isFinite(Number(item.expiresAt)) ? Number(item.expiresAt) : undefined
        };
    }

    private sanitizePetForNetwork(pet: PetRuntime) {
        if (!pet || typeof pet !== 'object') return null;
        return {
            id: String(pet.id || ''),
            ownershipId: String(pet.ownershipId || ''),
            templateId: String(pet.templateId || ''),
            ownerPlayerId: Number(pet.ownerPlayerId || 0),
            ownerName: String(pet.ownerName || 'Aventureiro'),
            name: String(pet.name || 'Pet'),
            role: String(pet.role || 'offensive'),
            moveStyle: String(pet.moveStyle || 'ground'),
            biomeKey: String(pet.biomeKey || ''),
            mapKey: String(pet.mapKey || ''),
            mapId: String(pet.mapId || ''),
            x: Number(pet.x || 0),
            y: Number(pet.y || 0),
            hp: Number(pet.hp || 0),
            maxHp: Number(pet.maxHp || 1),
            level: Math.max(1, Number(pet.level || 1)),
            xp: Math.max(0, Number(pet.xp || 0)),
            loyalty: Math.max(0, Math.min(100, Number(pet.loyalty || 0))),
            hunger: Math.max(0, Math.min(100, Number(pet.hunger || 0))),
            behavior: String(pet.behavior || 'assist'),
            visualSeed: Number(pet.visualSeed || 0)
        };
    }

    private sanitizeMobForNetwork(mob: any) {
        if (!mob || typeof mob !== 'object') return null;
        const normalizedState = typeof mob.state === 'string' ? String(mob.state) : 'idle';
        return {
            id: mob.id ? String(mob.id) : '',
            x: Number.isFinite(Number(mob.x)) ? Number(mob.x) : 0,
            y: Number.isFinite(Number(mob.y)) ? Number(mob.y) : 0,
            kind: mob.kind ? String(mob.kind) : 'Mob',
            color: mob.color ? String(mob.color) : '#cf4444',
            size: Number.isFinite(Number(mob.size)) ? Number(mob.size) : 14,
            hp: Number.isFinite(Number(mob.hp)) ? Number(mob.hp) : 0,
            maxHp: Number.isFinite(Number(mob.maxHp)) ? Number(mob.maxHp) : 1,
            level: Number.isFinite(Number(mob.level)) ? Number(mob.level) : undefined,
            state:
                normalizedState === 'wander' ||
                normalizedState === 'aggro' ||
                normalizedState === 'attack_windup' ||
                normalizedState === 'leash_return'
                    ? normalizedState
                    : 'idle',
            targetPlayerId: Number.isFinite(Number(mob.targetPlayerId)) ? Number(mob.targetPlayerId) : null,
            eventId: mob.eventId ? String(mob.eventId) : null,
            eventName: mob.eventName ? String(mob.eventName) : null
        };
    }

    private serializeSkillCooldowns(player: PlayerRuntime, now: number = Date.now()) {
        const raw = player?.skillCooldowns && typeof player.skillCooldowns === 'object'
            ? player.skillCooldowns
            : {};
        const out: Record<string, number> = {};
        for (const [skillId, endsAt] of Object.entries(raw)) {
            const safeEndsAt = Number(endsAt || 0);
            if (!Number.isFinite(safeEndsAt) || safeEndsAt <= now) continue;
            out[String(skillId)] = safeEndsAt;
        }
        return out;
    }

    private serializeActiveSkillEffects(player: PlayerRuntime, now: number = Date.now()) {
        const raw = Array.isArray(player?.activeSkillEffects)
            ? player.activeSkillEffects
            : [];
        return raw
            .filter((entry: any) => Number(entry?.expiresAt || 0) > now)
            .map((entry: any) => ({
                id: String(entry?.id || ''),
                expiresAt: Number(entry?.expiresAt || 0),
                attackMul: Number(entry?.attackMul || 0),
                defenseMul: Number(entry?.defenseMul || 0),
                magicDefenseMul: Number(entry?.magicDefenseMul || 0),
                moveMul: Number(entry?.moveMul || 0),
                attackSpeedMul: Number(entry?.attackSpeedMul || 0),
                critAdd: Number(entry?.critAdd || 0),
                evasionAdd: Number(entry?.evasionAdd || 0),
                damageReduction: Number(entry?.damageReduction || 0),
                lifesteal: Number(entry?.lifesteal || 0),
                reflect: Number(entry?.reflect || 0),
                stealth: Boolean(entry?.stealth)
            }));
    }

    private computePublicPlayerSignature(player: PlayerRuntime) {
        const movePathSignature = Array.isArray(player.movePath)
            ? player.movePath.slice(0, 8).map((pt: any) => `${Math.round(Number(pt?.x || 0))},${Math.round(Number(pt?.y || 0))}`).join(';')
            : '';
        const effectsSignature = Array.isArray(player.activeSkillEffects)
            ? player.activeSkillEffects
                .map((fx: any) => `${String(fx?.id || '')}:${Number(fx?.expiresAt || 0)}`)
                .sort()
                .join('|')
            : '';
        return [
            player.id,
            player.username,
            player.name,
            player.class,
            player.gender,
            Math.round(Number(player.x || 0)),
            Math.round(Number(player.y || 0)),
            player.mapKey,
            player.mapId,
            player.pvpMode,
            player.dead ? 1 : 0,
            player.role || 'player',
            Number(player.level || 0),
            Number(player.hp || 0),
            Number(player.maxHp || 0),
            player.afkActive ? 1 : 0,
            String(player.equippedWeaponId || ''),
            Number(player.xp || 0),
            Number(player.unspentPoints || 0),
            JSON.stringify(player.wallet || {}),
            JSON.stringify(player.stats || {}),
            JSON.stringify(this.normalizeSkillLevels(player.skillLevels || {})),
            JSON.stringify(this.normalizeAllocatedStats(player.allocatedStats)),
            effectsSignature,
            movePathSignature
        ].join('#');
    }

    private getStaticWorldSnapshot(mapKey: string): StaticWorldSnapshotEntry {
        const cacheKey = String(mapKey || '');
        const cached = this.staticWorldSnapshotCache.get(cacheKey);
        if (cached) return cached;
        const hasTiledCollision = Boolean(this.getMapTiledCollisionSampler(mapKey));
        const isDungeonMap = String(mapKey || '').startsWith('dng_');
        const mapMetadata = getMapMetadata(mapKey);
        const snapshot: StaticWorldSnapshotEntry = {
            type: 'world_static',
            mapCode: mapMetadata?.mapCode || mapCodeFromKey(mapKey),
            mapKey,
            mapTheme: isDungeonMap ? 'undead' : (MAP_THEMES[mapKey] || 'forest'),
            mapFeatures: hasTiledCollision ? [] : (MAP_FEATURES_BY_KEY[mapKey] || []),
            portals: PORTALS_BY_MAP_KEY[mapKey] || [],
            world: mapMetadata?.world || WORLD,
            mapTiled: mapMetadata
                ? {
                    mapCode: mapMetadata.mapCode,
                    assetKey: mapMetadata.assetKey,
                    tmjUrl: mapMetadata.tmjUrl,
                    tilesBaseUrl: mapMetadata.tilesBaseUrl,
                    orientation: mapMetadata.orientation,
                    worldTileSize: mapMetadata.worldTileSize,
                    worldScale: mapMetadata.worldScale
                }
                : null
        };
        this.staticWorldSnapshotCache.set(cacheKey, snapshot);
        return snapshot;
    }

    private normalizeHotbarBinding(binding: any) {
        if (!binding || typeof binding !== 'object') return null;
        const type = String(binding.type || '');
        if (type === 'action') {
            const actionId = String(binding.actionId || '');
            if (actionId === 'basic_attack') return { type: 'action', actionId: 'basic_attack' };
            if (actionId === 'skill_cast') {
                const skillId = String(binding.skillId || '');
                if (!skillId) return null;
                return {
                    type: 'action',
                    actionId: 'skill_cast',
                    skillId,
                    skillName: binding.skillName ? String(binding.skillName) : 'Skill'
                };
            }
            return null;
        }
        if (type === 'item') {
            const itemId = binding.itemId ? String(binding.itemId) : '';
            const itemType = binding.itemType ? String(binding.itemType) : '';
            if (!itemId && !itemType) return null;
            return {
                type: 'item',
                itemId,
                itemType,
                itemName: binding.itemName ? String(binding.itemName) : 'Item'
            };
        }
        return null;
    }

    private normalizeHotbarBindings(raw: any) {
        const allowedKeys = ['1', '2', '3', '4', '5', '6', '7', '8', 'q', 'w', 'e', 'r', 'a', 's', 'd', 'f'];
        const source = raw && typeof raw === 'object' ? raw : {};
        const out: Record<string, any> = {};
        for (const key of allowedKeys) {
            out[key] = this.normalizeHotbarBinding(source[key]);
        }
        return out;
    }

    private getPlayerHotbarBindings(player: PlayerRuntime) {
        const raw = player?.statusOverrides?.__hotbarBindings;
        return this.normalizeHotbarBindings(raw);
    }

    private movePlayerTowardTarget(player: PlayerRuntime, deltaSeconds: number, now: number) {
        this.movementService.movePlayerTowardTarget(player, deltaSeconds, now);
    }

    private processAutoAttack(player: PlayerRuntime, now: number) {
        this.combatRuntimeService.processAutoAttack(player, now);
    }

    private computeMobDamage(player: PlayerRuntime, mob: any, multiplier: number, forceMagic: boolean = false, now: number = Date.now()) {
        return this.combatCoreService.computeMobDamage(player, mob, multiplier, forceMagic, now);
    }

    private resolveTargetMobForPet(owner: PlayerRuntime, mobId: string) {
        const safeMobId = String(mobId || '').trim();
        if (!safeMobId) return null;
        const mapInstanceId = this.mapInstanceId(owner.mapKey, owner.mapId);
        return this.mobService.getMobsByMap(mapInstanceId).find((mob: any) => String(mob.id || '') === safeMobId) || null;
    }

    private applyDamageToMobAndHandleDeath(player: PlayerRuntime, mob: any, damage: number, now: number) {
        const wasAlive = Boolean(mob && Number(mob.hp || 0) > 0);
        const ok = this.combatCoreService.applyDamageToMobAndHandleDeath(player, mob, damage, now);
        if (ok && wasAlive && mob && Number(mob.hp || 0) <= 0) {
            this.questService.onMobKilled(player, mob);
            this.dungeonService.onMobKilled(player, mob);
        }
        return ok;
    }

    private pruneExpiredSkillEffects(player: PlayerRuntime, now: number = Date.now()) {
        this.skillEffectsService.pruneExpiredSkillEffects(player, now);
    }

    private hasActiveSkillEffect(player: PlayerRuntime, effectId: string, now: number = Date.now()) {
        return this.skillEffectsService.hasActiveSkillEffect(player, effectId, now);
    }

    private removeSkillEffectById(player: PlayerRuntime, effectId: string) {
        this.skillEffectsService.removeSkillEffectById(player, effectId);
    }

    private getActiveSkillEffectAggregate(player: PlayerRuntime, now: number = Date.now()) {
        return this.skillEffectsService.getActiveSkillEffectAggregate(player, now);
    }

    private applyTimedSkillEffect(player: PlayerRuntime, buff: any, now: number = Date.now()) {
        this.skillEffectsService.applyTimedSkillEffect(player, buff, now);
    }

    private applyOnHitSkillEffects(player: PlayerRuntime, dealtDamage: number, now: number = Date.now()) {
        return this.skillEffectsService.applyOnHitSkillEffects(player, dealtDamage, now);
    }

    private sendSkillEffect(mapKey: string, mapId: string, payload: any) {
        this.skillEffectsService.sendSkillEffect(mapKey, mapId, payload);
    }

    private broadcastMobHit(player: PlayerRuntime, mob: any) {
        this.skillEffectsService.broadcastMobHit(player, mob);
    }

    private processAutoAttackPlayer(player: PlayerRuntime, now: number) {
        this.combatRuntimeService.processAutoAttackPlayer(player, now);
    }

    private setAfkState(player: PlayerRuntime, active: boolean) {
        const next = Boolean(active);
        if (Boolean(player.afkActive) === next) return;
        player.afkActive = next;
        player.afkNextThinkAt = 0;
        if (next) {
            player.afkOriginX = Number(player.x);
            player.afkOriginY = Number(player.y);
            player.afkOriginMapKey = String(player.mapKey);
            player.afkOriginMapId = String(player.mapId);
            this.sendRaw(player.ws, { type: 'system_message', text: 'Voce esta no modo AFK.' });
            return;
        }
        player.movePath = [];
        player.rawMovePath = [];
        player.targetX = player.x;
        player.targetY = player.y;
        player.pathDestinationX = player.x;
        player.pathDestinationY = player.y;
        player.autoAttackActive = false;
        player.attackTargetId = null;
        player.pendingSkillCast = null;
        this.sendRaw(player.ws, { type: 'system_message', text: 'Modo AFK desativado.' });
    }

    private processAfkBehavior(player: PlayerRuntime, now: number) {
        if (!player.afkActive) return;
        if (now < Number(player.afkNextThinkAt || 0)) return;
        player.afkNextThinkAt = now + AFK_THINK_MS;

        const originMapKey = String(player.afkOriginMapKey || player.mapKey);
        const originMapId = String(player.afkOriginMapId || player.mapId);
        if (originMapKey !== player.mapKey || originMapId !== player.mapId) {
            this.setAfkState(player, false);
            return;
        }

        const currentTarget = player.attackTargetId
            ? this.mobService.getMobs().find((m: any) =>
                m.id === player.attackTargetId
                && m.mapId === this.mapInstanceId(player.mapKey, player.mapId)
                && Number(m.hp || 0) > 0
            )
            : null;
        if (currentTarget) return;

        const nearestMob = this.findNearestMobForAfk(player, AFK_VISION_RANGE);
        if (nearestMob) {
            player.pvpAutoAttackActive = false;
            player.attackTargetPlayerId = null;
            player.autoAttackActive = true;
            player.attackTargetId = String(nearestMob.id);
            return;
        }

        player.autoAttackActive = false;
        player.attackTargetId = null;
        const ox = Number.isFinite(Number(player.afkOriginX)) ? Number(player.afkOriginX) : Number(player.x);
        const oy = Number.isFinite(Number(player.afkOriginY)) ? Number(player.afkOriginY) : Number(player.y);
        if (distance(player, { x: ox, y: oy } as any) <= AFK_RETURN_EPSILON) return;
        this.recalculatePathToward(player, ox, oy, now);
    }

    private findNearestMobForAfk(player: PlayerRuntime, maxDistance: number) {
        const mapInstance = this.mapInstanceId(player.mapKey, player.mapId);
        let nearest: any = null;
        let nearestDistance = Number.POSITIVE_INFINITY;
        for (const mob of this.mobService.getMobsByMap(mapInstance)) {
            if (!mob || Number(mob.hp || 0) <= 0) continue;
            const d = distance(player, mob);
            if (d > maxDistance) continue;
            if (d < nearestDistance) {
                nearestDistance = d;
                nearest = mob;
            }
        }
        return nearest;
    }

    private processMobAggroAndCombat(deltaSeconds: number, now: number) {
        this.combatRuntimeService.processMobAggroAndCombat(deltaSeconds, now);
    }

    private tryPlayerAttack(player: PlayerRuntime, targetPlayerId: number, now: number, silent: boolean) {
        this.combatCoreService.tryPlayerAttack(player, targetPlayerId, now, silent);
    }

    private getPvpAttackPermission(player: PlayerRuntime, target: PlayerRuntime): { ok: boolean; reason?: string } {
        return this.combatService.getPvpAttackPermission(player, target);
    }

    private assignPathTo(player: PlayerRuntime, destinationX: number, destinationY: number) {
        this.movementService.assignPathTo(player, destinationX, destinationY);
    }

    private recalculatePathToward(player: PlayerRuntime, destinationX: number, destinationY: number, now: number) {
        this.movementService.recalculatePathToward(player, destinationX, destinationY, now);
    }

    private processPortalCollision(player: PlayerRuntime, now: number) {
        this.mapService.processPortalCollision(player, now, (movedPlayer) => this.sendPartyAreaList(movedPlayer));
    }

    private mapInstanceId(mapKey: string, mapId: string) {
        return this.mapService.mapInstanceId(mapKey, mapId);
    }

    private isBlockedAt(mapKey: string, x: number, y: number) {
        return this.mapService.isBlockedAt(mapKey, x, y);
    }

    private hasLineOfSight(mapKey: string, fromX: number, fromY: number, toX: number, toY: number) {
        return this.mapService.hasLineOfSight(mapKey, fromX, fromY, toX, toY);
    }

    private getMapWorld(mapKey: string) {
        return this.mapService.getMapWorld(mapKey);
    }

    private getMapTiledCollisionSampler(mapKey: string) {
        return this.mapService.getMapTiledCollisionSampler(mapKey);
    }

    private projectToWalkable(mapKey: string, x: number, y: number) {
        return this.mapService.projectToWalkable(mapKey, x, y);
    }

    private grantXp(player: PlayerRuntime, amount: number, context?: { mapKey?: string; mapId?: string; }) {
        const totalXp = Math.max(0, Math.floor(Number(amount || 0)));
        if (totalXp <= 0) return;
        const mapKey = String(context?.mapKey || player.mapKey || '');
        const mapId = String(context?.mapId || player.mapId || '');
        const eligible = [...this.players.values()].filter((candidate) =>
            String(candidate.partyId || '') !== ''
            && String(candidate.partyId || '') === String(player.partyId || '')
            && String(candidate.mapKey || '') === mapKey
            && String(candidate.mapId || '') === mapId
        );
        const targets = eligible.length > 0 ? eligible : [player];
        const share = Math.max(1, Math.floor(totalXp / targets.length));
        const remainder = Math.max(0, totalXp - (share * targets.length));

        targets.forEach((target, index) => {
            const gain = share + (index === 0 ? remainder : 0);
            target.xp += gain;
            let next = xpRequired(target.level);
            let levelsGained = 0;
            while (target.xp >= next) {
                target.xp -= next;
                target.level += 1;
                levelsGained += 1;
                next = xpRequired(target.level);
            }
            if (levelsGained > 0) {
                this.sendRaw(target.ws, {
                    type: 'system_message',
                    text: `Voce ganhou ${levelsGained * 5} ponto(s) de atributo.`
                });
            }
            this.recomputePlayerStats(target);
            if (levelsGained > 0) {
                this.persistPlayerCritical(target, 'level_up');
            } else {
                this.persistPlayer(target);
            }
            this.sendStatsUpdated(target);
        });
    }

    private normalizeInventorySlots(items: any[], equippedWeaponId: string | null = null) {
        return this.inventoryService.normalizeInventorySlots(items, equippedWeaponId);
    }

    private getEquippedWeapon(player: PlayerRuntime) {
        if (!player.equippedWeaponId) return null;
        return Array.isArray(player.inventory) ? player.inventory.find((item: any) => item.id === player.equippedWeaponId) || null : null;
    }

    private getEquippedItemsBySlot(player: PlayerRuntime) {
        const equipped: Record<string, any> = {};
        if (!Array.isArray(player.inventory)) return equipped;
        for (const item of player.inventory) {
            if (!item || typeof item !== 'object') continue;
            const isWeapon = String(item.id || '') === String(player.equippedWeaponId || '');
            const isAccessory = item.equipped === true && String(item.equippedSlot || '').length > 0;
            if (!isWeapon && !isAccessory) continue;
            const slot = isWeapon ? 'weapon' : String(item.equippedSlot || item.slot || '');
            if (!slot) continue;
            equipped[slot] = this.sanitizeNetworkItem(item);
        }
        return equipped;
    }

    private recomputePlayerStats(player: PlayerRuntime) {
        const allocated = this.normalizeAllocatedStats(player.allocatedStats);
        const maxSpend = this.maxSpendablePointsByLevel(player.level);
        const boundedAllocated = this.enforceAllocationBudget(allocated, maxSpend);
        player.allocatedStats = boundedAllocated;
        const leveled = this.computeDerivedStats(player);
        const overrides = player.statusOverrides && typeof player.statusOverrides === 'object' ? player.statusOverrides : {};
        for (const [key, value] of Object.entries(overrides)) {
            if (typeof (leveled as any)[key] === 'number' && Number.isFinite(value as number)) {
                (leveled as any)[key] = value;
            }
        }

        const spent = this.getAllocatedCost(boundedAllocated);
        const maxUnspent = Math.max(0, maxSpend - spent);
        player.unspentPoints = maxUnspent;

        const equippedItems = Array.isArray(player.inventory)
            ? player.inventory.filter((item: any) =>
                (item?.id && String(item.id) === String(player.equippedWeaponId || ''))
                || item?.equipped === true
            )
            : [];
        if (equippedItems.length > 0) {
            const bonusSum = equippedItems.reduce((acc: Record<string, number>, item: any) => {
                const bonuses = item?.bonuses && typeof item.bonuses === 'object' ? item.bonuses : {};
                for (const [key, value] of Object.entries(bonuses)) {
                    const current = Number(acc[key] || 0);
                    const add = Number.isFinite(Number(value)) ? Number(value) : 0;
                    acc[key] = current + add;
                }
                return acc;
            }, {});
            const percentSum = equippedItems.reduce((acc: Record<string, number>, item: any) => {
                const percents = item?.bonusPercents && typeof item.bonusPercents === 'object' ? item.bonusPercents : {};
                for (const [key, value] of Object.entries(percents)) {
                    const current = Number(acc[key] || 0);
                    const add = Number.isFinite(Number(value)) ? Number(value) : 0;
                    acc[key] = current + add;
                }
                return acc;
            }, {});
            const applyFlatAndPercent = (key: string) => {
                const base = Number((leveled as any)[key] || 0) + Number(bonusSum[key] || 0);
                const pct = Number(percentSum[key] || 0);
                return Math.max(0, Math.round(base * (1 + pct)));
            };
            player.stats = {
                ...leveled,
                physicalAttack: applyFlatAndPercent('physicalAttack'),
                magicAttack: applyFlatAndPercent('magicAttack'),
                moveSpeed: applyFlatAndPercent('moveSpeed'),
                attackSpeed: applyFlatAndPercent('attackSpeed'),
                physicalDefense: applyFlatAndPercent('physicalDefense'),
                magicDefense: applyFlatAndPercent('magicDefense'),
                evasion: applyFlatAndPercent('evasion'),
                accuracy: applyFlatAndPercent('accuracy'),
                attackRange: applyFlatAndPercent('attackRange'),
                maxHp: applyFlatAndPercent('maxHp'),
                criticalChance: Number(leveled.criticalChance || 0) + Number(bonusSum.criticalChance || 0) + Number(percentSum.criticalChance || 0),
                luck: Number(leveled.luck || 0) + Number(bonusSum.luck || 0)
            };
        } else {
            player.stats = { ...leveled };
        }
        player.maxHp = Number((player.stats as any).maxHp || (leveled as any).maxHp || player.maxHp || 100);
        player.hp = clamp(Number(player.hp || player.maxHp), 0, player.maxHp);
    }

    private sendInventoryState(player: PlayerRuntime) {
        this.sendRaw(player.ws, this.buildInventoryState(player));
    }

    private buildInventoryState(player: PlayerRuntime) {
        const equippedBySlot = this.getEquippedItemsBySlot(player);
        return {
            type: 'inventory_state',
            inventory: [...player.inventory]
                .sort((a: any, b: any) => Number(a.slotIndex) - Number(b.slotIndex))
                .map((item: any) => this.sanitizeNetworkItem(item)),
            equippedWeaponId: player.equippedWeaponId,
            equippedBySlot,
            wallet: normalizeWallet(player.wallet)
        };
    }

    private ensureWallet(player: PlayerRuntime) {
        player.wallet = normalizeWallet(player.wallet);
    }

    private addWalletCopper(player: PlayerRuntime, amountCopper: number, sourceLabel: string) {
        const amount = Math.max(0, Math.floor(Number(amountCopper || 0)));
        if (amount <= 0) return;
        this.ensureWallet(player);
        const total = walletToCopper(player.wallet) + amount;
        player.wallet = walletFromCopper(total);
        if (sourceLabel) {
            this.sendRaw(player.ws, {
                type: 'system_message',
                text: `${sourceLabel}: +${formatWallet(walletFromCopper(amount))}. Saldo: ${formatWallet(player.wallet)}.`
            });
        }
    }

    private trySpendCopper(player: PlayerRuntime, amountCopper: number) {
        const amount = Math.max(0, Math.floor(Number(amountCopper || 0)));
        if (amount <= 0) return true;
        this.ensureWallet(player);
        const current = walletToCopper(player.wallet);
        if (current < amount) return false;
        player.wallet = walletFromCopper(current - amount);
        return true;
    }

    private computeTemplatePriceCopper(template: any) {
        const price = template?.price && typeof template.price === 'object' ? template.price : {};
        const asWallet = normalizeWallet({
            copper: Number(price.copper || 0),
            silver: Number(price.silver || 0),
            gold: Number(price.gold || 0),
            diamond: Number(price.diamond || 0)
        });
        return walletToCopper(asWallet);
    }

    private computeSellPriceCopper(item: any) {
        const templateKey = String(item?.templateId || item?.type || '');
        const template = BUILTIN_ITEM_TEMPLATE_BY_ID[templateKey] || item;
        const buyCopper = this.computeTemplatePriceCopper(template);
        return Math.max(0, Math.floor(buyCopper * 0.35));
    }

    private grantCurrency(player: PlayerRuntime, reward: Partial<Wallet>, sourceLabel: string) {
        const safe = normalizeWallet({
            copper: Number(reward?.copper || 0),
            silver: Number(reward?.silver || 0),
            gold: Number(reward?.gold || 0),
            diamond: Number(reward?.diamond || 0)
        });
        const copperTotal = walletToCopper(safe);
        if (copperTotal <= 0) return;
        this.addWalletCopper(player, copperTotal, sourceLabel);
        this.persistPlayer(player);
        this.sendInventoryState(player);
    }

    private grantMobCurrency(player: PlayerRuntime, mob: any) {
        const kind = String(mob?.kind || 'normal');
        const rewardByKind: Record<string, Partial<Wallet>> = {
            normal: { copper: 25 },
            elite: { silver: 1, copper: 40 },
            subboss: { silver: 4, copper: 80 },
            boss: { gold: 1, silver: 30 }
        };
        const reward = rewardByKind[kind] || { copper: 20 };
        this.grantCurrency(player, reward, 'Recompensa de mob');
    }

    private computeLootDropPosition(originX: number, originY: number, dropIndex: number, dropTotal: number, mapKey: string) {
        const mapWorld = this.mapService.getMapWorld(mapKey);
        const center = this.projectToWalkable(
            mapKey,
            clamp(Number(originX || 0), 0, mapWorld.width),
            clamp(Number(originY || 0), 0, mapWorld.height)
        );
        if (dropTotal <= 1 || dropIndex <= 0) return center;

        const ringIndex = Math.ceil(Math.sqrt(dropIndex));
        const radius = Math.min(64, Math.max(32, ringIndex * 32));
        const slotInRing = dropIndex - ((ringIndex - 1) * (ringIndex - 1));
        const ringSlots = ringIndex * 4;
        const angle = (Math.PI * 2 * (slotInRing - 1)) / Math.max(1, ringSlots);
        const tx = center.x + Math.cos(angle) * radius;
        const ty = center.y + Math.sin(angle) * radius;
        return this.projectToWalkable(mapKey, tx, ty);
    }

    private pickRandomWeaponTemplate(mapKey: string, mobKind: string) {
        const safeMapKey = String(mapKey || 'forest');
        const safeMobKind = String(mobKind || 'normal');
        if (Math.random() < (safeMobKind === 'normal' ? 0.32 : 0.16)) {
            const materialId = pickMapMaterialTemplateId(safeMapKey);
            const material = BUILTIN_ITEM_TEMPLATE_BY_ID[materialId];
            if (material) return material;
        }
        return pickProgressionLootTemplate(safeMapKey, safeMobKind) || WEAPON_TEMPLATE;
    }

    private dropWeaponAt(
        x: number,
        y: number,
        mapId: string,
        template: any = WEAPON_TEMPLATE,
        ownerId: number | null = null,
        ownerPartyId: string | null = null,
        reservedMs: number = 0
    ) {
        const now = Date.now();
        this.groundItems.push({
            id: randomUUID(),
            templateId: String(template.id || template.type || 'weapon_teste'),
            type: String(template.type || 'weapon'),
            name: template.name,
            rarity: String(template.rarity || 'branco'),
            quality: String(template.quality || 'normal'),
            spriteId: template.spriteId ? String(template.spriteId) : undefined,
            iconUrl: template.iconUrl ? String(template.iconUrl) : undefined,
            slot: template.slot,
            bonuses: { ...template.bonuses },
            bonusPercents: template.bonusPercents ? { ...template.bonusPercents } : {},
            requiredClass: template.requiredClass ? String(template.requiredClass) : null,
            requiredLevel: Number.isFinite(Number(template.requiredLevel)) ? Number(template.requiredLevel) : null,
            bindingType: template.bindingType ? String(template.bindingType) : 'unbound',
            x,
            y,
            mapId,
            ownerId: Number.isFinite(Number(ownerId)) && Number(ownerId) > 0 ? Number(ownerId) : null,
            ownerPartyId: ownerPartyId ? String(ownerPartyId) : null,
            reservedUntil: reservedMs > 0 ? now + Math.max(1000, Math.floor(reservedMs)) : undefined,
            expiresAt: now + GROUND_ITEM_TTL_MS
        });
    }

    private dropHpPotionAt(
        x: number,
        y: number,
        mapId: string,
        ownerId: number | null = null,
        ownerPartyId: string | null = null,
        reservedMs: number = 0
    ) {
        const now = Date.now();
        this.groundItems.push({
            id: randomUUID(),
            templateId: String(HP_POTION_TEMPLATE.id || HP_POTION_TEMPLATE.type || 'potion_hp'),
            type: String(HP_POTION_TEMPLATE.type || 'potion_hp'),
            name: HP_POTION_TEMPLATE.name,
            rarity: String(HP_POTION_TEMPLATE.rarity || 'branco'),
            quality: String(HP_POTION_TEMPLATE.quality || 'normal'),
            spriteId: HP_POTION_TEMPLATE.spriteId ? String(HP_POTION_TEMPLATE.spriteId) : undefined,
            iconUrl: HP_POTION_TEMPLATE.iconUrl ? String(HP_POTION_TEMPLATE.iconUrl) : undefined,
            slot: HP_POTION_TEMPLATE.slot,
            bonuses: {},
            bonusPercents: {},
            quantity: 1,
            stackable: Boolean(HP_POTION_TEMPLATE.stackable ?? true),
            maxStack: Number(HP_POTION_TEMPLATE.maxStack || 250),
            healPercent: Number(HP_POTION_TEMPLATE.healPercent || 0.5),
            x,
            y,
            mapId,
            ownerId: Number.isFinite(Number(ownerId)) && Number(ownerId) > 0 ? Number(ownerId) : null,
            ownerPartyId: ownerPartyId ? String(ownerPartyId) : null,
            reservedUntil: reservedMs > 0 ? now + Math.max(1000, Math.floor(reservedMs)) : undefined,
            expiresAt: now + GROUND_ITEM_TTL_MS
        } as any);
    }

    private dropSkillResetHourglassAt(
        x: number,
        y: number,
        mapId: string,
        ownerId: number | null = null,
        ownerPartyId: string | null = null,
        reservedMs: number = 0
    ) {
        const now = Date.now();
        this.groundItems.push({
            id: randomUUID(),
            templateId: String(SKILL_RESET_HOURGLASS_TEMPLATE.id || SKILL_RESET_HOURGLASS_TEMPLATE.type || 'skill_reset_hourglass'),
            type: SKILL_RESET_HOURGLASS_TEMPLATE.type,
            name: SKILL_RESET_HOURGLASS_TEMPLATE.name,
            rarity: String(SKILL_RESET_HOURGLASS_TEMPLATE.rarity || 'roxo'),
            quality: String(SKILL_RESET_HOURGLASS_TEMPLATE.quality || 'normal'),
            spriteId: SKILL_RESET_HOURGLASS_TEMPLATE.spriteId ? String(SKILL_RESET_HOURGLASS_TEMPLATE.spriteId) : undefined,
            iconUrl: SKILL_RESET_HOURGLASS_TEMPLATE.iconUrl ? String(SKILL_RESET_HOURGLASS_TEMPLATE.iconUrl) : undefined,
            slot: SKILL_RESET_HOURGLASS_TEMPLATE.slot,
            bonuses: {},
            bonusPercents: {},
            quantity: 1,
            stackable: Boolean(SKILL_RESET_HOURGLASS_TEMPLATE.stackable),
            maxStack: Number(SKILL_RESET_HOURGLASS_TEMPLATE.maxStack || 250),
            x,
            y,
            mapId,
            ownerId: Number.isFinite(Number(ownerId)) && Number(ownerId) > 0 ? Number(ownerId) : null,
            ownerPartyId: ownerPartyId ? String(ownerPartyId) : null,
            reservedUntil: reservedMs > 0 ? now + Math.max(1000, Math.floor(reservedMs)) : undefined,
            expiresAt: now + GROUND_ITEM_TTL_MS
        } as any);
    }

    private addItemToInventory(player: PlayerRuntime, item: any, quantity: number) {
        return this.inventoryService.addItemToInventory(player, item, quantity);
    }

    private dropTemplateAt(
        x: number,
        y: number,
        mapId: string,
        templateId: string,
        ownerId: number | null = null,
        ownerPartyId: string | null = null,
        reservedMs: number = 0
    ) {
        const template = BUILTIN_ITEM_TEMPLATE_BY_ID[String(templateId || '')];
        if (!template) return;
        const type = String(template.type || '');
        if (type === 'weapon' || type === 'equipment') {
            this.dropWeaponAt(x, y, mapId, template, ownerId, ownerPartyId, reservedMs);
            return;
        }
        if (type === 'potion_hp') {
            this.dropHpPotionAt(x, y, mapId, ownerId, ownerPartyId, reservedMs);
            return;
        }
        if (type === 'skill_reset_hourglass') {
            this.dropSkillResetHourglassAt(x, y, mapId, ownerId, ownerPartyId, reservedMs);
            return;
        }
        this.dropWeaponAt(x, y, mapId, template, ownerId, ownerPartyId, reservedMs);
    }

    private grantRewardItem(player: PlayerRuntime, templateId: string, quantity: number) {
        const qty = Math.max(0, Math.floor(Number(quantity || 0)));
        if (qty <= 0) return 0;
        const key = String(templateId || '');
        if (!key) return qty;
        const template = key === 'potion_hp'
            ? HP_POTION_TEMPLATE
            : BUILTIN_ITEM_TEMPLATE_BY_ID[key];
        if (!template) return qty;
        const baseItem = {
            ...template,
            id: randomUUID()
        };
        const remaining = this.addItemToInventory(player, baseItem, qty);
        this.sendInventoryState(player);
        return remaining;
    }

    private onItemCollected(player: PlayerRuntime, templateId: string, quantity: number) {
        this.questService.onItemCollected(player, templateId, quantity);
    }

    private pruneExpiredGroundItems(now: number) {
        this.groundItems = this.groundItems.filter((item) => {
            if (typeof item.expiresAt !== 'number') return true;
            return item.expiresAt > now;
        });
    }

    private removeGroundItemsByMapInstance(mapInstanceId: string) {
        this.groundItems = this.groundItems.filter((item) => String(item.mapId || '') !== String(mapInstanceId || ''));
    }

    private getAreaIdForPlayer(player: PlayerRuntime) {
        return this.mapService.getAreaIdForPlayer(player);
    }

    private sendPartyStateToPlayer(player: PlayerRuntime, party: Party | null) {
        this.partyService.sendPartyStateToPlayer(player, party);
    }

    private syncAllPartyStates() {
        this.partyService.syncAllPartyStates();
    }

    private sendPartyAreaList(player: PlayerRuntime) {
        this.partyService.sendPartyAreaList(player);
    }

    private pruneExpiredPartyInvites(now: number) {
        this.partyService.pruneExpiredPartyInvites(now);
    }

    private pruneExpiredPartyJoinRequests(now: number) {
        this.partyService.pruneExpiredPartyJoinRequests(now);
    }

    private clearPendingInvitesForPlayer(playerId: number) {
        this.partyService.clearPendingInvitesForPlayer(playerId);
    }

    private clearJoinRequestsForPlayer(playerId: number) {
        this.partyService.clearJoinRequestsForPlayer(playerId);
    }

    private clearJoinRequestsForParty(partyId: string) {
        this.partyService.clearJoinRequestsForParty(partyId);
    }

    private pruneExpiredFriendRequests(now: number) {
        void this.friendService.pruneExpiredFriendRequests(now).catch((error) => {
            logEvent('ERROR', 'friend_prune_error', { error: String(error) });
        });
    }

    private clearFriendRequestsForPlayer(playerId: number) {
        this.friendService.clearFriendRequestsForPlayer(playerId);
    }

    private async pruneExpiredGuildInvites(now: number) {
        await this.guildService.pruneExpiredInvites(now);
    }

    private async clearGuildInvitesForPlayer(playerId: number) {
        await this.guildService.clearInvitesForPlayer(playerId);
    }

    private findOnlinePlayerByName(rawName: string) {
        const needle = String(rawName || '').trim().toLowerCase();
        if (!needle) return null;
        return [...this.players.values()].find((candidate) => {
            const byName = String(candidate.name || '').toLowerCase() === needle;
            const byUsername = String(candidate.username || '').toLowerCase() === needle;
            return byName || byUsername;
        }) || null;
    }

    private resolveAdminTarget(actor: PlayerRuntime, rawName?: string) {
        const hasName = String(rawName || '').trim().length > 0;
        if (!hasName) return actor;
        return this.findOnlinePlayerByName(String(rawName || ''));
    }

    private sendFriendState(player: PlayerRuntime) {
        this.friendService.sendFriendState(player);
    }

    private async hydrateFriendStateForPlayer(player: PlayerRuntime) {
        await this.friendService.hydrateFriendStateForPlayer(player);
    }

    private async hydrateGuildStateForPlayer(player: PlayerRuntime) {
        await this.guildService.hydrateGuildStateForPlayer(player);
    }

    private async sendGuildState(player: PlayerRuntime) {
        await this.guildService.sendGuildState(player);
    }

    private removePlayerFromParty(player: PlayerRuntime) {
        this.partyService.removePlayerFromParty(player);
    }

    private normalizeClassId(rawClass: any): string {
        const key = String(rawClass || '').toLowerCase();
        if (key === 'shifter') return 'druid';
        if (key === 'bandit') return 'assassin';
        if (key === 'cavaleiro') return 'knight';
        if (key === 'arqueiro') return 'archer';
        if (key === 'druida') return 'druid';
        if (key === 'assassino') return 'assassin';
        if (CLASS_TEMPLATES[key as keyof typeof CLASS_TEMPLATES]) return key;
        return 'knight';
    }

    private buildClassBaseStats(classId: string, baseFromProfile?: any) {
        const hasPrimary = Boolean(
            baseFromProfile
            && typeof baseFromProfile === 'object'
            && ['str', 'int', 'dex', 'vit'].every((k) => Number.isFinite(Number(baseFromProfile[k])))
        );
        const source = hasPrimary
            ? baseFromProfile
            : CLASS_TEMPLATES[this.normalizeClassId(classId) as keyof typeof CLASS_TEMPLATES] || CLASS_TEMPLATES.knight;
        return {
            str: Number.isFinite(Number(source.str)) ? Number(source.str) : 8,
            int: Number.isFinite(Number(source.int)) ? Number(source.int) : 8,
            dex: Number.isFinite(Number(source.dex)) ? Number(source.dex) : 8,
            vit: Number.isFinite(Number(source.vit)) ? Number(source.vit) : 8,
            initialHp: Number.isFinite(Number(source.initialHp)) ? Number(source.initialHp) : 120,
            moveSpeed: Number.isFinite(Number(source.moveSpeed)) ? Number(source.moveSpeed) : 100,
            attackSpeed: Number.isFinite(Number(source.attackSpeed)) ? Number(source.attackSpeed) : 100,
            attackRange: Number.isFinite(Number(source.attackRange)) ? Number(source.attackRange) : 60,
            damageType: String(source.damageType || 'physical') === 'magic' ? 'magic' : 'physical'
        };
    }

    private primaryToLegacyKey(primary: PrimaryStat) {
        if (primary === 'str') return 'physicalAttack';
        if (primary === 'int') return 'magicAttack';
        if (primary === 'vit') return 'physicalDefense';
        return 'magicDefense';
    }

    private maxSpendablePointsByLevel(level: number) {
        return Math.max(0, (Math.max(1, Number(level || 1)) - 1) * 5);
    }

    private getAllocatedTotal(allocated: Record<PrimaryStat, number>) {
        return PRIMARY_STATS.reduce((sum, key) => sum + Number(allocated[key] || 0), 0);
    }

    private getAllocatedCost(allocated: Record<PrimaryStat, number>) {
        let total = 0;
        for (const key of PRIMARY_STATS) {
            const amount = Math.max(0, Math.floor(Number(allocated[key] || 0)));
            total += amount * BASE_POINT_COST;
        }
        return total;
    }

    private getAllocationCost(current: Record<PrimaryStat, number>, incoming: Record<PrimaryStat, number>) {
        let total = 0;
        for (const key of PRIMARY_STATS) {
            const add = Math.max(0, Math.floor(Number(incoming[key] || 0)));
            total += add * BASE_POINT_COST;
        }
        return total;
    }

    private enforceAllocationBudget(input: Record<PrimaryStat, number>, maxCost: number) {
        const next: Record<PrimaryStat, number> = { ...input };
        if (this.getAllocatedCost(next) <= maxCost) return next;
        const downOrder: PrimaryStat[] = ['dex', 'int', 'str', 'vit'];
        while (this.getAllocatedCost(next) > maxCost) {
            let reduced = false;
            for (const key of downOrder) {
                if (next[key] <= 0) continue;
                next[key] -= 1;
                reduced = true;
                if (this.getAllocatedCost(next) <= maxCost) break;
            }
            if (!reduced) break;
        }
        return next;
    }

    private computeDerivedStats(player: PlayerRuntime) {
        const classId = this.normalizeClassId(player.class);
        const base = this.buildClassBaseStats(classId, player.baseStats);
        player.class = classId;
        player.baseStats = base;
        const allocated = this.normalizeAllocatedStats(player.allocatedStats);

        const str = Number(base.str || 0) + Number(allocated.str || 0);
        const int = Number(base.int || 0) + Number(allocated.int || 0);
        const dex = Number(base.dex || 0) + Number(allocated.dex || 0);
        const vit = Number(base.vit || 0) + Number(allocated.vit || 0);
        const level = Math.max(1, Number(player.level || 1));

        const maxHp = Number(base.initialHp || 100) + Math.max(0, (vit - Number(base.vit || 0))) * 15 + (level - 1) * 5;
        const physicalAttack = str * 2;
        const magicAttack = int * 3;
        const physicalDefense = str * 0.5 + vit * 1.2;
        const magicDefense = int * 0.8 + vit * 0.5;
        const accuracy = dex * 1.5;
        const evasion = dex * 0.8;
        const criticalChance = Math.max(0, dex * 0.0002);
        const luck = level / 2 + dex / 10;

        return {
            str,
            int,
            dex,
            vit,
            physicalAttack,
            magicAttack,
            physicalDefense,
            magicDefense,
            accuracy,
            evasion,
            criticalChance,
            luck,
            moveSpeed: Number(base.moveSpeed || 100),
            attackSpeed: Number(base.attackSpeed || 100),
            attackRange: Number(base.attackRange || 60),
            damageType: String(base.damageType || 'physical') === 'magic' ? 'magic' : 'physical',
            maxHp
        };
    }

    private computeDamageReduction(defense: number, level: number) {
        const safeDefense = Math.max(0, Number(defense || 0));
        const safeLevel = Math.max(1, Number(level || 1));
        const k = 400 + safeLevel * 50;
        return safeDefense / (safeDefense + k);
    }

    private computeDamageAfterMitigation(rawDamage: number, defense: number, targetLevel: number) {
        const safeRaw = Math.max(1, Number(rawDamage || 1));
        const reduction = this.computeDamageReduction(defense, targetLevel);
        return Math.max(1, Math.floor(safeRaw * (1 - reduction)));
    }

    private computeHitChance(attackerAccuracy: number, defenderEvasion: number) {
        const acc = Math.max(1, Number(attackerAccuracy || 1));
        const eva = Math.max(0, Number(defenderEvasion || 0));
        const base = 0.85 + ((acc - eva) / (acc + eva));
        return clamp(base, 0.05, 0.98);
    }

    private getEntityLuck(entity: any) {
        if (!entity) return 0;
        const level = Math.max(1, Number(entity.level || 1));
        if (entity.stats && typeof entity.stats === 'object') return Number(entity.stats.luck || 0);
        const dex = Math.max(0, Number(entity.dex || 0));
        return level / 2 + dex / 10;
    }

    private shouldLuckyStrike(attacker: any, defender: any) {
        const atkLuck = this.getEntityLuck(attacker);
        const defLuck = this.getEntityLuck(defender);
        if (atkLuck < defLuck * 2) return false;
        return Math.random() < LUCKY_STRIKE_CHANCE;
    }

    private getMobEvasion(mob: any) {
        return mob?.kind === 'boss' ? 16 : mob?.kind === 'subboss' ? 11 : mob?.kind === 'elite' ? 8 : 5;
    }

    private persistPlayer(player: PlayerRuntime) {
        this.preparePlayerForSave(player);
        this.markPlayerDirty(player.id);
    }

    private persistPlayerCritical(player: PlayerRuntime, reason: string = 'critical') {
        this.preparePlayerForSave(player);
        this.markPlayerDirty(player.id);
        void this.persistPlayerNow(player, reason);
    }

    async flushAllPlayers(reason: string = 'shutdown') {
        for (const playerId of this.players.keys()) {
            this.markPlayerDirty(playerId);
        }
        await this.flushDirtyPlayers(reason, true);
    }

    async processPersistenceQueue(limit: number = 20) {
        return await this.persistence.processPendingPlayerSaveJobs(limit);
    }

    private async flushAutosavePlayers() {
        for (const playerId of this.players.keys()) {
            this.markPlayerDirty(playerId);
        }
        await this.flushDirtyPlayers('autosave', false);
    }

    private async flushDirtyPlayers(reason: string, force: boolean = false) {
        if (this.autosaveInFlight && !force) return;
        this.autosaveInFlight = true;
        try {
            const dirtyIds = [...this.dirtyPlayerIds.values()];
            for (const playerId of dirtyIds) {
                const player = this.players.get(playerId);
                if (!player) {
                    this.dirtyPlayerIds.delete(playerId);
                    continue;
                }
                await this.persistPlayerNow(player, reason, force);
            }
            if (reason === 'autosave') {
                logEvent('INFO', 'autosave_cycle', {
                    online: this.players.size,
                    dirty: dirtyIds.length,
                    enqueued: this.persistStats.enqueued,
                    saved: this.persistStats.saved,
                    skipped: this.persistStats.skipped,
                    failed: this.persistStats.failed,
                    retried: this.persistStats.retried
                });
            }
        } finally {
            this.autosaveInFlight = false;
        }
    }

    private async persistPlayerNow(player: PlayerRuntime, reason: string, forceSave: boolean = false) {
        const playerId = Number(player.id);
        if (!Number.isFinite(playerId) || playerId <= 0) return;
        if (this.persistInFlightByPlayerId.has(playerId)) return;
        const lockKey = `lock:player:save:${playerId}`;
        const lockToken = await this.lockService.acquire(lockKey, 5000);
        if (!lockToken) {
            this.dirtyPlayerIds.add(playerId);
            return;
        }
        this.persistInFlightByPlayerId.add(playerId);
        this.preparePlayerForSave(player);
        const saveRevision = Number(this.persistRevisionByPlayerId.get(playerId) || 0);
        let saveOk = false;
        let shouldEnqueueFallback = false;
        this.persistStats.enqueued += 1;
        try {
            const signature = this.computePersistenceSignature(player);
            const previousSignature = this.lastPersistSignatureByPlayerId.get(playerId);
            if (!forceSave && previousSignature === signature) {
                this.persistStats.skipped += 1;
                this.dirtyPlayerIds.delete(playerId);
                return;
            }

            let attempt = 0;
            while (true) {
                try {
                    const result = await this.persistence.savePlayer(player, {
                        expectedVersion: Number(player.persistenceVersion || 0),
                        useOptimisticLock: true
                    });
                    if (!result.ok && result.conflict) {
                        player.persistenceVersion = Number(result.version || player.persistenceVersion || 0);
                        throw new Error('player_version_conflict');
                    }
                    player.persistenceVersion = Number(result.version || player.persistenceVersion || 0);
                    this.lastPersistSignatureByPlayerId.set(playerId, signature);
                    break;
                } catch (error) {
                    if (attempt >= PERSIST_MAX_RETRIES) throw error;
                    attempt += 1;
                    this.persistStats.retried += 1;
                    const backoffMs = PERSIST_RETRY_BASE_MS * (2 ** (attempt - 1));
                    await this.sleep(backoffMs);
                }
            }
            saveOk = true;
            this.persistStats.saved += 1;
            const currentRevision = Number(this.persistRevisionByPlayerId.get(playerId) || 0);
            if (currentRevision === saveRevision) {
                this.dirtyPlayerIds.delete(playerId);
            }
        } catch (error) {
            this.dirtyPlayerIds.add(playerId);
            this.persistStats.failed += 1;
            shouldEnqueueFallback = true;
            logEvent('ERROR', 'save_player_error', { playerId: player.id, reason, error: String(error) });
        } finally {
            this.persistInFlightByPlayerId.delete(playerId);
            await this.lockService.release(lockKey, lockToken);
            if (shouldEnqueueFallback) {
                try {
                    await this.persistence.enqueuePlayerSave(player, String(reason || 'save_failure'));
                } catch (queueError) {
                    logEvent('ERROR', 'enqueue_player_save_error', { playerId: player.id, reason, error: String(queueError) });
                }
            }
            if (saveOk && this.dirtyPlayerIds.has(playerId)) {
                void this.persistPlayerNow(player, `${reason}:followup`, forceSave);
            }
        }
    }

    private markPlayerDirty(playerId: number) {
        const next = Number(this.persistRevisionByPlayerId.get(playerId) || 0) + 1;
        this.persistRevisionByPlayerId.set(playerId, next);
        this.dirtyPlayerIds.add(playerId);
    }

    private computePersistenceSignature(player: PlayerRuntime) {
        const wallet = normalizeWallet(player.wallet);
        const inventory = Array.isArray(player.inventory)
            ? player.inventory.map((item: any) => ({
                id: String(item?.id || ''),
                templateId: String(item?.templateId || ''),
                type: String(item?.type || ''),
                quantity: Number(item?.quantity || 0),
                slotIndex: Number(item?.slotIndex || 0),
                equipped: Boolean(item?.equipped),
                equippedSlot: String(item?.equippedSlot || '')
            }))
            : [];
        const statusOverrides = player.statusOverrides && typeof player.statusOverrides === 'object'
            ? player.statusOverrides
            : {};
        return JSON.stringify({
            level: Number(player.level || 1),
            xp: Number(player.xp || 0),
            hp: Number(player.hp || 0),
            maxHp: Number(player.maxHp || 0),
            role: String(player.role || 'player'),
            pvpMode: String(player.pvpMode || 'peace'),
            mapKey: String(player.mapKey || ''),
            mapId: String(player.mapId || ''),
            x: Number(player.x || 0),
            y: Number(player.y || 0),
            equippedWeaponId: String(player.equippedWeaponId || ''),
            wallet,
            stats: player.stats || {},
            allocatedStats: player.allocatedStats || {},
            unspentPoints: Number(player.unspentPoints || 0),
            statusOverrides,
            inventory
        });
    }

    private sleep(ms: number) {
        return new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));
    }

    private preparePlayerForSave(player: PlayerRuntime) {
        if (!player.statusOverrides || typeof player.statusOverrides !== 'object') player.statusOverrides = {};
        player.statusOverrides.__skillLevels = this.normalizeSkillLevels(player.skillLevels || {});
    }

    private normalizeAllocatedStats(input: any): Record<PrimaryStat, number> {
        const source = input && typeof input === 'object' ? input : {};
        const toInt = (v: any) => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);
        const str = toInt(source.str ?? source.for ?? source.physicalAttack);
        const int = toInt(source.int ?? source.magicAttack);
        const dex = toInt(source.dex ?? source.des ?? source.magicDefense);
        const vit = toInt(source.vit ?? source.physicalDefense);
        return {
            str,
            int,
            dex,
            vit
        };
    }

    private normalizeSkillLevels(input: any): Record<string, number> {
        const src = input && typeof input === 'object' ? input : {};
        const out: Record<string, number> = {};
        for (const [skillId, raw] of Object.entries(src)) {
            if (!SKILL_DEFS[String(skillId)]) continue;
            const lvl = Math.max(0, Math.min(5, Math.floor(Number(raw || 0))));
            if (lvl > 0) out[String(skillId)] = lvl;
        }
        return out;
    }

    private getSpentSkillPoints(player: PlayerRuntime) {
        const levels = this.normalizeSkillLevels(player.skillLevels || {});
        return Object.values(levels).reduce((sum, lvl) => sum + Math.max(0, Number(lvl || 0)), 0);
    }

    private getAvailableSkillPoints(player: PlayerRuntime) {
        const level = Math.max(1, Math.floor(Number(player.level || 1)));
        const earned = Math.max(0, level - 1);
        const spent = this.getSpentSkillPoints(player);
        return Math.max(0, earned - spent);
    }

    private getSkillLevel(player: PlayerRuntime, skillId: string) {
        const levels = this.normalizeSkillLevels(player.skillLevels || {});
        return Math.max(0, Math.min(5, Number(levels[skillId] || 0)));
    }

    private getSkillPrerequisite(skillId: string) {
        for (const chain of Object.values(SKILL_CHAINS)) {
            const idx = chain.indexOf(skillId);
            if (idx <= 0) continue;
            return chain[idx - 1];
        }
        return null;
    }

    private getSkillRequiredLevel(skillId: string) {
        for (const chain of Object.values(SKILL_CHAINS)) {
            const idx = chain.indexOf(skillId);
            if (idx < 0) continue;
            return Number(SKILL_UNLOCK_LEVELS[idx] || 1);
        }
        return 1;
    }

    private getSkillPowerWithLevel(skill: SkillDef, level: number) {
        const safeLevel = Math.max(1, Math.min(5, Number(level || 1)));
        const base = Number(skill.power || 1);
        const explicitStep = Number(skill.powerStep || 0);
        if (explicitStep > 0) return base + explicitStep * (safeLevel - 1);
        return base * (1 + (safeLevel - 1) * 0.18);
    }

    private sendStatsUpdated(player: PlayerRuntime) {
        this.sendRaw(player.ws, {
            type: 'player.statsUpdated',
            stats: player.stats,
            allocatedStats: this.normalizeAllocatedStats(player.allocatedStats),
            skillLevels: this.normalizeSkillLevels(player.skillLevels || {}),
            skillCooldowns: this.serializeSkillCooldowns(player),
            activeSkillEffects: this.serializeActiveSkillEffects(player),
            skillPointsAvailable: this.getAvailableSkillPoints(player),
            unspentPoints: Number.isInteger(player.unspentPoints) ? player.unspentPoints : 0,
            level: player.level,
            xp: player.xp,
            xpToNext: xpRequired(player.level),
            hp: player.hp,
            maxHp: player.maxHp,
            wallet: normalizeWallet(player.wallet)
        });
    }

    private sendRaw(ws: any, payload: any) {
        try {
            ws?.send(JSON.stringify(payload));
        } catch (error) {
            logEvent('ERROR', 'send_raw_failed', {
                type: String(payload?.type || 'unknown'),
                error: String(error)
            });
        }
    }

    private sendDebugStep(ws: DebugSocket | null | undefined, step: string) {
        try {
            ws?.send(JSON.stringify({
                type: 'debug.step',
                step: String(step || ''),
                at: Date.now()
            }));
        } catch (error) {
            logEvent('ERROR', 'send_debug_step_failed', {
                step: String(step || ''),
                error: String(error)
            });
        }
    }

    private sendDebugPacket(ws: DebugSocket | null | undefined, order: number, packetType: string) {
        try {
            ws?.send(JSON.stringify({
                type: 'debug.packet',
                order: Number(order || 0),
                packetType: String(packetType || ''),
                at: Date.now()
            }));
        } catch (error) {
            logEvent('ERROR', 'send_debug_packet_failed', {
                order: Number(order || 0),
                packetType: String(packetType || ''),
                error: String(error)
            });
        }
    }

    private broadcastRaw(payload: any) {
        for (const player of this.players.values()) {
            this.sendRaw(player.ws, payload);
        }
    }

    private broadcastMapInstance(mapKey: string, mapId: string, payload: any) {
        for (const player of this.players.values()) {
            if (player.mapKey !== mapKey || player.mapId !== mapId) continue;
            this.sendRaw(player.ws, payload);
        }
    }
}

