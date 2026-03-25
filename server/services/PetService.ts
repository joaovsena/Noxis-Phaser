import { getPetTemplate, type PetTemplate } from '../content/petCatalog';
import type { PetBehavior, PetOwnershipRecord, PetRuntime, PlayerRuntime } from '../models/types';

type SendRawFn = (ws: any, payload: any) => void;
type ResolveMobFn = (owner: PlayerRuntime, mobId: string) => any | null;
type ApplyDamageFn = (owner: PlayerRuntime, mob: any, damage: number, now: number) => void;
type SendStatsUpdatedFn = (owner: PlayerRuntime) => void;

export class PetService {
    private readonly activePetsByOwnershipId = new Map<string, PetRuntime>();

    constructor(
        private readonly players: Map<number, PlayerRuntime>,
        private readonly persistence: {
            ensureStarterPetsForPlayer: (playerId: number) => Promise<void>;
            getPetsForPlayer: (playerId: number) => Promise<any[]>;
            getActivePetForPlayer: (playerId: number) => Promise<any>;
            setActivePet: (playerId: number, petOwnershipId: string, behavior?: string) => Promise<any>;
            clearActivePet: (playerId: number) => Promise<void>;
            updatePetOwnership: (ownershipId: string, patch: { name?: string; loyalty?: number; hunger?: number; xp?: number; level?: number }) => Promise<any>;
        },
        private readonly sendRaw: SendRawFn,
        private readonly resolveMob: ResolveMobFn,
        private readonly applyDamageToMob: ApplyDamageFn,
        private readonly sendStatsUpdated: SendStatsUpdatedFn
    ) {}

    async hydratePetsForPlayer(player: PlayerRuntime) {
        await this.persistence.ensureStarterPetsForPlayer(player.id);
        const [ownerships, activeBinding] = await Promise.all([
            this.persistence.getPetsForPlayer(player.id),
            this.persistence.getActivePetForPlayer(player.id)
        ]);
        player.petOwnerships = ownerships
            .map((entry) => this.serializeOwnership(entry))
            .filter((entry): entry is PetOwnershipRecord => Boolean(entry));
        player.activePetOwnershipId = activeBinding?.petOwnershipId ? String(activeBinding.petOwnershipId) : null;
        player.petBehavior = this.normalizeBehavior(activeBinding?.behavior);

        if (!player.activePetOwnershipId) {
            this.clearForPlayer(player.id);
            return;
        }

        const activeOwnership = ownerships.find((entry) => String(entry?.id || '') === String(player.activePetOwnershipId || ''));
        if (!activeOwnership) {
            player.activePetOwnershipId = null;
            this.clearForPlayer(player.id);
            await this.persistence.clearActivePet(player.id);
            return;
        }
        this.spawnOrUpdateRuntimePet(player, activeOwnership);
    }

    async sendState(player: PlayerRuntime) {
        this.sendRaw(player.ws, this.buildOwnerState(player));
    }

    async handleSummon(player: PlayerRuntime, msg: any) {
        const ownershipId = String(msg?.petOwnershipId || '').trim();
        if (!ownershipId) return;
        const ownedPet = (player.petOwnerships || []).find((entry) => String(entry.id || '') === ownershipId) || null;
        if (!ownedPet) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Pet nao encontrado para esse personagem.' });
            return;
        }
        await this.persistence.setActivePet(player.id, ownershipId, player.petBehavior || 'assist');
        player.activePetOwnershipId = ownershipId;
        this.spawnOrUpdateRuntimePet(player, ownedPet);
        await this.sendState(player);
    }

    async handleUnsummon(player: PlayerRuntime) {
        player.activePetOwnershipId = null;
        await this.persistence.clearActivePet(player.id);
        this.clearForPlayer(player.id);
        await this.sendState(player);
    }

    async handleFeed(player: PlayerRuntime, msg: any) {
        const ownershipId = String(msg?.petOwnershipId || player.activePetOwnershipId || '').trim();
        if (!ownershipId) return;
        const ownedPet = (player.petOwnerships || []).find((entry) => String(entry.id || '') === ownershipId) || null;
        if (!ownedPet) return;
        const nextHunger = Math.min(100, Number(ownedPet.hunger || 0) + 24);
        const nextLoyalty = Math.min(100, Number(ownedPet.loyalty || 0) + 6);
        const updated = await this.persistence.updatePetOwnership(ownershipId, {
            hunger: nextHunger,
            loyalty: nextLoyalty
        });
        this.applyUpdatedOwnership(player, updated);
        const runtimePet = this.activePetsByOwnershipId.get(ownershipId);
        if (runtimePet) {
            runtimePet.hunger = Math.max(0, Math.min(100, Number(updated?.hunger || nextHunger)));
            runtimePet.loyalty = Math.max(0, Math.min(100, Number(updated?.loyalty || nextLoyalty)));
        }
        await this.sendState(player);
    }

    async handleRename(player: PlayerRuntime, msg: any) {
        const ownershipId = String(msg?.petOwnershipId || '').trim();
        const name = String(msg?.name || '').trim().slice(0, 24);
        if (!ownershipId || !name) return;
        const ownedPet = (player.petOwnerships || []).find((entry) => String(entry.id || '') === ownershipId) || null;
        if (!ownedPet) return;
        const updated = await this.persistence.updatePetOwnership(ownershipId, { name });
        this.applyUpdatedOwnership(player, updated);
        const runtimePet = this.activePetsByOwnershipId.get(ownershipId);
        if (runtimePet) runtimePet.name = String(updated?.name || name);
        await this.sendState(player);
    }

    async handleSetBehavior(player: PlayerRuntime, msg: any) {
        const behavior = this.normalizeBehavior(msg?.behavior);
        player.petBehavior = behavior;
        if (player.activePetOwnershipId) {
            await this.persistence.setActivePet(player.id, String(player.activePetOwnershipId || ''), behavior);
            const runtimePet = this.activePetsByOwnershipId.get(String(player.activePetOwnershipId || ''));
            if (runtimePet) runtimePet.behavior = behavior;
        }
        await this.sendState(player);
    }

    clearForPlayer(playerId: number) {
        for (const [ownershipId, pet] of this.activePetsByOwnershipId.entries()) {
            if (Number(pet.ownerPlayerId || 0) !== Number(playerId || 0)) continue;
            this.activePetsByOwnershipId.delete(ownershipId);
        }
    }

    getPetsByMap(mapKey: string, mapId: string) {
        return Array.from(this.activePetsByOwnershipId.values()).filter((pet) =>
            String(pet.mapKey || '') === String(mapKey || '') && String(pet.mapId || '') === String(mapId || '')
        );
    }

    tick(deltaSeconds: number, now: number) {
        const blend = Math.max(0.08, Math.min(0.45, deltaSeconds * 4.5));
        for (const pet of this.activePetsByOwnershipId.values()) {
            const owner = this.players.get(Number(pet.ownerPlayerId || 0));
            if (!owner) continue;

            pet.mapKey = owner.mapKey;
            pet.mapId = owner.mapId;
            const template = getPetTemplate(pet.templateId);
            if (!template) continue;
            const anchor = this.getFollowAnchor(owner, template);
            pet.x += (anchor.x - pet.x) * blend;
            pet.y += (anchor.y - pet.y) * blend;

            if (pet.behavior === 'passive' || owner.dead || owner.hp <= 0) continue;

            if (pet.role === 'support') {
                this.tickSupportPet(owner, pet, template, now);
                continue;
            }

            if (pet.role === 'defensive') {
                this.tickDefensivePet(owner, pet, template, now);
                continue;
            }

            this.tickOffensivePet(owner, pet, template, now);
        }
    }

    private tickOffensivePet(owner: PlayerRuntime, pet: PetRuntime, template: PetTemplate, now: number) {
        if (now - pet.lastActionAt < template.cadenceMs) return;
        const targetMobId = String(owner.attackTargetId || '').trim();
        if (!targetMobId) return;
        const targetMob = this.resolveMob(owner, targetMobId);
        if (!targetMob || Number(targetMob.hp || 0) <= 0) return;
        const dx = Number(targetMob.x || 0) - Number(owner.x || 0);
        const dy = Number(targetMob.y || 0) - Number(owner.y || 0);
        if (Math.hypot(dx, dy) > template.leashRange) return;
        const damage = Math.max(8, Math.round(template.baseDamage + owner.level * 1.4 + pet.level * 1.8));
        pet.lastActionAt = now;
        this.applyDamageToMob(owner, targetMob, damage, now);
    }

    private tickSupportPet(owner: PlayerRuntime, pet: PetRuntime, template: PetTemplate, now: number) {
        if (now - pet.lastSupportAt < template.cadenceMs) return;
        if (Number(owner.hp || 0) >= Number(owner.maxHp || 0)) return;
        const healAmount = Math.max(10, Math.round(template.supportPower + owner.level * 2 + Number(owner.maxHp || 0) * 0.035));
        owner.hp = Math.min(Number(owner.maxHp || 1), Number(owner.hp || 0) + healAmount);
        pet.lastSupportAt = now;
        this.sendStatsUpdated(owner);
    }

    private tickDefensivePet(owner: PlayerRuntime, pet: PetRuntime, template: PetTemplate, now: number) {
        if (Number(owner.hp || 0) < Number(owner.maxHp || 0) && now - pet.lastSupportAt >= template.cadenceMs) {
            const healAmount = Math.max(8, Math.round(template.supportPower + owner.level * 1.4 + Number(owner.maxHp || 0) * 0.025));
            owner.hp = Math.min(Number(owner.maxHp || 1), Number(owner.hp || 0) + healAmount);
            pet.lastSupportAt = now;
            this.sendStatsUpdated(owner);
        }
        if (now - pet.lastActionAt < template.cadenceMs + 500) return;
        const targetMobId = String(owner.attackTargetId || '').trim();
        if (!targetMobId) return;
        const targetMob = this.resolveMob(owner, targetMobId);
        if (!targetMob || Number(targetMob.hp || 0) <= 0) return;
        const dx = Number(targetMob.x || 0) - Number(owner.x || 0);
        const dy = Number(targetMob.y || 0) - Number(owner.y || 0);
        if (Math.hypot(dx, dy) > template.leashRange) return;
        const damage = Math.max(5, Math.round(template.baseDamage + owner.level * 0.95 + pet.level * 1.1));
        pet.lastActionAt = now;
        this.applyDamageToMob(owner, targetMob, damage, now);
    }

    private getFollowAnchor(owner: PlayerRuntime, template: PetTemplate) {
        const behaviorOffset = template.moveStyle === 'flying'
            ? { x: template.orbitX, y: template.orbitY }
            : { x: template.orbitX, y: template.orbitY };
        return {
            x: Number(owner.x || 0) + behaviorOffset.x,
            y: Number(owner.y || 0) + behaviorOffset.y
        };
    }

    private spawnOrUpdateRuntimePet(player: PlayerRuntime, ownershipLike: any) {
        const ownership = this.serializeOwnership(ownershipLike);
        if (!ownership) return null;
        this.clearForPlayer(player.id);
        const template = getPetTemplate(ownership.templateId);
        if (!template) return null;
        const runtimePet: PetRuntime = {
            id: `pet:${ownership.id}`,
            ownershipId: ownership.id,
            templateId: ownership.templateId,
            ownerPlayerId: player.id,
            ownerName: String(player.name || 'Aventureiro'),
            name: ownership.name,
            role: ownership.role,
            moveStyle: ownership.moveStyle,
            biomeKey: ownership.biomeKey,
            mapKey: player.mapKey,
            mapId: player.mapId,
            x: Number(player.x || 0) + template.orbitX,
            y: Number(player.y || 0) + template.orbitY,
            hp: Math.max(1, Math.round(template.baseHp + ownership.level * 12)),
            maxHp: Math.max(1, Math.round(template.baseHp + ownership.level * 12)),
            level: ownership.level,
            xp: ownership.xp,
            loyalty: ownership.loyalty,
            hunger: ownership.hunger,
            behavior: player.petBehavior || 'assist',
            lastActionAt: 0,
            lastSupportAt: 0,
            visualSeed: Number(player.id || 0) * 37 + ownership.level * 13
        };
        this.activePetsByOwnershipId.set(runtimePet.ownershipId, runtimePet);
        return runtimePet;
    }

    private buildOwnerState(player: PlayerRuntime) {
        const activeOwnershipId = String(player.activePetOwnershipId || '').trim() || null;
        const runtimePet = activeOwnershipId ? this.activePetsByOwnershipId.get(activeOwnershipId) || null : null;
        return {
            type: 'pet.state',
            ownedPets: Array.isArray(player.petOwnerships) ? player.petOwnerships : [],
            activePetOwnershipId: activeOwnershipId,
            activePetId: runtimePet?.id || null,
            behavior: player.petBehavior || 'assist'
        };
    }

    private applyUpdatedOwnership(player: PlayerRuntime, rawOwnership: any) {
        const serialized = this.serializeOwnership(rawOwnership);
        if (!serialized) return;
        const current = Array.isArray(player.petOwnerships) ? player.petOwnerships : [];
        const next = current.some((entry) => String(entry.id || '') === serialized.id)
            ? current.map((entry) => String(entry.id || '') === serialized.id ? serialized : entry)
            : [...current, serialized];
        player.petOwnerships = next;
    }

    private serializeOwnership(rawOwnership: any): PetOwnershipRecord | null {
        if (!rawOwnership || typeof rawOwnership !== 'object') return null;
        const template = getPetTemplate(String(rawOwnership.templateId || ''));
        if (!template) return null;
        return {
            id: String(rawOwnership.id || ''),
            templateId: String(rawOwnership.templateId || ''),
            name: String(rawOwnership.name || template.name || 'Pet'),
            level: Math.max(1, Number(rawOwnership.level || 1)),
            xp: Math.max(0, Number(rawOwnership.xp || 0)),
            loyalty: Math.max(0, Math.min(100, Number(rawOwnership.loyalty || 0))),
            hunger: Math.max(0, Math.min(100, Number(rawOwnership.hunger || 0))),
            role: template.role,
            moveStyle: template.moveStyle,
            biomeKey: template.biomeKey
        };
    }

    private normalizeBehavior(value: unknown): PetBehavior {
        const normalized = String(value || '').trim().toLowerCase();
        if (normalized === 'follow') return 'follow';
        if (normalized === 'passive') return 'passive';
        return 'assist';
    }
}

