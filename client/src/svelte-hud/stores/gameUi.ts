import { derived, writable } from 'svelte/store';
import type { GameStore } from '../../game/state/GameStore';
import type { GameSocket } from '../../game/net/GameSocket';

type InventoryUiState = {
  inventory: any[];
  equippedBySlot: Record<string, any>;
  wallet: any;
};

type AttributeUiState = {
  player: any | null;
  hpRatio: number;
};

type ChatUiState = {
  messages: any[];
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
};

type WorldUiState = {
  world: any | null;
  player: any | null;
  mapCode: string;
  coordsText: string;
};

type PanelUiState = {
  character: boolean;
  inventory: boolean;
  skills: boolean;
  map: boolean;
};

type DragPayload =
  | { source: 'inventory'; itemId: string }
  | { source: 'equipment'; itemId: string; slot: string }
  | { source: 'skill'; skillId: string; skillName: string }
  | { source: 'basic'; skillId: 'class_primary'; skillName: string }
  | { source: 'hotbar'; key: string }
  | null;

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
  messages: []
};

const DEFAULT_NPC: NpcUiState = {
  dialog: null,
  shopOpen: false
};

const DEFAULT_APP: AppUiState = {
  connectionPhase: 'connecting',
  authMessage: '',
  selectedCharacterSlot: null,
  characterSlots: []
};

const DEFAULT_WORLD: WorldUiState = {
  world: null,
  player: null,
  mapCode: '-',
  coordsText: 'X: -- | Y: --'
};

let runtimeSocket: GameSocket | null = null;
let runtimeStore: GameStore | null = null;

const SKILL_TREE = buildSkillTree();

export const inventoryStore = writable<InventoryUiState>(DEFAULT_INVENTORY);
export const attributesStore = writable<AttributeUiState>(DEFAULT_ATTRIBUTES);
export const chatStore = writable<ChatUiState>(DEFAULT_CHAT);
export const npcStore = writable<NpcUiState>(DEFAULT_NPC);
export const appStore = writable<AppUiState>(DEFAULT_APP);
export const worldStore = writable<WorldUiState>(DEFAULT_WORLD);
export const panelStore = writable<PanelUiState>({
  character: false,
  inventory: true,
  skills: false,
  map: false
});
export const dragStore = writable<DragPayload>(null);
export const hudScaleStore = writable(1);
export const hudBrowserCompensationStore = writable(1);
export const hotbarBindingsStore = writable<Record<string, any>>({});

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

export const hotbarSlots = derived(
  [hotbarBindingsStore, inventoryStore],
  ([$hotbarBindingsStore, $inventoryStore]) => HOTBAR_KEYS.map((key) => {
    const binding = $hotbarBindingsStore?.[key] || null;
    let iconUrl = '';
    let label = key.toUpperCase();
    if (binding?.type === 'item') {
      const item = findItemById($inventoryStore, String(binding.itemId || ''));
      iconUrl = resolveIcon(item || binding);
      label = String(binding.itemName || item?.name || 'Item');
    }
    if (binding?.type === 'action' && binding.actionId === 'skill_cast') {
      label = String(binding.skillName || humanizeSkillId(String(binding.skillId || '')));
    }
    if (binding?.type === 'action' && binding.actionId === 'basic_attack') {
      label = 'Atk Basico';
    }
    return { key, binding, iconUrl, label };
  })
);

export const playerStats = derived(attributesStore, ($attributesStore) => {
  const player = $attributesStore.player || {};
  const base = player?.allocatedStats && typeof player.allocatedStats === 'object'
    ? player.allocatedStats
    : { str: 0, int: 0, dex: 0, vit: 0 };
  const stats = player?.stats && typeof player.stats === 'object'
    ? player.stats
    : {};
  return {
    level: Number(player.level || 1),
    xp: Number(player.xp || 0),
    xpToNext: Number(player.xpToNext || 0),
    hp: Number(player.hp || 0),
    maxHp: Number(player.maxHp || 0),
    className: String(player.class || 'knight'),
    unspentPoints: Number(player.unspentPoints || 0),
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

export const skillsStore = derived(attributesStore, ($attributesStore) => {
  const player = $attributesStore.player || {};
  const skillLevels = player?.skillLevels && typeof player.skillLevels === 'object' ? player.skillLevels : {};
  const classId = String(player?.class || 'knight');
  const entries = SKILL_TREE
    .filter((entry) => entry.classId === classId)
    .map((entry) => ({
      ...entry,
      level: Math.max(0, Math.min(entry.maxPoints, Number(skillLevels[entry.id] || 0))),
      learned: Number(skillLevels[entry.id] || 0) > 0
    }));
  return {
    classId,
    skillPoints: Number(player?.skillPointsAvailable || 0),
    entries,
    autoAttack: [{ id: 'class_primary', label: 'Atk Basico', learned: true }, ...entries.filter((entry) => entry.learned).map((entry) => ({ id: entry.id, label: entry.label, learned: true }))]
  };
});

export const hudTransformStyle = derived(
  [hudScaleStore, hudBrowserCompensationStore],
  ([$hudScaleStore, $hudBrowserCompensationStore]) =>
    `transform: scale(${$hudBrowserCompensationStore}); --hud-scale: ${$hudScaleStore};`
);

function buildSkillTree() {
  const defs = {
    knight: { a: ['Escudo da Fe|war_bastion_escudo_fe', 'Muralha|war_bastion_muralha', 'Renovacao|war_bastion_renovacao', 'Inabalavel|war_bastion_inabalavel', 'Impacto Sismico|war_bastion_impacto_sismico'], b: ['Frenesi|war_carrasco_frenesi', 'Lacerar|war_carrasco_lacerar', 'Ira|war_carrasco_ira', 'Golpe de Sacrificio|war_carrasco_golpe_sacrificio', 'Aniquilacao|war_carrasco_aniquilacao'], labels: ['Bastiao', 'Carrasco'] },
    archer: { a: ['Tiro Ofuscante|arc_patrulheiro_tiro_ofuscante', 'Foco Distante|arc_patrulheiro_foco_distante', 'Abrolhos|arc_patrulheiro_abrolhos', 'Salva de Flechas|arc_patrulheiro_salva_flechas', 'Passo de Vento|arc_patrulheiro_passo_vento'], b: ['Flecha Debilitante|arc_franco_flecha_debilitante', 'Ponteira Envenenada|arc_franco_ponteira_envenenada', 'Olho de Aguia|arc_franco_olho_aguia', 'Disparo Perfurante|arc_franco_disparo_perfurante', 'Tiro de Misericordia|arc_franco_tiro_misericordia'], labels: ['Patrulheiro', 'Franco'] },
    druid: { a: ['Florescer|dru_preservador_florescer', 'Casca de Ferro|dru_preservador_casca_ferro', 'Emaranhado|dru_preservador_emaranhado', 'Prece da Natureza|dru_preservador_prece_natureza', 'Avatar Espiritual|dru_preservador_avatar_espiritual'], b: ['Espinhos|dru_primal_espinhos', 'Enxame|dru_primal_enxame', 'Patada Sombria|dru_primal_patada_sombria', 'Nevoa Obscura|dru_primal_nevoa_obscura', 'Invocacao Primal|dru_primal_invocacao_primal'], labels: ['Preservador', 'Primal'] },
    assassin: { a: ['Reflexos|ass_agil_reflexos', 'Contra-Ataque|ass_agil_contra_ataque', 'Passo Fantasma|ass_agil_passo_fantasma', 'Golpe de Nervos|ass_agil_golpe_nervos', 'Miragem|ass_agil_miragem'], b: ['Expor Fraqueza|ass_letal_expor_fraqueza', 'Ocultar|ass_letal_ocultar', 'Emboscada|ass_letal_emboscada', 'Bomba de Fumaca|ass_letal_bomba_fumaca', 'Sentenca|ass_letal_sentenca'], labels: ['Agil', 'Letal'] }
  } as const;
  const out: Array<{ id: string; classId: string; buildKey: 'buildA' | 'buildB'; buildLabel: string; label: string; prereq: string | null; maxPoints: number }> = [];
  for (const [classId, def] of Object.entries(defs)) {
    def.a.forEach((raw, idx) => { const [label, id] = raw.split('|'); out.push({ id, classId, buildKey: 'buildA', buildLabel: def.labels[0], label, prereq: idx > 0 ? def.a[idx - 1].split('|')[1] : null, maxPoints: 5 }); });
    def.b.forEach((raw, idx) => { const [label, id] = raw.split('|'); out.push({ id, classId, buildKey: 'buildB', buildLabel: def.labels[1], label, prereq: idx > 0 ? def.b[idx - 1].split('|')[1] : null, maxPoints: 5 }); });
  }
  return out;
}

function humanizeSkillId(id: string) {
  return String(id || 'habilidade').replace(/[_-]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
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

export function sendUiMessage(payload: Record<string, unknown>) {
  runtimeSocket?.send(payload);
}

export function selectCharacterSlot(slot: number) {
  runtimeStore?.update({ selectedCharacterSlot: slot });
}

export function setConnectionPhase(phase: string) {
  runtimeStore?.update({ connectionPhase: phase as any });
}

export function togglePanel(panel: keyof PanelUiState) {
  panelStore.update((current) => ({ ...current, [panel]: !current[panel] }));
}

export function openPanel(panel: keyof PanelUiState) {
  panelStore.update((current) => ({ ...current, [panel]: true }));
}

export function closeAllPanels() {
  panelStore.set({ character: false, inventory: false, skills: false, map: false });
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
  const next = normalizeHotbarBindings(getStoreValue(hotbarBindingsStore));
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

export function bindHudRuntime(gameStore: GameStore, socket: GameSocket) {
  runtimeSocket = socket;
  runtimeStore = gameStore;

  const sync = () => {
    const state = gameStore.getState();
    const player = state.playerId ? state.resolvedWorld?.players?.[String(state.playerId)] || null : null;
    inventoryStore.set({
      inventory: Array.isArray(state.inventoryState?.inventory) ? state.inventoryState.inventory : [],
      equippedBySlot: state.inventoryState?.equippedBySlot || {},
      wallet: state.inventoryState?.wallet || player?.wallet || null
    });
    hotbarBindingsStore.set(normalizeHotbarBindings(state.hotbarBindings && typeof state.hotbarBindings === 'object' ? state.hotbarBindings : {}));
    attributesStore.set({
      player,
      hpRatio: player ? Math.max(0, Math.min(1, Number(player.hp || 0) / Math.max(1, Number(player.maxHp || 1)))) : 0
    });
    chatStore.set({
      messages: Array.isArray(state.chatMessages) ? state.chatMessages.slice(-60) : []
    });
    npcStore.set({
      dialog: state.npcDialog || null,
      shopOpen: Boolean(state.npcShopOpen)
    });
    appStore.set({
      connectionPhase: state.connectionPhase,
      authMessage: state.authMessage || '',
      selectedCharacterSlot: state.selectedCharacterSlot,
      characterSlots: Array.isArray(state.characterSlots) ? state.characterSlots : []
    });
    worldStore.set({
      world: state.resolvedWorld || null,
      player,
      mapCode: String(state.resolvedWorld?.mapCode || '-').toUpperCase(),
      coordsText: player ? `X: ${Math.round(Number(player.x || 0))} | Y: ${Math.round(Number(player.y || 0))}` : 'X: -- | Y: --'
    });
  };

  const syncHudScale = () => {
    const rootStyles = getComputedStyle(document.documentElement);
    const hudScale = parseFloat(rootStyles.getPropertyValue('--hud-scale') || '1');
    const compensation = parseFloat(
      getComputedStyle(document.getElementById('hud-root') || document.documentElement)
        .getPropertyValue('--hud-browser-compensation') || '1'
    );
    hudScaleStore.set(Number.isFinite(hudScale) && hudScale > 0 ? hudScale : 1);
    hudBrowserCompensationStore.set(Number.isFinite(compensation) && compensation > 0 ? compensation : 1);
  };

  sync();
  syncHudScale();

  const onChange = () => sync();
  const onResize = () => syncHudScale();

  gameStore.addEventListener('change', onChange as EventListener);
  window.addEventListener('resize', onResize);

  return () => {
    gameStore.removeEventListener('change', onChange as EventListener);
    window.removeEventListener('resize', onResize);
    runtimeSocket = null;
    runtimeStore = null;
  };
}

function getStoreValue<T>(store: { subscribe: (run: (value: T) => void) => () => void }) {
  let value!: T;
  const unsubscribe = store.subscribe((current) => { value = current; });
  unsubscribe();
  return value;
}
