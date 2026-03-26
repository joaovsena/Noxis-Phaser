import { derived, get, writable } from 'svelte/store';
import { bootDiagnostics } from '../../game/debug/BootDiagnostics';
import type { GameStore } from '../../game/state/GameStore';
import type { GameSocket } from '../../game/net/GameSocket';
import { getSkillIconUrl } from '../lib/proceduralSkillIcons';
import { displayItemName } from '../lib/itemTooltip';

type InventoryUiState = {
  inventory: any[];
  equippedBySlot: Record<string, any>;
  wallet: any;
};

type AttributeUiState = {
  player: any | null;
  hpRatio: number;
};

export type ChatChannel = 'system' | 'local' | 'world' | 'whisper' | 'guild' | 'group' | 'trade';
export type ChatInputChannel = Exclude<ChatChannel, 'system'>;

export type ChatUiMessage = {
  id: string;
  player: string;
  content: string;
  channel: ChatChannel;
  timestamp: number;
  targetName?: string | null;
  fromSelf?: boolean;
};

type ChatUiState = {
  messages: ChatUiMessage[];
  activeChannel: ChatInputChannel;
  lastTradeMessage: ChatUiMessage | null;
  lastWhisperTarget: string | null;
};

type NpcUiState = {
  dialog: any | null;
  shopOpen: boolean;
};

type AppUiState = {
  connectionPhase: string;
  authMessage: string;
  selectedCharacterSlot: number | null;
  characterSlots: any[];
  playerId: number | null;
};

type WorldUiState = {
  world: any | null;
  player: any | null;
  mapCode: string;
  mapId: string;
  coordsText: string;
};

type QuestUiState = {
  quests: any[];
};

type PartyUiState = {
  party: any | null;
  areaList: any[];
  invites: any[];
  joinRequests: any[];
  dungeonReady: any | null;
};

type FriendUiState = {
  state: any | null;
};

type TradeUiState = {
  state: any | null;
};

type StorageUiState = {
  state: any | null;
};

type GuildUiState = {
  state: any | null;
};

type PetUiState = {
  state: any | null;
};

type AdminUiState = {
  result: any | null;
  isAdmin: boolean;
  pingMs: number | null;
  socketConnected: boolean;
  pathDebugEnabled: boolean;
  interactionDebugEnabled: boolean;
  mobPeacefulEnabled: boolean;
};

type LoadingUiState = {
  active: boolean;
  progress: number;
  title: string;
  detail: string;
  pendingWorldEntry: boolean;
  ready: boolean;
};

type LoadingPacketState = {
  authSuccess: string | null;
  worldStatic: string | null;
  worldState: string | null;
  inventoryState: string | null;
  announcedPacket: string | null;
  wsOpen: string | null;
  wsError: string | null;
  wsClose: string | null;
  lastPacket: string | null;
};

type LoadingDebugSnapshot = {
  savedAt: string;
  phase: string;
  playerId: number | null;
  mapCode: string;
  mapId: string;
  socketConnected: boolean;
  loading: LoadingUiState;
  packets: LoadingPacketState;
  trace: string[];
};

type TooltipUiState = {
  visible: boolean;
  x: number;
  y: number;
  payload: any | null;
};

type MapSettingsUiState = {
  open: boolean;
  autoAttackEnabled: boolean;
  showPlayers: boolean;
  showMobs: boolean;
  showNpcs: boolean;
  showPortals: boolean;
  showEvents: boolean;
};

type PanelUiState = {
  character: boolean;
  inventory: boolean;
  skills: boolean;
  map: boolean;
  quests: boolean;
  party: boolean;
  friends: boolean;
  guild: boolean;
  pets: boolean;
  trade: boolean;
  storage: boolean;
  admin: boolean;
};

type SelectionUiState = {
  selectedMobId: string | null;
  selectedPlayerId: number | null;
};

type DragPayload =
  | { source: 'inventory'; itemId: string }
  | { source: 'equipment'; itemId: string; slot: string }
  | { source: 'skill'; skillId: string; skillName: string }
  | { source: 'basic'; skillId: 'class_primary'; skillName: string }
  | { source: 'hotbar'; key: string }
  | null;

type SkillTreeNode = {
  id: string;
  classId: string;
  buildKey: 'buildA' | 'buildB';
  buildLabel: string;
  label: string;
  iconUrl: string;
  prereq: string | null;
  maxPoints: number;
  requiredLevel: number;
  summary: string;
  target: 'mob' | 'self';
  cooldownMs: number;
  range?: number;
  role: 'Ataque' | 'Buff' | 'Cura' | 'Controle' | 'Area' | 'Execucao';
};

const HOTBAR_KEYS = ['q', 'w', 'e', 'r', 'a', 's', 'd', 'f', '1', '2', '3', '4', '5', '6', '7', '8'];

const DEFAULT_INVENTORY: InventoryUiState = {
  inventory: [],
  equippedBySlot: {},
  wallet: null
};

const DEFAULT_ATTRIBUTES: AttributeUiState = {
  player: null,
  hpRatio: 0
};

const DEFAULT_CHAT: ChatUiState = {
  messages: [],
  activeChannel: 'local',
  lastTradeMessage: null,
  lastWhisperTarget: null
};

const DEFAULT_NPC: NpcUiState = {
  dialog: null,
  shopOpen: false
};

const DEFAULT_APP: AppUiState = {
  connectionPhase: 'connecting',
  authMessage: '',
  selectedCharacterSlot: null,
  characterSlots: [],
  playerId: null
};

const DEFAULT_WORLD: WorldUiState = {
  world: null,
  player: null,
  mapCode: '-',
  mapId: '-',
  coordsText: 'X: -- | Y: --'
};

const DEFAULT_QUESTS: QuestUiState = {
  quests: []
};

const DEFAULT_PARTY: PartyUiState = {
  party: null,
  areaList: [],
  invites: [],
  joinRequests: [],
  dungeonReady: null
};

const DEFAULT_FRIENDS: FriendUiState = {
  state: null
};

const DEFAULT_TRADE: TradeUiState = {
  state: null
};

const DEFAULT_STORAGE: StorageUiState = {
  state: null
};

const DEFAULT_GUILD: GuildUiState = {
  state: null
};

const DEFAULT_PET: PetUiState = {
  state: null
};

const DEFAULT_ADMIN: AdminUiState = {
  result: null,
  isAdmin: false,
  pingMs: null,
  socketConnected: false,
  pathDebugEnabled: false,
  interactionDebugEnabled: false,
  mobPeacefulEnabled: false
};

const DEFAULT_LOADING: LoadingUiState = {
  active: false,
  progress: 0,
  title: 'Preparando jornada',
  detail: 'Aguardando comando de entrada.',
  pendingWorldEntry: false,
  ready: false
};

const DEFAULT_LOADING_PACKETS: LoadingPacketState = {
  authSuccess: null,
  worldStatic: null,
  worldState: null,
  inventoryState: null,
  announcedPacket: null,
  wsOpen: null,
  wsError: null,
  wsClose: null,
  lastPacket: null
};

const LOADING_DEBUG_STORAGE_KEY = 'noxis.loading.debug.v1';
const LOADING_DEBUG_PERSIST_MIN_INTERVAL_MS = 1200;

let runtimeSocket: GameSocket | null = null;
let runtimeStore: GameStore | null = null;
let runtimeLoadingState: LoadingUiState = DEFAULT_LOADING;
let loadingDebugPersistTimer = 0;
let loadingDebugLastPersistAt = 0;
let lastAcceptedLoadingTrace = '';

const SKILL_TREE = buildSkillTree();

function persistLoadingDebugSnapshotNow() {
  if (typeof window === 'undefined') return;
  try {
    const app = get(appStore);
    const world = get(worldStore);
    const admin = get(adminStore);
    const loading = get(loadingStore);
    const packets = get(loadingPacketStore);
    const trace = get(loadingTraceStore);
    const snapshot: LoadingDebugSnapshot = {
      savedAt: new Date().toISOString(),
      phase: String(app.connectionPhase || 'unknown'),
      playerId: app.playerId ?? null,
      mapCode: String(world.mapCode || '-'),
      mapId: String(world.mapId || '-'),
      socketConnected: Boolean(admin.socketConnected),
      loading,
      packets,
      trace
    };
    window.localStorage.setItem(LOADING_DEBUG_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // noop
  }
}

function persistLoadingDebugSnapshot() {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  const remaining = LOADING_DEBUG_PERSIST_MIN_INTERVAL_MS - (now - loadingDebugLastPersistAt);
  if (remaining <= 0) {
    loadingDebugLastPersistAt = now;
    persistLoadingDebugSnapshotNow();
    return;
  }
  if (loadingDebugPersistTimer) return;
  loadingDebugPersistTimer = window.setTimeout(() => {
    loadingDebugPersistTimer = 0;
    loadingDebugLastPersistAt = Date.now();
    persistLoadingDebugSnapshotNow();
  }, remaining);
}

export function getPersistedLoadingDebugSnapshot() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOADING_DEBUG_STORAGE_KEY);
    return raw ? JSON.parse(raw) as LoadingDebugSnapshot : null;
  } catch {
    return null;
  }
}

export function clearPersistedLoadingDebugSnapshot() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(LOADING_DEBUG_STORAGE_KEY);
  } catch {
    // noop
  }
}

function pushLoadingTrace(message: string) {
  const timestamp = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  loadingTraceStore.update((current) => {
    const next = [`${timestamp} ${message}`, ...current].slice(0, 40);
    return next;
  });
  persistLoadingDebugSnapshot();
}

export function traceLoadingStep(message: string) {
  const safeMessage = String(message || '');
  if (safeMessage.startsWith('WS message#')) return;
  if (
    !safeMessage.includes('bootstrap.')
    && !safeMessage.includes('auth_')
    && !safeMessage.includes('Overlay de loading')
    && !safeMessage.includes('Solicitacao de entrada')
    && !safeMessage.includes('Estado minimo do mundo')
    && !safeMessage.includes('Fase alterada')
    && !safeMessage.includes('Loading de entrada')
    && !safeMessage.includes('Falha ao tratar')
  ) {
    return;
  }
  if (safeMessage === lastAcceptedLoadingTrace) return;
  lastAcceptedLoadingTrace = safeMessage;
  pushLoadingTrace(message);
}

export function markLoadingPacket(type: keyof Omit<LoadingPacketState, 'lastPacket'>, detail: string) {
  const timestamp = new Date().toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const line = `${timestamp} ${detail}`;
  loadingPacketStore.update((current) => ({
    ...current,
    [type]: line,
    lastPacket: line
  }));
  persistLoadingDebugSnapshot();
}

export const inventoryStore = writable<InventoryUiState>(DEFAULT_INVENTORY);
export const attributesStore = writable<AttributeUiState>(DEFAULT_ATTRIBUTES);
export const chatStore = writable<ChatUiState>(DEFAULT_CHAT);
export const npcStore = writable<NpcUiState>(DEFAULT_NPC);
export const appStore = writable<AppUiState>(DEFAULT_APP);
export const worldStore = writable<WorldUiState>(DEFAULT_WORLD);
export const questStore = writable<QuestUiState>(DEFAULT_QUESTS);
export const partyStore = writable<PartyUiState>(DEFAULT_PARTY);
export const friendStore = writable<FriendUiState>(DEFAULT_FRIENDS);
export const tradeStore = writable<TradeUiState>(DEFAULT_TRADE);
export const storageStore = writable<StorageUiState>(DEFAULT_STORAGE);
export const guildStore = writable<GuildUiState>(DEFAULT_GUILD);
export const petStore = writable<PetUiState>(DEFAULT_PET);
export const adminStore = writable<AdminUiState>(DEFAULT_ADMIN);
export const loadingStore = writable<LoadingUiState>(DEFAULT_LOADING);
export const loadingTraceStore = writable<string[]>([]);
export const loadingPacketStore = writable<LoadingPacketState>(DEFAULT_LOADING_PACKETS);
export const tooltipStore = writable<TooltipUiState>({
  visible: false,
  x: 0,
  y: 0,
  payload: null
});
export const mapSettingsStore = writable<MapSettingsUiState>({
  open: false,
  autoAttackEnabled: true,
  showPlayers: true,
  showMobs: true,
  showNpcs: true,
  showPortals: true,
  showEvents: true
});
export const selectionStore = writable<SelectionUiState>({
  selectedMobId: null,
  selectedPlayerId: null
});
export const panelStore = writable<PanelUiState>({
  character: false,
  inventory: false,
  skills: false,
  map: false,
  quests: false,
  party: false,
  friends: false,
  guild: false,
  pets: false,
  trade: false,
  storage: false,
  admin: false
});
export const dragStore = writable<DragPayload>(null);
export const hudScaleStore = writable(1);
export const hudBrowserCompensationStore = writable(1);
export const hotbarBindingsStore = writable<Record<string, any>>({});
export const selectedAutoAttackStore = writable('class_primary');

export const inventorySlots = derived(inventoryStore, ($inventoryStore) => {
  const slots = Array.from({ length: 36 }, (_, slotIndex) => ({
    slotIndex,
    item: null as any
  }));
  for (const item of $inventoryStore.inventory || []) {
    const slotIndex = Number(item?.slotIndex ?? -1);
    if (slotIndex >= 0 && slotIndex < slots.length) slots[slotIndex] = { slotIndex, item };
  }
  return slots;
});

export const equippedSlots = derived(inventoryStore, ($inventoryStore) => ({
  helmet: $inventoryStore.equippedBySlot?.helmet || null,
  chest: $inventoryStore.equippedBySlot?.chest || null,
  pants: $inventoryStore.equippedBySlot?.pants || null,
  gloves: $inventoryStore.equippedBySlot?.gloves || null,
  boots: $inventoryStore.equippedBySlot?.boots || null,
  ring: $inventoryStore.equippedBySlot?.ring || null,
  weapon: $inventoryStore.equippedBySlot?.weapon || null,
  necklace: $inventoryStore.equippedBySlot?.necklace || null
}));

export const playerStats = derived(attributesStore, ($attributesStore) => {
  const player = $attributesStore.player || {};
  const base = player?.allocatedStats && typeof player.allocatedStats === 'object'
    ? player.allocatedStats
    : { str: 0, int: 0, dex: 0, vit: 0 };
  const stats = player?.stats && typeof player.stats === 'object'
    ? player.stats
    : {};
  const level = Math.max(1, Number(player.level || 1));
  const allocatedCost = Number(base.str || 0) + Number(base.int || 0) + Number(base.dex || 0) + Number(base.vit || 0);
  const reportedUnspent = Number(player.unspentPoints || 0);
  const derivedUnspent = Math.max(0, ((level - 1) * 5) - allocatedCost);
  return {
    level,
    xp: Number(player.xp || 0),
    xpToNext: Number(player.xpToNext || 0),
    hp: Number(player.hp || 0),
    maxHp: Number(player.maxHp || 0),
    className: String(player.class || 'knight'),
    unspentPoints: Math.max(reportedUnspent, derivedUnspent),
    base,
    combat: {
      physicalAttack: Number(stats.physicalAttack || 0),
      magicAttack: Number(stats.magicAttack || 0),
      physicalDefense: Number(stats.physicalDefense || 0),
      magicDefense: Number(stats.magicDefense || 0),
      accuracy: Number(stats.accuracy || 0),
      evasion: Number(stats.evasion || 0),
      moveSpeed: Number(stats.moveSpeed || 0),
      attackSpeed: Number(stats.attackSpeed || 0)
    }
  };
});

export const selectedMobStore = derived([worldStore, selectionStore], ([$worldStore, $selectionStore]) => {
  const world = $worldStore.world;
  const selectedMobId = String($selectionStore.selectedMobId || '');
  if (!selectedMobId || !Array.isArray(world?.mobs)) return null;
  return world.mobs.find((entry: any) => String(entry?.id || '') === selectedMobId) || null;
});

export const selectedPlayerStore = derived([worldStore, selectionStore], ([$worldStore, $selectionStore]) => {
  const world = $worldStore.world;
  const selectedPlayerId = Number($selectionStore.selectedPlayerId || 0);
  if (!selectedPlayerId || !world?.players) return null;
  return world.players[String(selectedPlayerId)] || null;
});

export const playerMetaStore = derived([attributesStore, worldStore], ([$attributesStore, $worldStore]) => {
  const player = $attributesStore.player || null;
  const world = $worldStore.world || null;
  const currentInstance = String(world?.mapId || '-').toUpperCase();
  const availableInstances = ['Z1', 'Z2'];
  if (currentInstance && currentInstance !== '-' && !availableInstances.includes(currentInstance)) availableInstances.unshift(currentInstance);
  return {
    player,
    pvpMode: String(player?.pvpMode || 'peace'),
    currentInstance,
    availableInstances,
    isDungeon: Boolean(String(world?.mapId || '').startsWith('DNG-') || String(world?.mapKey || '').startsWith('dng_'))
  };
});

export const partyFramesStore = derived([partyStore, appStore], ([$partyStore, $appStore]) => {
  const selfId = Number($appStore.playerId || 0);
  return Array.isArray($partyStore.party?.members)
    ? $partyStore.party.members.filter((entry: any) => Number(entry?.playerId || 0) !== selfId)
    : [];
});

export const skillsStore = derived(attributesStore, ($attributesStore) => {
  const player = $attributesStore.player || {};
  const skillLevels = player?.skillLevels && typeof player.skillLevels === 'object' ? player.skillLevels : {};
  const classId = String(player?.class || 'knight');
  const playerLevel = Math.max(1, Number(player?.level || 1));
  const skillPoints = Number(player?.skillPointsAvailable || 0);
  const entries = SKILL_TREE
    .filter((entry) => entry.classId === classId)
    .map((entry) => ({
      ...entry,
      level: Math.max(0, Math.min(entry.maxPoints, Number(skillLevels[entry.id] || 0))),
      learned: Number(skillLevels[entry.id] || 0) > 0
    }))
    .map((entry) => {
      const prereqLevel = entry.prereq ? Math.max(0, Number(skillLevels[entry.prereq] || 0)) : 1;
      const requiredLevelMet = playerLevel >= entry.requiredLevel;
      const prereqMet = !entry.prereq || prereqLevel >= 1;
      const maxed = entry.level >= entry.maxPoints;
      const canLearn = requiredLevelMet && prereqMet && skillPoints > 0 && !maxed;
      return {
        ...entry,
        requiredLevelMet,
        prereqMet,
        canLearn,
        lockedReason: !requiredLevelMet
          ? `Requer nivel ${entry.requiredLevel}.`
          : !prereqMet
            ? 'Aprenda a habilidade anterior desta trilha.'
            : maxed
              ? 'Nivel maximo atingido.'
              : skillPoints <= 0
                ? 'Sem pontos de habilidade.'
                : ''
      };
    });
  return {
    classId,
    playerLevel,
    skillPoints,
    entries,
    autoAttack: [{ id: 'class_primary', label: 'Atk Basico', learned: true }, ...entries.filter((entry) => entry.learned && entry.target === 'mob').map((entry) => ({ id: entry.id, label: entry.label, learned: true }))]
  };
});

export const activePetStore = derived([petStore, worldStore], ([$petStore, $worldStore]) => {
  const petState = $petStore.state || null;
  const activePetId = String(petState?.activePetId || '');
  const worldPets = Array.isArray($worldStore.world?.pets) ? $worldStore.world.pets : [];
  const activeWorldPet = activePetId
    ? worldPets.find((entry: any) => String(entry?.id || '') === activePetId) || null
    : null;
  return {
    state: petState,
    ownedPets: Array.isArray(petState?.ownedPets) ? petState.ownedPets : [],
    activePetId: activePetId || null,
    activePetOwnershipId: petState?.activePetOwnershipId ? String(petState.activePetOwnershipId) : null,
    behavior: String(petState?.behavior || 'assist'),
    activeWorldPet
  };
});

export const hotbarSlots = derived(
  [hotbarBindingsStore, inventoryStore, attributesStore, selectedAutoAttackStore, skillsStore],
  ([$hotbarBindingsStore, $inventoryStore, $attributesStore, $selectedAutoAttackStore, $skillsStore]) => HOTBAR_KEYS.map((key) => {
    const binding = $hotbarBindingsStore?.[key] || null;
    let iconUrl = '';
    let label = key.toUpperCase();
    let skillId = '';
    let cooldownMs = 0;
    if (binding?.type === 'item') {
      const item = findItemById($inventoryStore, String(binding.itemId || ''));
      iconUrl = resolveIcon(item || binding);
      label = displayItemName(item || { name: binding.itemName, templateId: binding.itemType });
    }
    if (binding?.type === 'action' && binding.actionId === 'skill_cast') {
      skillId = String(binding.skillId || '');
      label = String(binding.skillName || humanizeLabelId(skillId));
      const skillEntry = getSkillTreeEntry(skillId);
      cooldownMs = Math.max(0, Number(skillEntry?.cooldownMs || 0));
      iconUrl = String(skillEntry?.iconUrl || getSkillIconUrl(skillId, $skillsStore.classId));
    }
    if (binding?.type === 'action' && binding.actionId === 'basic_attack') {
      const autoAttack = resolveAutoAttackDef($selectedAutoAttackStore, $skillsStore);
      skillId = String(autoAttack.id || 'class_primary');
      label = String(autoAttack.label || 'Atk Basico');
      const skillEntry = getSkillTreeEntry(skillId);
      cooldownMs = Math.max(0, Number(skillEntry?.cooldownMs || 2200));
      iconUrl = String(skillEntry?.iconUrl || getSkillIconUrl(skillId, $skillsStore.classId));
    }
    const cooldownEndsAt = skillId
      ? Math.max(0, Number($attributesStore.player?.skillCooldowns?.[skillId] || 0))
      : 0;
    return {
      key,
      binding,
      iconUrl,
      label,
      skillId,
      cooldownMs,
      cooldownEndsAt,
      ready: cooldownEndsAt <= Date.now()
    };
  })
);

export const selectedAutoAttackLabelStore = derived(
  [selectedAutoAttackStore, skillsStore],
  ([$selectedAutoAttackStore, $skillsStore]) => resolveAutoAttackDef($selectedAutoAttackStore, $skillsStore).label
);

export const playerBuffsStore = derived(attributesStore, ($attributesStore) =>
  normalizeActiveEffects($attributesStore.player?.activeSkillEffects)
);

export const targetBuffsStore = derived(selectedPlayerStore, ($selectedPlayerStore) =>
  normalizeActiveEffects($selectedPlayerStore?.activeSkillEffects)
);

export const questTrackerStore = derived(questStore, ($questStore) =>
  ($questStore.quests || []).slice(0, 4).map((quest: any) => ({
    id: String(quest?.id || ''),
    title: String(quest?.title || quest?.id || 'Quest'),
    status: String(quest?.status || 'ativa'),
    objectives: Array.isArray(quest?.objectives)
      ? quest.objectives.map((objective: any) => ({
          id: String(objective?.id || ''),
          text: String(objective?.text || objective?.id || 'Objetivo'),
          current: Number(objective?.current || 0),
          required: Math.max(1, Number(objective?.required || 1))
        }))
      : []
  }))
);

export const activeEventsStore = derived(worldStore, ($worldStore) =>
  Array.isArray($worldStore.world?.activeEvents)
    ? $worldStore.world.activeEvents.map((entry: any) => ({
        id: String(entry?.id || entry?.eventId || ''),
        title: String(entry?.name || entry?.title || entry?.eventName || 'Evento ativo'),
        stage: String(entry?.stage || entry?.status || 'ativo'),
        x: Number(entry?.x || 0),
        y: Number(entry?.y || 0)
      }))
    : []
);

export const combatContextStore = derived(
  [worldStore, selectedMobStore, selectedPlayerStore, selectedAutoAttackStore, skillsStore],
  ([$worldStore, $selectedMobStore, $selectedPlayerStore, $selectedAutoAttackStore, $skillsStore]) => {
    const player = $worldStore.player;
    const target = $selectedMobStore || $selectedPlayerStore;
    const autoAttack = resolveAutoAttackDef($selectedAutoAttackStore, $skillsStore);
    const range = Math.max(0, Number(getSkillTreeEntry(String(autoAttack.id || 'class_primary'))?.range || 100));
    const targetDistance = player && target
      ? Math.hypot(Number(target.x || 0) - Number(player.x || 0), Number(target.y || 0) - Number(player.y || 0))
      : 0;
    return {
      preferredSkillLabel: String(autoAttack.label || 'Atk Basico'),
      preferredRange: range,
      targetDistance,
      inRange: Boolean(player && target && targetDistance <= range)
    };
  }
);

export const hudTransformStyle = derived(
  [hudScaleStore, hudBrowserCompensationStore],
  ([$hudScaleStore, $hudBrowserCompensationStore]) =>
    `transform: scale(calc(var(--hud-responsive-scale, 1) * ${$hudScaleStore} * ${$hudBrowserCompensationStore})); --hud-scale: ${$hudScaleStore};`
);

function buildSkillTree(): SkillTreeNode[] {
  const tiers = [1, 10, 20, 30, 40];
  const defs = {
    knight: {
      a: [
        { label: 'Investida de Escudo', id: 'war_bastion_escudo_fe', summary: 'Avanca no alvo com um impacto curto e seguro para abrir a linha de frente.', target: 'mob', cooldownMs: 7000, range: 130, role: 'Ataque' },
        { label: 'Juramento de Ferro', id: 'war_bastion_muralha', summary: 'Ergue a postura defensiva do cavaleiro e reduz a pressao recebida.', target: 'self', cooldownMs: 13000, role: 'Buff' },
        { label: 'Travar Terreno', id: 'war_bastion_renovacao', summary: 'Golpe em area que prende a luta perto do cavaleiro e segura pacotes no PvE.', target: 'mob', cooldownMs: 10000, range: 112, role: 'Area' },
        { label: 'Guarda Reunida', id: 'war_bastion_inabalavel', summary: 'Postura de guarda reforcada para segurar o caos e refletir parte do impacto.', target: 'self', cooldownMs: 16000, role: 'Buff' },
        { label: 'Ultimo Bastiao', id: 'war_bastion_impacto_sismico', summary: 'Janela defensiva maxima para chefes, foco inimigo e pontos de estrangulamento.', target: 'self', cooldownMs: 22000, role: 'Buff' }
      ],
      b: [
        { label: 'Arco Dilacerante', id: 'war_carrasco_frenesi', summary: 'Varredura frontal para limpar grupos pequenos e abrir espaco no contato.', target: 'mob', cooldownMs: 9000, range: 110, role: 'Area' },
        { label: 'Quebra-Ossos', id: 'war_carrasco_lacerar', summary: 'Golpe pesado de curta distancia para punir alvos prioritarios.', target: 'mob', cooldownMs: 7800, range: 100, role: 'Ataque' },
        { label: 'Rugido de Sangue', id: 'war_carrasco_ira', summary: 'Explosao ofensiva com roubo de vida para janelas agressivas de grupo.', target: 'self', cooldownMs: 14000, role: 'Buff' },
        { label: 'Corrente de Aco', id: 'war_carrasco_golpe_sacrificio', summary: 'Sequencia pesada de dano bruto, cobrando uma pequena parcela da propria vida.', target: 'mob', cooldownMs: 9800, range: 115, role: 'Ataque' },
        { label: 'Ceifador', id: 'war_carrasco_aniquilacao', summary: 'Finalizador que ganha valor quando o alvo ja esta pressionado.', target: 'mob', cooldownMs: 13500, range: 120, role: 'Execucao' }
      ],
      labels: ['Vanguarda', 'Reaver']
    },
    archer: {
      a: [
        { label: 'Disparo Lento', id: 'arc_patrulheiro_tiro_ofuscante', summary: 'Tiro de abertura para controlar o ritmo da aproximacao inimiga.', target: 'mob', cooldownMs: 6500, range: 420, role: 'Ataque' },
        { label: 'Abrolhos', id: 'arc_patrulheiro_foco_distante', summary: 'Projeta uma zona curta de impacto para aliviar perseguidores e packs.', target: 'mob', cooldownMs: 9000, range: 360, role: 'Controle' },
        { label: 'Passo do Vento', id: 'arc_patrulheiro_abrolhos', summary: 'Buff de mobilidade e cadencia para kiting mais limpo.', target: 'self', cooldownMs: 12000, role: 'Buff' },
        { label: 'Chuva de Flechas', id: 'arc_patrulheiro_salva_flechas', summary: 'Area principal do arqueiro para lutas de grupo e limpeza de packs.', target: 'mob', cooldownMs: 11000, range: 430, role: 'Area' },
        { label: 'Marca do Batedor', id: 'arc_patrulheiro_passo_vento', summary: 'Marca o momento ofensivo e melhora o dano da proxima janela de pressao.', target: 'self', cooldownMs: 14500, role: 'Buff' }
      ],
      b: [
        { label: 'Postura de Tiro', id: 'arc_franco_flecha_debilitante', summary: 'Prepara alguns disparos mais letais com foco em consistencia e critico.', target: 'self', cooldownMs: 12000, role: 'Buff' },
        { label: 'Virote Corrosivo', id: 'arc_franco_ponteira_envenenada', summary: 'Disparo que continua corroendo o alvo apos o impacto inicial.', target: 'mob', cooldownMs: 7800, range: 430, role: 'Ataque' },
        { label: 'Olho de Aguia', id: 'arc_franco_olho_aguia', summary: 'Amplia alcance efetivo e reforca o momento de burst do atirador.', target: 'self', cooldownMs: 14000, role: 'Buff' },
        { label: 'Flecha Perfurante', id: 'arc_franco_disparo_perfurante', summary: 'Tiro de alto impacto para perfurar prioridades em PvE e PvP.', target: 'mob', cooldownMs: 9200, range: 470, role: 'Ataque' },
        { label: 'Tiro de Misericordia', id: 'arc_franco_tiro_misericordia', summary: 'Finalizador de longa distancia para alvos ja enfraquecidos.', target: 'mob', cooldownMs: 13000, range: 470, role: 'Execucao' }
      ],
      labels: ['Ranger', 'Sharpshooter']
    },
    druid: {
      a: [
        { label: 'Florescer', id: 'dru_preservador_florescer', summary: 'Cura principal para estabilizar a linha em janelas curtas.', target: 'self', cooldownMs: 8500, role: 'Cura' },
        { label: 'Casca Viva', id: 'dru_preservador_casca_ferro', summary: 'Reforca a casca natural e segura burst fisico e magico.', target: 'self', cooldownMs: 12000, role: 'Buff' },
        { label: 'Raizes Prendentes', id: 'dru_preservador_emaranhado', summary: 'Area de controle para atrasar pacotes e punir alvos agrupados.', target: 'mob', cooldownMs: 9600, range: 360, role: 'Controle' },
        { label: 'Corrente Vital', id: 'dru_preservador_prece_natureza', summary: 'Pulso maior de cura e ritmo para sustentar a equipe por mais tempo.', target: 'self', cooldownMs: 13500, role: 'Cura' },
        { label: 'Bosque Sagrado', id: 'dru_preservador_avatar_espiritual', summary: 'Forma protetora para segurar pushes e estabilizar lutas longas.', target: 'self', cooldownMs: 18500, role: 'Buff' }
      ],
      b: [
        { label: 'Acoite de Espinhos', id: 'dru_primal_espinhos', summary: 'Castigo magico confiavel para manter pressao a media distancia.', target: 'mob', cooldownMs: 7600, range: 350, role: 'Ataque' },
        { label: 'Nuvem de Enxame', id: 'dru_primal_enxame', summary: 'Nuvem corrosiva que continua pressionando apos o primeiro contato.', target: 'mob', cooldownMs: 9000, range: 370, role: 'Ataque' },
        { label: 'Semente Podre', id: 'dru_primal_patada_sombria', summary: 'Carga de dano magico pesado para abrir janelas de burst.', target: 'mob', cooldownMs: 10000, range: 345, role: 'Ataque' },
        { label: 'Brejo Sombrio', id: 'dru_primal_nevoa_obscura', summary: 'Area ampla de negacao para PvE em grupo e disputas de espaco.', target: 'mob', cooldownMs: 11800, range: 365, role: 'Area' },
        { label: 'Flor do Eclipse', id: 'dru_primal_invocacao_primal', summary: 'Explosao magica forte para fechar rotacoes ofensivas.', target: 'mob', cooldownMs: 16500, range: 385, role: 'Execucao' }
      ],
      labels: ['Lifebinder', 'Blightcaller']
    },
    assassin: {
      a: [
        { label: 'Estocada', id: 'ass_agil_reflexos', summary: 'Abertura rapida para grudar no alvo e manter a pressao curta.', target: 'mob', cooldownMs: 6200, range: 118, role: 'Ataque' },
        { label: 'Ripostar', id: 'ass_agil_contra_ataque', summary: 'Janela defensiva curta que valoriza duelos e trocas inteligentes.', target: 'self', cooldownMs: 9800, role: 'Buff' },
        { label: 'Passo Sombrio', id: 'ass_agil_passo_fantasma', summary: 'Reposicionamento ofensivo para continuar colado no alvo.', target: 'mob', cooldownMs: 8000, range: 230, role: 'Ataque' },
        { label: 'Corte de Tendao', id: 'ass_agil_golpe_nervos', summary: 'Corte preciso para manter a presa sob risco constante.', target: 'mob', cooldownMs: 8600, range: 125, role: 'Ataque' },
        { label: 'Danca de Laminas', id: 'ass_agil_miragem', summary: 'Area curta e veloz para caos controlado em brigas de grupo.', target: 'mob', cooldownMs: 12500, range: 135, role: 'Area' }
      ],
      b: [
        { label: 'Marca do Cacador', id: 'ass_letal_expor_fraqueza', summary: 'Prepara o momento de burst e reforca o dano contra um alvo chave.', target: 'self', cooldownMs: 12000, role: 'Buff' },
        { label: 'Veu', id: 'ass_letal_ocultar', summary: 'Furtividade curta para montar aberturas e reposicionamento agressivo.', target: 'self', cooldownMs: 18000, role: 'Buff' },
        { label: 'Emboscada', id: 'ass_letal_emboscada', summary: 'Golpe de abertura devastador que brilha quando sai do Veu.', target: 'mob', cooldownMs: 9800, range: 150, role: 'Ataque' },
        { label: 'Cortina de Fumaca', id: 'ass_letal_bomba_fumaca', summary: 'Area tensa para desorganizar backline e abrir janela de escape.', target: 'mob', cooldownMs: 12800, range: 250, role: 'Area' },
        { label: 'Queda da Noite', id: 'ass_letal_sentenca', summary: 'Finalizador atrasado para confirmar abates comprometidos.', target: 'mob', cooldownMs: 14800, range: 320, role: 'Execucao' }
      ],
      labels: ['Duelist', 'Shade']
    }
  } as const;
  const out: SkillTreeNode[] = [];
  for (const [classId, def] of Object.entries(defs)) {
    def.a.forEach((entry, idx) => {
      out.push({
        ...entry,
        iconUrl: getSkillIconUrl(entry.id, classId),
        classId,
        buildKey: 'buildA',
        buildLabel: def.labels[0],
        prereq: idx > 0 ? def.a[idx - 1].id : null,
        maxPoints: 5,
        requiredLevel: tiers[idx] || 1
      });
    });
    def.b.forEach((entry, idx) => {
      out.push({
        ...entry,
        iconUrl: getSkillIconUrl(entry.id, classId),
        classId,
        buildKey: 'buildB',
        buildLabel: def.labels[1],
        prereq: idx > 0 ? def.b[idx - 1].id : null,
        maxPoints: 5,
        requiredLevel: tiers[idx] || 1
      });
    });
  }
  return out;
}

function humanizeLabelId(id: string) {
  return String(id || 'habilidade').replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function normalizeActiveEffects(rawEffects: any): Array<{
  id: string;
  label: string;
  shortLabel: string;
  expiresAt: number;
  beneficial: boolean;
}> {
  const now = Date.now();
  const effects = Array.isArray(rawEffects) ? rawEffects : [];
  return effects
    .filter((entry: any) => Number(entry?.expiresAt || 0) > now)
    .map((entry: any) => {
      const id = String(entry?.id || '');
      const label = humanizeLabelId(id);
      const beneficial = Boolean(
        Number(entry?.attackMul || 0) > 1
        || Number(entry?.defenseMul || 0) > 1
        || Number(entry?.magicDefenseMul || 0) > 1
        || Number(entry?.moveMul || 0) > 1
        || Number(entry?.attackSpeedMul || 0) > 1
        || Number(entry?.damageReduction || 0) > 0
        || Number(entry?.lifesteal || 0) > 0
        || Boolean(entry?.stealth)
      );
      const compact = label.length > 14 ? `${label.slice(0, 12)}..` : label;
      return {
        id,
        label,
        shortLabel: compact,
        expiresAt: Number(entry?.expiresAt || 0),
        beneficial
      };
    })
    .sort((left, right) => left.expiresAt - right.expiresAt);
}

function findItemById(inventory: InventoryUiState, itemId: string) {
  if (!itemId) return null;
  return inventory.inventory.find((entry: any) => String(entry?.id || '') === itemId)
    || Object.values(inventory.equippedBySlot || {}).find((entry: any) => String(entry?.id || '') === itemId)
    || null;
}

function resolveIcon(item: any) {
  return String(item?.iconUrl || item?.icon_url || item?.spriteId || item?.sprite_id || '/assets/ui/items/placeholder-transparent.svg');
}

function normalizeHotbarBindings(bindings: Record<string, any>) {
  const out: Record<string, any> = {};
  HOTBAR_KEYS.forEach((key) => { out[key] = bindings?.[key] || null; });
  return out;
}

function normalizeChatChannel(channel: unknown): ChatChannel {
  const safeChannel = String(channel || '').trim().toLowerCase();
  if (safeChannel === 'system') return 'system';
  if (safeChannel === 'global' || safeChannel === 'world' || safeChannel === 'map') return 'world';
  if (safeChannel === 'party' || safeChannel === 'group') return 'group';
  if (safeChannel === 'guild') return 'guild';
  if (safeChannel === 'whisper') return 'whisper';
  if (safeChannel === 'trade') return 'trade';
  return 'local';
}

function normalizeChatMessage(message: any, currentPlayerId: number | null, currentPlayerName: string): ChatUiMessage | null {
  if (!message || typeof message !== 'object') return null;

  const isSystem = String(message.type || '').toLowerCase() === 'system';
  const content = String(message.content || message.text || message.message || '').trim();
  if (!content) return null;

  const timestamp = Math.max(0, Number(message.timestamp || message.at || Date.now()));
  const fromId = Number(message.fromId || 0) || null;
  const fromSelf = Boolean(currentPlayerId && fromId && currentPlayerId === fromId);
  const player = isSystem
    ? 'Sistema'
    : String(message.from || message.player || (fromSelf ? currentPlayerName || 'Voce' : 'Aventureiro'));

  return {
    id: String(message.id || `${timestamp}-${player}-${content.slice(0, 12)}`),
    player,
    content,
    channel: isSystem ? 'system' : normalizeChatChannel(message.channel || message.scope || message.type),
    timestamp,
    targetName: message.targetName ? String(message.targetName) : null,
    fromSelf
  };
}

function resolveLastTradeMessage(messages: ChatUiMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.channel === 'trade') return messages[index];
  }
  return null;
}

function resolveLastWhisperTarget(messages: ChatUiMessage[], fallbackPlayerName: string) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const entry = messages[index];
    if (entry?.channel !== 'whisper') continue;
    if (entry.fromSelf && entry.targetName) return entry.targetName;
    if (!entry.fromSelf && entry.player && entry.player !== fallbackPlayerName) return entry.player;
  }
  return null;
}

function pushClientSystemChat(text: string) {
  const safeText = String(text || '').trim();
  if (!safeText) return;
  const payload = {
    id: `${Date.now()}-${Math.random()}`,
    type: 'system',
    text: safeText,
    at: Date.now()
  };
  if (runtimeStore) {
    runtimeStore.pushChatMessage(payload);
    return;
  }
  const normalized = normalizeChatMessage(payload, null, '');
  if (!normalized) return;
  chatStore.update((current) => ({
    ...current,
    messages: [...current.messages, normalized].slice(-120)
  }));
}

function loadSelectedAutoAttack() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem('noxis.skillTree.v1') || '{}');
    return typeof parsed.autoAttackSkillId === 'string' && parsed.autoAttackSkillId ? parsed.autoAttackSkillId : 'class_primary';
  } catch {
    return 'class_primary';
  }
}

function persistSelectedAutoAttack(skillId: string) {
  try {
    window.localStorage.setItem('noxis.skillTree.v1', JSON.stringify({ autoAttackSkillId: skillId || 'class_primary' }));
  } catch {
    // noop
  }
}

function resolveAutoAttackDef(id: string, skills: ReturnType<typeof get<typeof skillsStore>>) {
  if (!id || id === 'class_primary') return { id: 'class_primary', label: 'Atk Basico' };
  return skills.autoAttack.find((entry) => entry.id === id) || { id: 'class_primary', label: 'Atk Basico' };
}

function getSkillTreeEntry(skillId: string) {
  return SKILL_TREE.find((entry) => entry.id === skillId) || null;
}

export function sendUiMessage(payload: Record<string, unknown>) {
  runtimeSocket?.send(payload);
}

export function setChatActiveChannel(channel: ChatInputChannel) {
  chatStore.update((current) => ({
    ...current,
    activeChannel: channel
  }));
}

export function sendChatMessage(scope: ChatInputChannel, text: string) {
  const safeText = String(text || '').trim();
  if (!safeText) return;
  const currentChatState = get(chatStore);
  let channel: ChatInputChannel = scope;
  let payloadText = safeText;
  let targetName = currentChatState.lastWhisperTarget;

  if (safeText.startsWith('/')) {
    const [commandRaw, ...restParts] = safeText.split(/\s+/);
    const command = String(commandRaw || '').toLowerCase();

    if (command === '/w' || command === '/whisper') {
      const whisperTarget = String(restParts.shift() || '').trim();
      const whisperText = restParts.join(' ').trim();
      if (!whisperTarget || !whisperText) {
        pushClientSystemChat('Use /w Nome mensagem para enviar um whisper.');
        return;
      }
      channel = 'whisper';
      targetName = whisperTarget;
      payloadText = whisperText;
    } else if (command === '/g' || command === '/group' || command === '/party') {
      channel = 'group';
      payloadText = restParts.join(' ').trim();
    } else if (command === '/l' || command === '/local') {
      channel = 'local';
      payloadText = restParts.join(' ').trim();
    } else if (command === '/world') {
      channel = 'world';
      payloadText = restParts.join(' ').trim();
    } else if (command === '/trade' || command === '/t') {
      channel = 'trade';
      payloadText = restParts.join(' ').trim();
    } else if (command === '/guild') {
      channel = 'guild';
      payloadText = restParts.join(' ').trim();
    } else {
      pushClientSystemChat(`Comando de chat desconhecido: ${commandRaw}.`);
      return;
    }
  } else if (channel === 'whisper') {
    if (!targetName) {
      pushClientSystemChat('Selecione um destinatario com /w Nome mensagem antes de usar o canal Whisper.');
      return;
    }
  }

  payloadText = String(payloadText || '').trim();
  if (!payloadText) return;

  chatStore.update((current) => ({
    ...current,
    activeChannel: channel,
    lastWhisperTarget: channel === 'whisper' ? targetName || current.lastWhisperTarget : current.lastWhisperTarget
  }));

  sendUiMessage({
    type: 'chat_send',
    scope: channel,
    text: payloadText,
    ...(channel === 'whisper' && targetName ? { targetName } : {})
  });
}

export function attackSelectedMob(mobId?: string | null) {
  const targetMobId = String(mobId || runtimeStore?.getState().selectedMobId || '');
  if (!targetMobId) return;
  const autoAttackEnabled = Boolean(get(mapSettingsStore).autoAttackEnabled);
  const selectedAutoAttackId = get(selectedAutoAttackStore);
  if (autoAttackEnabled && selectedAutoAttackId && selectedAutoAttackId !== 'class_primary') {
    sendUiMessage({ type: 'skill.cast', skillId: selectedAutoAttackId, targetMobId });
    return;
  }
  sendUiMessage({ type: 'target_mob', mobId: targetMobId });
}

export function attackSelectedPlayer(targetPlayerId?: number | null) {
  const safeTargetPlayerId = Number(targetPlayerId || runtimeStore?.getState().selectedPlayerId || 0);
  if (!safeTargetPlayerId) return;
  sendUiMessage({ type: 'combat.targetPlayer', targetPlayerId: safeTargetPlayerId });
}

export function inviteSelectedPlayer(targetName?: string | null) {
  const state = runtimeStore?.getState();
  const resolvedName = String(
    targetName
    || (state?.selectedPlayerId ? state.resolvedWorld?.players?.[String(state.selectedPlayerId)]?.name : '')
    || ''
  ).trim();
  if (!resolvedName) return;
  sendUiMessage({ type: 'party.invite', targetName: resolvedName });
}

export function addSelectedPlayerFriend(targetName?: string | null) {
  const state = runtimeStore?.getState();
  const resolvedName = String(
    targetName
    || (state?.selectedPlayerId ? state.resolvedWorld?.players?.[String(state.selectedPlayerId)]?.name : '')
    || ''
  ).trim();
  if (!resolvedName) return;
  sendUiMessage({ type: 'friend.request', targetName: resolvedName });
}

export function clearCurrentTarget() {
  selectionStore.set({ selectedMobId: null, selectedPlayerId: null });
  runtimeStore?.update({ selectedMobId: null, selectedPlayerId: null });
  sendUiMessage({ type: 'combat.clearTarget' });
}

export function selectNearestTarget() {
  const state = runtimeStore?.getState();
  const player = state?.resolvedWorld?.players?.[String(state?.playerId || '')] || state?.worldState?.players?.[String(state?.playerId || '')] || null;
  const mobs = Array.isArray(state?.resolvedWorld?.mobs) ? state.resolvedWorld.mobs : [];
  if (!player || !mobs.length) return false;

  const playerX = Number(player.x || 0);
  const playerY = Number(player.y || 0);
  const nearestMob = mobs
    .filter((entry: any) => entry && Number(entry.hp || 0) > 0)
    .map((entry: any) => ({
      mob: entry,
      distance: Math.hypot(Number(entry.x || 0) - playerX, Number(entry.y || 0) - playerY)
    }))
    .sort((left, right) => left.distance - right.distance)[0];

  if (!nearestMob?.mob?.id) return false;
  const mobId = String(nearestMob.mob.id);
  selectionStore.set({ selectedMobId: mobId, selectedPlayerId: null });
  runtimeStore?.update({ selectedMobId: mobId, selectedPlayerId: null });
  if (Boolean(get(mapSettingsStore).autoAttackEnabled)) {
    sendUiMessage({ type: 'target_mob', mobId });
  } else {
    sendUiMessage({ type: 'combat.clearTarget' });
  }
  return true;
}

export function selectCharacterSlot(slot: number) {
  runtimeStore?.update({ selectedCharacterSlot: slot });
}

export function setConnectionPhase(phase: string) {
  runtimeStore?.update({ connectionPhase: phase as any });
}

export function returnToCharacterSelect() {
  sendUiMessage({ type: 'character.back' });
}

export function beginWorldEntryLoading() {
  const current = runtimeLoadingState;
  const next = {
    ...current,
    active: true,
    progress: Math.max(current.progress, 0.08),
    title: 'Preparando entrada',
    detail: 'Solicitando acesso ao mundo.',
    pendingWorldEntry: true,
    ready: false
  };
  runtimeLoadingState = next;
  loadingStore.set(next);
  loadingPacketStore.set(DEFAULT_LOADING_PACKETS);
  lastAcceptedLoadingTrace = '';
  persistLoadingDebugSnapshot();
  pushLoadingTrace('Solicitacao de entrada no mundo iniciada.');
}

export function cancelWorldEntryLoading() {
  runtimeLoadingState = DEFAULT_LOADING;
  loadingStore.set(DEFAULT_LOADING);
  persistLoadingDebugSnapshot();
  pushLoadingTrace('Loading de entrada cancelado.');
}

export function togglePanel(panel: keyof PanelUiState) {
  panelStore.update((current) => ({ ...current, [panel]: !current[panel] }));
}

export function openPanel(panel: keyof PanelUiState) {
  panelStore.update((current) => ({ ...current, [panel]: true }));
}

export function closeAllPanels() {
  if (get(storageStore).state?.open) sendUiMessage({ type: 'storage.close' });
  const tradeState = get(tradeStore).state;
  if (tradeState?.session || tradeState?.incomingRequest || tradeState?.outgoingRequest) {
    sendUiMessage({ type: 'trade.cancel' });
  }
  panelStore.set({ character: false, inventory: false, skills: false, map: false, quests: false, party: false, friends: false, guild: false, pets: false, trade: false, storage: false, admin: false });
  mapSettingsStore.update((current) => ({ ...current, open: false }));
}

export function beginDrag(payload: DragPayload) {
  dragStore.set(payload);
}

export function endDrag() {
  dragStore.set(null);
}

export function commitHotbarBindings(nextBindings: Record<string, any>) {
  const normalized = normalizeHotbarBindings(nextBindings);
  hotbarBindingsStore.set(normalized);
  runtimeStore?.update({ hotbarBindings: normalized });
  runtimeSocket?.send({ type: 'hotbar.set', bindings: normalized });
}

export function setHotbarBinding(key: string, binding: any) {
  const next = normalizeHotbarBindings(get(hotbarBindingsStore));
  next[String(key || '').toLowerCase()] = binding || null;
  commitHotbarBindings(next);
}

export function clearHotbarBinding(key: string) {
  setHotbarBinding(key, null);
}

export function activateInventoryItem(item: any) {
  if (!item?.id) return;
  if (String(item.type || '') === 'weapon' || String(item.type || '') === 'equipment') sendUiMessage({ type: 'equip_req', itemId: item.id });
  else sendUiMessage({ type: 'item.use', itemId: item.id });
}

export function unequipItem(item: any, toSlot?: number) {
  if (!item?.id) return;
  if (Number.isInteger(toSlot)) sendUiMessage({ type: 'inventory_unequip_to_slot', itemId: item.id, toSlot });
  else sendUiMessage({ type: 'equip_req', itemId: item.id });
}

export function moveInventoryItem(itemId: string, toSlot: number) {
  if (!itemId || toSlot < 0) return;
  sendUiMessage({ type: 'inventory_move', itemId, toSlot });
}

export function equipInventoryItem(itemId: string) {
  if (!itemId) return;
  sendUiMessage({ type: 'equip_req', itemId });
}

export function learnSkill(skillId: string) {
  if (!skillId) return;
  sendUiMessage({ type: 'skill.learn', skillId });
}

export function castSkill(skillId: string) {
  const skill = getSkillTreeEntry(skillId);
  if (!skill) return;
  if (skill.target === 'self') {
    sendUiMessage({ type: 'skill.cast', skillId });
    return;
  }
  const selectedMobId = String(runtimeStore?.getState().selectedMobId || '');
  if (!selectedMobId) return;
  sendUiMessage({ type: 'skill.cast', skillId, targetMobId: selectedMobId });
}

export function respondPartyInvite(inviteId: string, partyId: string, accept: boolean) {
  if (!inviteId) return;
  sendUiMessage({ type: accept ? 'party.acceptInvite' : 'party.declineInvite', inviteId, partyId });
  runtimeStore?.removePartyInvite?.(inviteId);
}

export function respondPartyJoinRequest(requestId: string, accept: boolean) {
  if (!requestId) return;
  sendUiMessage({ type: 'party.approveJoin', requestId, accept });
  runtimeStore?.removePartyJoinRequest?.(requestId);
}

export function respondFriendRequest(requestId: string, accept: boolean) {
  if (!requestId) return;
  sendUiMessage({ type: accept ? 'friend.accept' : 'friend.decline', requestId });
}

export function removeFriend(friendPlayerId: number | string) {
  const safeFriendPlayerId = Number(friendPlayerId || 0);
  if (!safeFriendPlayerId) return;
  sendUiMessage({ type: 'friend.remove', friendPlayerId: safeFriendPlayerId });
}

export function requestTrade(targetPlayerId: number | string, targetName?: string) {
  const safeTargetPlayerId = Number(targetPlayerId || 0);
  if (safeTargetPlayerId > 0) {
    sendUiMessage({ type: 'trade.request', targetPlayerId: safeTargetPlayerId });
  } else {
    const safeTargetName = String(targetName || '').trim();
    if (!safeTargetName) return;
    sendUiMessage({ type: 'trade.request', targetName: safeTargetName });
  }
  panelStore.update((current) => ({ ...current, trade: true }));
}

export function requestTradeWithSelectedPlayer() {
  const target = get(selectedPlayerStore);
  if (!target) return;
  requestTrade(Number(target.id || 0), String(target.name || ''));
}

export function respondTradeRequest(requestId: string, accept: boolean) {
  if (!requestId) return;
  sendUiMessage({ type: 'trade.respond', requestId, accept });
  if (accept) {
    panelStore.update((current) => ({ ...current, trade: true }));
  }
}

export function setTradeOfferItem(itemId: string, quantity: number) {
  if (!itemId) return;
  sendUiMessage({ type: 'trade.setItem', itemId, quantity: Math.max(1, Math.floor(Number(quantity || 1))) });
}

export function removeTradeOfferItem(itemId: string) {
  if (!itemId) return;
  sendUiMessage({ type: 'trade.removeItem', itemId });
}

export function setTradeOfferWallet(wallet: { copper?: number; silver?: number; gold?: number; diamond?: number }) {
  sendUiMessage({ type: 'trade.setCurrency', wallet });
}

export function lockTrade() {
  sendUiMessage({ type: 'trade.lock' });
}

export function confirmTrade() {
  sendUiMessage({ type: 'trade.confirm' });
}

export function cancelTrade() {
  sendUiMessage({ type: 'trade.cancel' });
}

export function closeTradePanel() {
  panelStore.update((current) => ({ ...current, trade: false }));
}

export function closeStoragePanel() {
  sendUiMessage({ type: 'storage.close' });
  panelStore.update((current) => ({ ...current, storage: false }));
}

export function depositToStorage(itemId: string, quantity = 1) {
  if (!itemId) return;
  sendUiMessage({ type: 'storage.deposit', itemId, quantity: Math.max(1, Math.floor(Number(quantity || 1))) });
}

export function withdrawFromStorage(itemId: string, quantity = 1) {
  if (!itemId) return;
  sendUiMessage({ type: 'storage.withdraw', itemId, quantity: Math.max(1, Math.floor(Number(quantity || 1))) });
}

export function createGuild(name: string) {
  const safeName = String(name || '').trim();
  if (!safeName) return;
  sendUiMessage({ type: 'guild.create', name: safeName });
}

export function inviteToGuild(targetName: string) {
  const safeName = String(targetName || '').trim();
  if (!safeName) return;
  sendUiMessage({ type: 'guild.invite', targetName: safeName });
}

export function respondGuildInvite(inviteId: string, accept: boolean) {
  if (!inviteId) return;
  sendUiMessage({ type: 'guild.respondInvite', inviteId, accept });
}

export function leaveGuild() {
  sendUiMessage({ type: 'guild.leave' });
}

export function kickGuildMember(targetPlayerId: number | string) {
  const safeTargetPlayerId = Number(targetPlayerId || 0);
  if (!safeTargetPlayerId) return;
  sendUiMessage({ type: 'guild.kick', targetPlayerId: safeTargetPlayerId });
}

export function setGuildMemberRank(targetPlayerId: number | string, rank: 'leader' | 'officer' | 'member') {
  const safeTargetPlayerId = Number(targetPlayerId || 0);
  if (!safeTargetPlayerId) return;
  sendUiMessage({ type: 'guild.setRank', targetPlayerId: safeTargetPlayerId, rank });
}

export function refreshGuildState() {
  sendUiMessage({ type: 'guild.state' });
}

export function summonPet(petOwnershipId: string) {
  const safePetOwnershipId = String(petOwnershipId || '').trim();
  if (!safePetOwnershipId) return;
  sendUiMessage({ type: 'pet.summon', petOwnershipId: safePetOwnershipId });
}

export function unsummonPet() {
  sendUiMessage({ type: 'pet.unsummon' });
}

export function feedPet(petOwnershipId?: string) {
  if (petOwnershipId) {
    sendUiMessage({ type: 'pet.feed', petOwnershipId: String(petOwnershipId || '').trim() });
    return;
  }
  sendUiMessage({ type: 'pet.feed' });
}

export function renamePet(petOwnershipId: string, name: string) {
  const safePetOwnershipId = String(petOwnershipId || '').trim();
  const safeName = String(name || '').trim();
  if (!safePetOwnershipId || !safeName) return;
  sendUiMessage({ type: 'pet.rename', petOwnershipId: safePetOwnershipId, name: safeName });
}

export function setPetBehavior(behavior: 'follow' | 'assist' | 'passive') {
  sendUiMessage({ type: 'pet.setBehavior', behavior });
}

export function kickPartyMember(targetPlayerId: number | string) {
  const safeTargetPlayerId = Number(targetPlayerId || 0);
  if (!safeTargetPlayerId) return;
  sendUiMessage({ type: 'party.kick', targetPlayerId: safeTargetPlayerId });
}

export function promotePartyMember(targetPlayerId: number | string) {
  const safeTargetPlayerId = Number(targetPlayerId || 0);
  if (!safeTargetPlayerId) return;
  sendUiMessage({ type: 'party.promote', targetPlayerId: safeTargetPlayerId });
}

export function allocateStats(allocation: { str?: number; int?: number; dex?: number; vit?: number }) {
  const normalized = {
    str: Math.max(0, Math.floor(Number(allocation?.str || 0))),
    int: Math.max(0, Math.floor(Number(allocation?.int || 0))),
    dex: Math.max(0, Math.floor(Number(allocation?.dex || 0))),
    vit: Math.max(0, Math.floor(Number(allocation?.vit || 0)))
  };
  if (!normalized.str && !normalized.int && !normalized.dex && !normalized.vit) return;
  sendUiMessage({ type: 'stats.allocate', allocation: normalized });
}

export function buyNpcOffer(npcId: string, offerId: string, quantity = 1) {
  if (!npcId || !offerId) return;
  sendUiMessage({ type: 'npc.buy', npcId, offerId, quantity });
}

export function enterDungeonFromNpc(npcId: string, mode: 'open' | 'solo' | 'group') {
  if (!npcId) return;
  sendUiMessage({ type: 'dungeon.enter', npcId, mode });
}

export function acceptQuest(questId: string) {
  if (!questId) return;
  sendUiMessage({ type: 'quest.accept', questId });
}

export function completeQuest(questId: string) {
  if (!questId) return;
  sendUiMessage({ type: 'quest.complete', questId });
}

export function revivePlayer() {
  sendUiMessage({ type: 'player.revive' });
}

export function closeNpcDialog() {
  npcStore.set({ dialog: null, shopOpen: false });
  runtimeStore?.update({ npcDialog: null, npcShopOpen: false });
}

export function showTooltip(payload: any, x: number, y: number) {
  if (!payload) return;
  tooltipStore.set({ visible: true, x: Math.round(Number(x || 0)), y: Math.round(Number(y || 0)), payload });
}

export function hideTooltip() {
  tooltipStore.set({ visible: false, x: 0, y: 0, payload: null });
}

export function setMapSetting(key: keyof MapSettingsUiState, enabled: boolean) {
  const safeEnabled = Boolean(enabled);
  mapSettingsStore.update((current) => ({ ...current, [key]: safeEnabled }));
  if (key === 'autoAttackEnabled') {
    runtimeStore?.update({ autoAttackEnabled: safeEnabled });
  }
}

export function toggleMapSettings(force?: boolean) {
  mapSettingsStore.update((current) => ({
    ...current,
    open: typeof force === 'boolean' ? force : !current.open
  }));
}

export function setSelectedAutoAttack(skillId: string) {
  const requestedSkillId = String(skillId || 'class_primary') || 'class_primary';
  const skill = requestedSkillId === 'class_primary' ? null : getSkillTreeEntry(requestedSkillId);
  const safeSkillId = !skill || skill.target === 'mob' ? requestedSkillId : 'class_primary';
  selectedAutoAttackStore.set(safeSkillId);
  persistSelectedAutoAttack(safeSkillId);
}

export function cycleSelectedAutoAttack() {
  const skills = get(skillsStore);
  const options = Array.isArray(skills.autoAttack) && skills.autoAttack.length ? skills.autoAttack : [{ id: 'class_primary', label: 'Atk Basico', learned: true }];
  const currentId = get(selectedAutoAttackStore);
  const currentIndex = options.findIndex((entry) => entry.id === currentId);
  const next = options[(currentIndex + 1 + options.length) % options.length] || options[0];
  setSelectedAutoAttack(String(next?.id || 'class_primary'));
}

export function setPvpMode(mode: 'peace' | 'group' | 'evil') {
  sendUiMessage({ type: 'player.setPvpMode', mode });
}

export function switchInstance(mapId: string) {
  const safeMapId = String(mapId || '').trim().toUpperCase();
  if (!safeMapId) return;
  sendUiMessage({ type: 'switch_instance', mapId: safeMapId });
}

export function leaveDungeon() {
  sendUiMessage({ type: 'dungeon.leave' });
}

export function assignSkillToHotbar(skillId: string, skillName: string) {
  const safeSkillId = String(skillId || '').trim();
  if (!safeSkillId) return null;
  const normalized = normalizeHotbarBindings(get(hotbarBindingsStore));
  const existingKey = HOTBAR_KEYS.find((key) => normalized[key]?.type === 'action' && normalized[key]?.skillId === safeSkillId);
  const targetKey = existingKey || HOTBAR_KEYS.find((key) => !normalized[key]) || HOTBAR_KEYS[0];
  normalized[targetKey] = { type: 'action', actionId: 'skill_cast', skillId: safeSkillId, skillName: String(skillName || humanizeLabelId(safeSkillId)) };
  commitHotbarBindings(normalized);
  return targetKey;
}

export function setHudScale(nextScale: number) {
  const safeScale = Math.max(0.7, Math.min(1.4, Number(nextScale || 1)));
  document.documentElement.style.setProperty('--hud-scale', String(safeScale));
  hudScaleStore.set(safeScale);
}

export function resetHudScale() {
  setHudScale(1);
}

export function activateHotbarBinding(key: string) {
  const normalizedKey = String(key || '').toLowerCase();
  const binding = get(hotbarBindingsStore)?.[normalizedKey] || null;
  if (!binding) return;
  if (binding.type === 'item') {
    const inventory = get(inventoryStore);
    const item = inventory.inventory.find((entry: any) => String(entry?.id || '') === String(binding.itemId || ''))
      || inventory.inventory.find((entry: any) => String(entry?.type || '') === String(binding.itemType || ''));
    if (!item) return;
    activateInventoryItem(item);
    return;
  }
  if (binding.actionId === 'basic_attack') {
    const autoAttack = resolveAutoAttackDef(get(selectedAutoAttackStore), get(skillsStore));
    const selectedMobId = String(runtimeStore?.getState().selectedMobId || '');
    const selectedPlayerId = Number(runtimeStore?.getState().selectedPlayerId || 0);
    if (autoAttack.id !== 'class_primary' && selectedMobId) {
      sendUiMessage({ type: 'skill.cast', skillId: autoAttack.id, targetMobId: selectedMobId });
      return;
    }
    if (selectedMobId) {
      sendUiMessage({ type: 'target_mob', mobId: selectedMobId });
      return;
    }
    if (selectedPlayerId) {
      sendUiMessage({ type: 'combat.targetPlayer', targetPlayerId: selectedPlayerId });
    }
    return;
  }
  if (binding.actionId === 'skill_cast' && binding.skillId) {
    const skill = getSkillTreeEntry(String(binding.skillId || ''));
    if (!skill) return;
    if (skill.target === 'self') {
      sendUiMessage({ type: 'skill.cast', skillId: binding.skillId });
      return;
    }
    const selectedMobId = String(runtimeStore?.getState().selectedMobId || '');
    if (!selectedMobId) return;
    sendUiMessage({ type: 'skill.cast', skillId: binding.skillId, targetMobId: selectedMobId });
  }
}

export function toggleAfk() {
  sendUiMessage({ type: 'player.toggleAfk' });
}

export function sendAdminCommand(command: string) {
  const safeCommand = String(command || '').trim();
  if (!safeCommand) return;
  sendUiMessage({ type: 'admin_command', command: safeCommand });
}

export function setPathDebugEnabled(enabled: boolean) {
  runtimeStore?.update({ pathDebugEnabled: Boolean(enabled) });
}

export function setInteractionDebugEnabled(enabled: boolean) {
  runtimeStore?.update({ interactionDebugEnabled: Boolean(enabled) });
}

export function setMobPeacefulEnabled(enabled: boolean) {
  sendUiMessage({ type: 'admin.setMobPeaceful', enabled: Boolean(enabled) });
}

export function bindHudRuntime(gameStore: GameStore, socket: GameSocket) {
  runtimeSocket = socket;
  runtimeStore = gameStore;
  loadingTraceStore.set([]);
  loadingPacketStore.set(DEFAULT_LOADING_PACKETS);
  pushLoadingTrace('Runtime HUD conectado ao GameStore.');
  let lastInventoryRef: any = null;
  let lastEquippedRef: any = null;
  let lastWalletRef: any = null;
  let lastHotbarRef: any = null;
  let lastPlayerRef: any = null;
  let lastChatRef: any = null;
  let lastNpcDialogRef: any = null;
  let lastNpcShopOpen = false;
  let lastQuestRef: any = null;
  let lastPartyRef: any = null;
  let lastPartyAreaRef: any = null;
  let lastPartyInvitesRef: any = null;
  let lastPartyJoinRequestsRef: any = null;
  let lastDungeonReadyRef: any = null;
  let lastFriendStateRef: any = null;
  let lastTradeStateRef: any = null;
  let lastStorageStateRef: any = null;
  let lastGuildStateRef: any = null;
  let lastPetStateRef: any = null;
  let lastAdminResultRef: any = null;
  let lastAdminIsAdmin = false;
  let lastAdminPingMs: number | null = null;
  let lastAdminSocketConnected = false;
  let lastAdminPathDebugEnabled = false;
  let lastAdminInteractionDebugEnabled = false;
  let lastAdminMobPeacefulEnabled = false;
  let lastAutoAttackEnabled = true;
  let lastConnectionPhase = '';
  let lastAuthMessage = '';
  let lastSelectedCharacterSlot: number | null = null;
  let lastCharacterSlotsRef: any = null;
  let lastPlayerId: number | null = null;
  let lastSelectedMobId: string | null = null;
  let lastSelectedPlayerId: number | null = null;
  let lastWorldRef: any = null;
  let lastWorldPlayerRef: any = null;
  let lastMapCode = '';
  let lastCoordsText = '';
  let lastLoadingState: LoadingUiState = runtimeLoadingState;
  let lastLoadingSnapshot = '';
  let lastSyncTraceSnapshot = '';
  let syncQueued = false;
  let syncFrameId = 0;

  const sync = () => {
    const syncStartedAt = performance.now();
    try {
      const state = gameStore.getState();
      const syncSnapshot = [
        state.connectionPhase,
        state.worldStatic ? 'static1' : 'static0',
        state.worldState ? 'state1' : 'state0',
        state.inventoryState ? 'inv1' : 'inv0',
        state.playerId ? `player${state.playerId}` : 'player0'
      ].join('|');
      const shouldTraceSyncStart = syncSnapshot !== lastSyncTraceSnapshot;
      if (shouldTraceSyncStart) {
        lastSyncTraceSnapshot = syncSnapshot;
      }
      const player = state.playerId ? state.resolvedWorld?.players?.[String(state.playerId)] || null : null;
    const inventory = Array.isArray(state.inventoryState?.inventory) ? state.inventoryState.inventory : [];
    const equippedBySlot = state.inventoryState?.equippedBySlot || {};
    const wallet = state.inventoryState?.wallet || player?.wallet || null;
    if (inventory !== lastInventoryRef || equippedBySlot !== lastEquippedRef || wallet !== lastWalletRef) {
      lastInventoryRef = inventory;
      lastEquippedRef = equippedBySlot;
      lastWalletRef = wallet;
      inventoryStore.set({ inventory, equippedBySlot, wallet });
    }

    const hotbarBindings = normalizeHotbarBindings(state.hotbarBindings && typeof state.hotbarBindings === 'object' ? state.hotbarBindings : {});
    if (state.hotbarBindings !== lastHotbarRef) {
      lastHotbarRef = state.hotbarBindings;
      hotbarBindingsStore.set(hotbarBindings);
    }

    if (player !== lastPlayerRef) {
      lastPlayerRef = player;
      attributesStore.set({
        player,
        hpRatio: player ? Math.max(0, Math.min(1, Number(player.hp || 0) / Math.max(1, Number(player.maxHp || 1)))) : 0
      });
    }

    const chatMessages = Array.isArray(state.chatMessages)
      ? state.chatMessages
        .slice(-120)
        .map((entry: any) => normalizeChatMessage(entry, Number(state.playerId || 0) || null, String(player?.name || '')))
        .filter(Boolean) as ChatUiMessage[]
      : [];
    if (state.chatMessages !== lastChatRef) {
      lastChatRef = state.chatMessages;
      const lastTradeMessage = resolveLastTradeMessage(chatMessages);
      const whisperTarget = resolveLastWhisperTarget(chatMessages, String(player?.name || ''));
      chatStore.update((current) => ({
        ...current,
        messages: chatMessages,
        lastTradeMessage,
        lastWhisperTarget: whisperTarget || current.lastWhisperTarget
      }));
    }

    const npcDialog = state.npcDialog || null;
    const npcShopOpen = Boolean(state.npcShopOpen);
    if (npcDialog !== lastNpcDialogRef || npcShopOpen !== lastNpcShopOpen) {
      lastNpcDialogRef = npcDialog;
      lastNpcShopOpen = npcShopOpen;
      npcStore.set({ dialog: npcDialog, shopOpen: npcShopOpen });
    }

    const quests = Array.isArray(state.questState) ? state.questState : [];
    if (quests !== lastQuestRef) {
      lastQuestRef = quests;
      questStore.set({ quests });
    }

    const party = state.partyState || null;
    const areaList = Array.isArray(state.partyAreaList) ? state.partyAreaList : [];
    const invites = Array.isArray(state.partyInvites) ? state.partyInvites : [];
    const joinRequests = Array.isArray(state.partyJoinRequests) ? state.partyJoinRequests : [];
    const dungeonReady = state.dungeonReadyState || null;
    if (
      party !== lastPartyRef
      || areaList !== lastPartyAreaRef
      || invites !== lastPartyInvitesRef
      || joinRequests !== lastPartyJoinRequestsRef
      || dungeonReady !== lastDungeonReadyRef
    ) {
      lastPartyRef = party;
      lastPartyAreaRef = areaList;
      lastPartyInvitesRef = invites;
      lastPartyJoinRequestsRef = joinRequests;
      lastDungeonReadyRef = dungeonReady;
      partyStore.set({ party, areaList, invites, joinRequests, dungeonReady });
    }

    const friendState = state.friendState || null;
    if (friendState !== lastFriendStateRef) {
      lastFriendStateRef = friendState;
      friendStore.set({ state: friendState });
    }

    const tradeState = state.tradeState || null;
    if (tradeState !== lastTradeStateRef) {
      lastTradeStateRef = tradeState;
      tradeStore.set({ state: tradeState });
      const tradeOpen = Boolean(tradeState?.session || tradeState?.incomingRequest || tradeState?.outgoingRequest);
      panelStore.update((current) => ({ ...current, trade: tradeOpen ? true : current.trade && tradeOpen }));
      if (!tradeOpen) {
        panelStore.update((current) => ({ ...current, trade: false }));
      }
    }

    const storageState = state.storageState || null;
    if (storageState !== lastStorageStateRef) {
      lastStorageStateRef = storageState;
      storageStore.set({ state: storageState });
      panelStore.update((current) => ({ ...current, storage: Boolean(storageState?.open) }));
    }

    const guildState = state.guildState || null;
    if (guildState !== lastGuildStateRef) {
      lastGuildStateRef = guildState;
      guildStore.set({ state: guildState });
    }

    const petState = state.petState || null;
    if (petState !== lastPetStateRef) {
      lastPetStateRef = petState;
      petStore.set({ state: petState });
    }

    const autoAttackEnabled = Boolean(state.autoAttackEnabled);
    if (autoAttackEnabled !== lastAutoAttackEnabled) {
      lastAutoAttackEnabled = autoAttackEnabled;
      mapSettingsStore.update((current) => ({ ...current, autoAttackEnabled }));
    }

    const adminResult = state.adminResult || null;
    const isAdmin = String(player?.role || '').toLowerCase() === 'adm';
    const pingMs = Number.isFinite(Number(state.networkPingMs)) ? Math.max(0, Math.round(Number(state.networkPingMs))) : null;
    const socketConnected = Boolean(state.socketConnected);
    const pathDebugEnabled = Boolean(state.pathDebugEnabled);
    const interactionDebugEnabled = Boolean(state.interactionDebugEnabled);
    const mobPeacefulEnabled = Boolean(state.adminMobPeacefulEnabled);
    if (
      adminResult !== lastAdminResultRef
      || isAdmin !== lastAdminIsAdmin
      || pingMs !== lastAdminPingMs
      || socketConnected !== lastAdminSocketConnected
      || pathDebugEnabled !== lastAdminPathDebugEnabled
      || interactionDebugEnabled !== lastAdminInteractionDebugEnabled
      || mobPeacefulEnabled !== lastAdminMobPeacefulEnabled
    ) {
      lastAdminResultRef = adminResult;
      lastAdminIsAdmin = isAdmin;
      lastAdminPingMs = pingMs;
      lastAdminSocketConnected = socketConnected;
      lastAdminPathDebugEnabled = pathDebugEnabled;
      lastAdminInteractionDebugEnabled = interactionDebugEnabled;
      lastAdminMobPeacefulEnabled = mobPeacefulEnabled;
      adminStore.set({
        result: adminResult,
        isAdmin,
        pingMs,
        socketConnected,
        pathDebugEnabled,
        interactionDebugEnabled,
        mobPeacefulEnabled
      });
    }

    const connectionPhase = state.connectionPhase;
    const authMessage = state.authMessage || '';
    const selectedCharacterSlot = state.selectedCharacterSlot;
    const characterSlots = Array.isArray(state.characterSlots) ? state.characterSlots : [];
    const playerId = state.playerId;
    if (
      connectionPhase !== lastConnectionPhase
      || authMessage !== lastAuthMessage
      || selectedCharacterSlot !== lastSelectedCharacterSlot
      || characterSlots !== lastCharacterSlotsRef
      || playerId !== lastPlayerId
    ) {
      if (connectionPhase !== lastConnectionPhase) {
        pushLoadingTrace(`Fase alterada para ${connectionPhase}.`);
      }
      lastConnectionPhase = connectionPhase;
      lastAuthMessage = authMessage;
      lastSelectedCharacterSlot = selectedCharacterSlot;
      lastCharacterSlotsRef = characterSlots;
      lastPlayerId = playerId;
      appStore.set({ connectionPhase, authMessage, selectedCharacterSlot, characterSlots, playerId });
    }

    const selectedMobId = state.selectedMobId ? String(state.selectedMobId) : null;
    const selectedPlayerId = state.selectedPlayerId == null ? null : (Number.isFinite(Number(state.selectedPlayerId)) ? Number(state.selectedPlayerId) : null);
    if (selectedMobId !== lastSelectedMobId || selectedPlayerId !== lastSelectedPlayerId) {
      lastSelectedMobId = selectedMobId;
      lastSelectedPlayerId = selectedPlayerId;
      selectionStore.set({ selectedMobId, selectedPlayerId });
    }

    const world = state.resolvedWorld || null;
    const mapCode = String(
      state.resolvedWorld?.mapCode
      || ({ city: 'A0', forest: 'A1', lava: 'A2', undead: 'A3' } as Record<string, string>)[String(state.resolvedWorld?.mapKey || '').toLowerCase()]
      || '-'
    ).toUpperCase();
    const mapId = String(state.resolvedWorld?.mapId || '-').toUpperCase();
    const coordsText = player ? `X: ${Math.round(Number(player.x || 0))} | Y: ${Math.round(Number(player.y || 0))}` : 'X: -- | Y: --';
    if (world !== lastWorldRef || player !== lastWorldPlayerRef || mapCode !== lastMapCode || coordsText !== lastCoordsText) {
      lastWorldRef = world;
      lastWorldPlayerRef = player;
      lastMapCode = mapCode;
      lastCoordsText = coordsText;
      worldStore.set({ world, player, mapCode, mapId, coordsText });
    }
    const worldReady = Boolean(state.resolvedWorld);
    const mapReady = Boolean(state.resolvedWorld?.mapCode || state.resolvedWorld?.world || state.resolvedWorld?.mapTiled);
    const playerReady = Boolean(player);
    const inventoryReady = state.inventoryState !== null;
    const allowPendingWorldEntry = state.connectionPhase === 'character_select' || state.connectionPhase === 'in_game';
    const pendingWorldEntry = allowPendingWorldEntry ? runtimeLoadingState.pendingWorldEntry : false;
    const ready = state.connectionPhase === 'in_game' && worldReady && playerReady;
    const shouldShowLoading = pendingWorldEntry || (state.connectionPhase === 'in_game' && !ready);
    let progress = 0;
    let title = 'Preparando jornada';
    let detail = 'Aguardando comando de entrada.';

    if (shouldShowLoading) {
      progress = 0.1;
      title = 'Entrando no mundo';
      detail = 'Estabelecendo sessao do personagem.';
      if (state.playerId) {
        progress = 0.28;
        detail = 'Personagem autenticado. Recebendo dados iniciais.';
      }
      if (state.connectionPhase === 'in_game') {
        progress = Math.max(progress, 0.42);
        detail = 'Conectado ao mundo. Sincronizando mapa.';
      }
      if (worldReady) {
        progress = Math.max(progress, 0.64);
        detail = 'Estado do mundo recebido.';
      }
      if (mapReady) {
        progress = Math.max(progress, 0.78);
        detail = 'Preparando mapa e entidades visiveis.';
      }
      if (playerReady) {
        progress = Math.max(progress, 0.9);
        detail = 'Personagem posicionado. Finalizando interface.';
      }
      if (inventoryReady) {
        progress = Math.max(progress, 0.96);
      }
      if (ready) {
        progress = 1;
        detail = 'Tudo pronto. Abrindo o mundo.';
      }
    }

    const nextLoading = {
      active: shouldShowLoading,
      progress,
      title,
      detail,
      pendingWorldEntry: ready ? false : pendingWorldEntry,
      ready
    };
    const loadingChanged = nextLoading.active !== lastLoadingState.active
      || nextLoading.progress !== lastLoadingState.progress
      || nextLoading.title !== lastLoadingState.title
      || nextLoading.detail !== lastLoadingState.detail
      || nextLoading.pendingWorldEntry !== lastLoadingState.pendingWorldEntry
      || nextLoading.ready !== lastLoadingState.ready;
      if (loadingChanged) {
        if (nextLoading.active !== lastLoadingState.active) {
          pushLoadingTrace(nextLoading.active ? 'Overlay de loading ativado.' : 'Overlay de loading ocultado.');
        }
        if (!lastLoadingState.ready && nextLoading.ready) {
          pushLoadingTrace('Estado minimo do mundo concluido para liberar a HUD.');
        }
        lastLoadingState = nextLoading;
        runtimeLoadingState = nextLoading;
        loadingStore.set(nextLoading);
      }

      if (state.connectionPhase === 'in_game') {
        const loadingSnapshot = [
          worldReady ? 'world ok' : 'world pendente',
          mapReady ? 'map ok' : 'map pendente',
          playerReady ? 'player ok' : 'player pendente',
          inventoryReady ? 'inventory ok' : 'inventory pendente'
        ].join(' | ');
        if (loadingSnapshot !== lastLoadingSnapshot) {
          lastLoadingSnapshot = loadingSnapshot;
          bootDiagnostics.log('hud', 'loading-state', loadingSnapshot);
        }
      }

      persistLoadingDebugSnapshot();
    } catch (error) {
      const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      bootDiagnostics.error('hud', 'sync-error', `bindHudRuntime.sync falhou: ${message}`);
      pushLoadingTrace(`Falha ao tratar HUD de loading: ${message}`);
    }
    const syncMs = Math.max(0, Math.round((performance.now() - syncStartedAt) * 100) / 100);
    if (syncMs >= 16) {
      bootDiagnostics.warn('hud', 'slow-sync', `bindHudRuntime.sync lento (${syncMs.toFixed(2)}ms).`);
    }
  };

  const syncHudScale = () => {
    const rootStyles = getComputedStyle(document.documentElement);
    const hudScale = parseFloat(rootStyles.getPropertyValue('--hud-scale') || '1');
    const compensation = parseFloat(
      getComputedStyle(document.getElementById('ui-root') || document.documentElement)
        .getPropertyValue('--hud-browser-compensation') || '1'
    );
    hudScaleStore.set(Number.isFinite(hudScale) && hudScale > 0 ? hudScale : 1);
    hudBrowserCompensationStore.set(Number.isFinite(compensation) && compensation > 0 ? compensation : 1);
  };

  sync();
  syncHudScale();
  selectedAutoAttackStore.set(loadSelectedAutoAttack());

  const onChange = () => {
    if (syncQueued) return;
    syncQueued = true;
    syncFrameId = requestAnimationFrame(() => {
      syncQueued = false;
      syncFrameId = 0;
      sync();
    });
  };
  const onResize = () => syncHudScale();

  gameStore.addEventListener('change', onChange as EventListener);
  window.addEventListener('resize', onResize);

  return () => {
    if (loadingDebugPersistTimer) {
      clearTimeout(loadingDebugPersistTimer);
      loadingDebugPersistTimer = 0;
    }
    if (syncFrameId) cancelAnimationFrame(syncFrameId);
    gameStore.removeEventListener('change', onChange as EventListener);
    window.removeEventListener('resize', onResize);
    runtimeSocket = null;
    runtimeStore = null;
  };
}
