import { derived, get, writable } from 'svelte/store';
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

let runtimeSocket: GameSocket | null = null;
let runtimeStore: GameStore | null = null;

const SKILL_TREE = buildSkillTree();

export const inventoryStore = writable<InventoryUiState>(DEFAULT_INVENTORY);
export const attributesStore = writable<AttributeUiState>(DEFAULT_ATTRIBUTES);
export const chatStore = writable<ChatUiState>(DEFAULT_CHAT);
export const npcStore = writable<NpcUiState>(DEFAULT_NPC);
export const appStore = writable<AppUiState>(DEFAULT_APP);
export const worldStore = writable<WorldUiState>(DEFAULT_WORLD);
export const questStore = writable<QuestUiState>(DEFAULT_QUESTS);
export const partyStore = writable<PartyUiState>(DEFAULT_PARTY);
export const friendStore = writable<FriendUiState>(DEFAULT_FRIENDS);
export const adminStore = writable<AdminUiState>(DEFAULT_ADMIN);
export const loadingStore = writable<LoadingUiState>(DEFAULT_LOADING);
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

export const selectedAutoAttackLabelStore = derived(
  [selectedAutoAttackStore, skillsStore],
  ([$selectedAutoAttackStore, $skillsStore]) => resolveAutoAttackDef($selectedAutoAttackStore, $skillsStore).label
);

export const hudTransformStyle = derived(
  [hudScaleStore, hudBrowserCompensationStore],
  ([$hudScaleStore, $hudBrowserCompensationStore]) =>
    `transform: scale(${$hudBrowserCompensationStore}); --hud-scale: ${$hudScaleStore};`
);

function buildSkillTree(): SkillTreeNode[] {
  const tiers = [1, 10, 20, 30, 40];
  const defs = {
    knight: {
      a: [
        { label: 'Escudo da Fe', id: 'war_bastion_escudo_fe', summary: 'Ergue a guarda sagrada e fortalece defesa fisica e magica.', target: 'self', cooldownMs: 12000, role: 'Buff' },
        { label: 'Muralha', id: 'war_bastion_muralha', summary: 'Transforma o cavaleiro em uma muralha que reduz dano e reflete parte do impacto.', target: 'self', cooldownMs: 14000, role: 'Buff' },
        { label: 'Renovacao', id: 'war_bastion_renovacao', summary: 'Canaliza vigor e restaura vida com base na vitalidade.', target: 'self', cooldownMs: 10000, role: 'Cura' },
        { label: 'Inabalavel', id: 'war_bastion_inabalavel', summary: 'Ativa um estado de resistencia extrema para segurar chefes e ondas.', target: 'self', cooldownMs: 26000, role: 'Buff' },
        { label: 'Impacto Sismico', id: 'war_bastion_impacto_sismico', summary: 'Golpe em area que abre espaco entre grupos de monstros.', target: 'mob', cooldownMs: 9000, range: 105, role: 'Area' }
      ],
      b: [
        { label: 'Frenesi', id: 'war_carrasco_frenesi', summary: 'Libera sede de batalha e converte parte do dano em cura.', target: 'self', cooldownMs: 14000, role: 'Buff' },
        { label: 'Lacerar', id: 'war_carrasco_lacerar', summary: 'Corte pesado de curta distancia para iniciar pressao ofensiva.', target: 'mob', cooldownMs: 6500, range: 95, role: 'Ataque' },
        { label: 'Ira', id: 'war_carrasco_ira', summary: 'Troca defesa por dano bruto e velocidade de ataque.', target: 'self', cooldownMs: 12000, role: 'Buff' },
        { label: 'Golpe de Sacrificio', id: 'war_carrasco_golpe_sacrificio', summary: 'Ataque devastador que consome a propria vida para amplificar o impacto.', target: 'mob', cooldownMs: 9500, range: 100, role: 'Ataque' },
        { label: 'Aniquilacao', id: 'war_carrasco_aniquilacao', summary: 'Finalizador que escala melhor quando o guerreiro esta ferido.', target: 'mob', cooldownMs: 12000, range: 115, role: 'Execucao' }
      ],
      labels: ['Bastiao', 'Carrasco']
    },
    archer: {
      a: [
        { label: 'Tiro Ofuscante', id: 'arc_patrulheiro_tiro_ofuscante', summary: 'Disparo seguro para abrir combate a longa distancia.', target: 'mob', cooldownMs: 6500, range: 420, role: 'Ataque' },
        { label: 'Foco Distante', id: 'arc_patrulheiro_foco_distante', summary: 'Ajusta a postura de tiro e aumenta consistencia ofensiva.', target: 'self', cooldownMs: 12000, role: 'Buff' },
        { label: 'Abrolhos', id: 'arc_patrulheiro_abrolhos', summary: 'Projete espinhos no caminho do alvo e controle a aproximacao.', target: 'mob', cooldownMs: 8500, range: 360, role: 'Controle' },
        { label: 'Salva de Flechas', id: 'arc_patrulheiro_salva_flechas', summary: 'Rajada em cone para limpar grupos de monstros.', target: 'mob', cooldownMs: 11000, range: 420, role: 'Area' },
        { label: 'Passo de Vento', id: 'arc_patrulheiro_passo_vento', summary: 'Aumenta mobilidade para kite e reposicionamento.', target: 'self', cooldownMs: 13000, role: 'Buff' }
      ],
      b: [
        { label: 'Flecha Debilitante', id: 'arc_franco_flecha_debilitante', summary: 'Disparo focado que enfraquece a presa.', target: 'mob', cooldownMs: 7000, range: 430, role: 'Ataque' },
        { label: 'Ponteira Envenenada', id: 'arc_franco_ponteira_envenenada', summary: 'Ataque toxico que continua corroendo o alvo.', target: 'mob', cooldownMs: 7500, range: 430, role: 'Ataque' },
        { label: 'Olho de Aguia', id: 'arc_franco_olho_aguia', summary: 'Buff de precisao critica para burst em janelas curtas.', target: 'self', cooldownMs: 13000, role: 'Buff' },
        { label: 'Disparo Perfurante', id: 'arc_franco_disparo_perfurante', summary: 'Tiro de alto impacto para alvos prioritarios.', target: 'mob', cooldownMs: 9000, range: 450, role: 'Ataque' },
        { label: 'Tiro de Misericordia', id: 'arc_franco_tiro_misericordia', summary: 'Finalizador de longa distancia contra alvos enfraquecidos.', target: 'mob', cooldownMs: 12000, range: 450, role: 'Execucao' }
      ],
      labels: ['Patrulheiro', 'Franco']
    },
    druid: {
      a: [
        { label: 'Florescer', id: 'dru_preservador_florescer', summary: 'Cura basica para estabilizar o druida em combate.', target: 'self', cooldownMs: 9000, role: 'Cura' },
        { label: 'Casca de Ferro', id: 'dru_preservador_casca_ferro', summary: 'Endurece a pele e amplia a sobrevivencia.', target: 'self', cooldownMs: 12000, role: 'Buff' },
        { label: 'Emaranhado', id: 'dru_preservador_emaranhado', summary: 'Raizes magicas prendem e atingem varios alvos.', target: 'mob', cooldownMs: 8500, range: 360, role: 'Controle' },
        { label: 'Prece da Natureza', id: 'dru_preservador_prece_natureza', summary: 'Grande cura para sustentacao em lutas longas.', target: 'self', cooldownMs: 14500, role: 'Cura' },
        { label: 'Avatar Espiritual', id: 'dru_preservador_avatar_espiritual', summary: 'Forma espiritual que melhora ritmo de combate e mobilidade.', target: 'self', cooldownMs: 18000, role: 'Buff' }
      ],
      b: [
        { label: 'Espinhos', id: 'dru_primal_espinhos', summary: 'Aura reativa que devolve dano aos atacantes.', target: 'self', cooldownMs: 12000, role: 'Buff' },
        { label: 'Enxame', id: 'dru_primal_enxame', summary: 'Nuvem agressiva de dano magico a media distancia.', target: 'mob', cooldownMs: 8500, range: 370, role: 'Ataque' },
        { label: 'Patada Sombria', id: 'dru_primal_patada_sombria', summary: 'Ataque magico direto para punir alvos isolados.', target: 'mob', cooldownMs: 7500, range: 320, role: 'Ataque' },
        { label: 'Nevoa Obscura', id: 'dru_primal_nevoa_obscura', summary: 'Area sombria para pressionar packs de monstros.', target: 'mob', cooldownMs: 11000, range: 360, role: 'Area' },
        { label: 'Invocacao Primal', id: 'dru_primal_invocacao_primal', summary: 'Explosao primal de alto dano magico.', target: 'mob', cooldownMs: 16000, range: 360, role: 'Execucao' }
      ],
      labels: ['Preservador', 'Primal']
    },
    assassin: {
      a: [
        { label: 'Reflexos', id: 'ass_agil_reflexos', summary: 'Aprimora evasao e velocidade para abrir espaco no caos.', target: 'self', cooldownMs: 11000, role: 'Buff' },
        { label: 'Contra-Ataque', id: 'ass_agil_contra_ataque', summary: 'Golpe rapido para responder imediatamente ao contato.', target: 'mob', cooldownMs: 9000, range: 115, role: 'Ataque' },
        { label: 'Passo Fantasma', id: 'ass_agil_passo_fantasma', summary: 'Investida curta para encurtar distancia com velocidade.', target: 'mob', cooldownMs: 8000, range: 220, role: 'Ataque' },
        { label: 'Golpe de Nervos', id: 'ass_agil_golpe_nervos', summary: 'Acerto preciso para manter a pressao corpo a corpo.', target: 'mob', cooldownMs: 9000, range: 120, role: 'Ataque' },
        { label: 'Miragem', id: 'ass_agil_miragem', summary: 'Estouro agressivo de mobilidade e dano concentrado.', target: 'mob', cooldownMs: 14000, range: 130, role: 'Execucao' }
      ],
      b: [
        { label: 'Expor Fraqueza', id: 'ass_letal_expor_fraqueza', summary: 'Marca o momento de burst e amplia chance critica.', target: 'self', cooldownMs: 12000, role: 'Buff' },
        { label: 'Ocultar', id: 'ass_letal_ocultar', summary: 'Entra em furtividade e prepara uma abertura mortal.', target: 'self', cooldownMs: 18000, role: 'Buff' },
        { label: 'Emboscada', id: 'ass_letal_emboscada', summary: 'Ataque devastador que se beneficia da furtividade.', target: 'mob', cooldownMs: 10000, range: 150, role: 'Ataque' },
        { label: 'Bomba de Fumaca', id: 'ass_letal_bomba_fumaca', summary: 'Ataque em area para confundir e controlar o campo.', target: 'mob', cooldownMs: 13000, range: 250, role: 'Area' },
        { label: 'Sentenca', id: 'ass_letal_sentenca', summary: 'Golpe de execucao com dano atrasado para finalizar alvos.', target: 'mob', cooldownMs: 15000, range: 320, role: 'Execucao' }
      ],
      labels: ['Agil', 'Letal']
    }
  } as const;
  const out: SkillTreeNode[] = [];
  for (const [classId, def] of Object.entries(defs)) {
    def.a.forEach((entry, idx) => {
      out.push({
        ...entry,
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

export function sendChatMessage(scope: 'local' | 'map' | 'global', text: string) {
  const safeText = String(text || '').trim();
  if (!safeText) return;
  sendUiMessage({ type: 'chat_send', scope, text: safeText });
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
  loadingStore.update((current) => ({
    ...current,
    active: true,
    progress: Math.max(current.progress, 0.08),
    title: 'Preparando entrada',
    detail: 'Solicitando acesso ao mundo.',
    pendingWorldEntry: true,
    ready: false
  }));
}

export function cancelWorldEntryLoading() {
  loadingStore.set(DEFAULT_LOADING);
}

export function togglePanel(panel: keyof PanelUiState) {
  panelStore.update((current) => ({ ...current, [panel]: !current[panel] }));
}

export function openPanel(panel: keyof PanelUiState) {
  panelStore.update((current) => ({ ...current, [panel]: true }));
}

export function closeAllPanels() {
  panelStore.set({ character: false, inventory: false, skills: false, map: false, quests: false, party: false, friends: false, guild: false, admin: false });
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
  mapSettingsStore.update((current) => ({ ...current, [key]: Boolean(enabled) }));
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
  normalized[targetKey] = { type: 'action', actionId: 'skill_cast', skillId: safeSkillId, skillName: String(skillName || humanizeSkillId(safeSkillId)) };
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
  let lastAdminResultRef: any = null;
  let lastAdminIsAdmin = false;
  let lastAdminPingMs: number | null = null;
  let lastAdminSocketConnected = false;
  let lastAdminPathDebugEnabled = false;
  let lastAdminInteractionDebugEnabled = false;
  let lastAdminMobPeacefulEnabled = false;
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
  let lastLoadingSignature = '';
  let currentLoadingState: LoadingUiState = DEFAULT_LOADING;

  const sync = () => {
    const state = gameStore.getState();
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

    const chatMessages = Array.isArray(state.chatMessages) ? state.chatMessages.slice(-60) : [];
    if (state.chatMessages !== lastChatRef) {
      lastChatRef = state.chatMessages;
      chatStore.set({ messages: chatMessages });
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
    const mapCode = String(state.resolvedWorld?.mapCode || '-').toUpperCase();
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
    const pendingWorldEntry = allowPendingWorldEntry ? currentLoadingState.pendingWorldEntry : false;
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
    const loadingSignature = JSON.stringify(nextLoading);
    if (loadingSignature !== lastLoadingSignature) {
      lastLoadingSignature = loadingSignature;
      currentLoadingState = nextLoading;
      loadingStore.set(nextLoading);
    }
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
  selectedAutoAttackStore.set(loadSelectedAutoAttack());

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
