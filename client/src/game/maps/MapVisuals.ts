export type MapVisualTheme = 'city' | 'forest' | 'lava' | 'undead' | 'dungeon' | 'generic';
export type MapVisualBase = 'void' | 'ground' | 'path' | 'water' | 'lava' | 'swamp' | 'bridge';
export type MapVisualOverlay = 'tree' | 'rock' | 'ruins' | 'structure' | 'grave' | 'bones';

export type MapVisualCell = {
  base: MapVisualBase;
  overlay: MapVisualOverlay | null;
  blocked: boolean;
};

export type MapVisualPalette = {
  background: string;
  baseStroke: string;
  highlight: string;
  ground: string;
  path: string;
  water: string;
  lava: string;
  swamp: string;
  bridge: string;
  tree: string;
  rock: string;
  ruins: string;
  structure: string;
  grave: string;
  bones: string;
};

export const MAP_VISUAL_PALETTES: Record<MapVisualTheme, MapVisualPalette> = {
  city: {
    background: '#090909',
    baseStroke: '#241d14',
    highlight: '#fff1c7',
    ground: '#777268',
    path: '#d5b27d',
    water: '#4f91bc',
    lava: '#cb5f34',
    swamp: '#607267',
    bridge: '#8f6d49',
    tree: '#5e7154',
    rock: '#58524b',
    ruins: '#8a7b6d',
    structure: '#bf9c6c',
    grave: '#95a1a6',
    bones: '#d5c4a1'
  },
  forest: {
    background: '#071008',
    baseStroke: '#1f2418',
    highlight: '#eef8cc',
    ground: '#5f9142',
    path: '#c7a76c',
    water: '#3d8bc7',
    lava: '#cf6130',
    swamp: '#466a59',
    bridge: '#8a663b',
    tree: '#2f5f2b',
    rock: '#4f493d',
    ruins: '#8a7b66',
    structure: '#b3915f',
    grave: '#7a8d92',
    bones: '#d6c79f'
  },
  lava: {
    background: '#140907',
    baseStroke: '#261814',
    highlight: '#ffd59d',
    ground: '#6a4a3e',
    path: '#a17a56',
    water: '#466579',
    lava: '#ff6d2e',
    swamp: '#724c3e',
    bridge: '#7d5840',
    tree: '#55433b',
    rock: '#241f1f',
    ruins: '#8d674f',
    structure: '#b98459',
    grave: '#866f66',
    bones: '#d0b28e'
  },
  undead: {
    background: '#0a0c0d',
    baseStroke: '#1d2120',
    highlight: '#dce7de',
    ground: '#56645b',
    path: '#978c76',
    water: '#3c5f6c',
    lava: '#934f39',
    swamp: '#356055',
    bridge: '#796351',
    tree: '#3d463c',
    rock: '#4f4b4a',
    ruins: '#7c756d',
    structure: '#918372',
    grave: '#8fa5ac',
    bones: '#cbbfa7'
  },
  dungeon: {
    background: '#0d0e10',
    baseStroke: '#23211d',
    highlight: '#efe4cc',
    ground: '#6d665a',
    path: '#a28f75',
    water: '#46535d',
    lava: '#ba5a30',
    swamp: '#4b585a',
    bridge: '#7d6856',
    tree: '#4d4f48',
    rock: '#4a4742',
    ruins: '#8d8374',
    structure: '#a3927b',
    grave: '#8b949b',
    bones: '#d3c8b3'
  },
  generic: {
    background: '#0b0f12',
    baseStroke: '#1f252a',
    highlight: '#f1ead8',
    ground: '#6f7866',
    path: '#a08f6f',
    water: '#3b6184',
    lava: '#c85a2f',
    swamp: '#53635f',
    bridge: '#836549',
    tree: '#4a5d46',
    rock: '#56524b',
    ruins: '#8a7e70',
    structure: '#a38e69',
    grave: '#85939b',
    bones: '#cfc2a6'
  }
};

export function inferMapTheme(options?: { mapCode?: string | null; mapUrl?: string | null; tileSources?: string[] | null }): MapVisualTheme {
  const code = String(options?.mapCode || '').trim().toUpperCase();
  if (code === 'A0') return 'city';
  if (code === 'A1') return 'forest';
  if (code === 'A2') return 'lava';
  if (code === 'A3') return 'undead';
  if (code === 'DNG') return 'dungeon';
  const haystack = [
    String(options?.mapUrl || ''),
    ...(Array.isArray(options?.tileSources) ? options?.tileSources.map((entry) => String(entry || '')) : [])
  ].join(' ').toLowerCase();
  if (haystack.includes('/a0/') || haystack.includes('city_') || haystack.includes('citadela')) return 'city';
  if (haystack.includes('/a1/') || haystack.includes('forest_') || haystack.includes('bosque')) return 'forest';
  if (haystack.includes('/a2/') || haystack.includes('lava_') || haystack.includes('cinzas')) return 'lava';
  if (haystack.includes('/a3/') || haystack.includes('undead_') || haystack.includes('ermo')) return 'undead';
  if (haystack.includes('/dng') || haystack.includes('dungeon_')) return 'dungeon';
  return 'generic';
}

function basePriority(base: MapVisualBase) {
  switch (base) {
    case 'bridge': return 5;
    case 'lava':
    case 'water':
    case 'swamp': return 4;
    case 'path': return 3;
    case 'ground': return 2;
    default: return 0;
  }
}

function overlayPriority(overlay: MapVisualOverlay | null) {
  switch (overlay) {
    case 'structure': return 5;
    case 'ruins': return 4;
    case 'grave':
    case 'bones': return 3;
    case 'rock': return 2;
    case 'tree': return 1;
    default: return 0;
  }
}

export function mergeMapVisualCell(current: MapVisualCell, next: Partial<MapVisualCell>): MapVisualCell {
  const merged: MapVisualCell = {
    ...current,
    blocked: Boolean(current.blocked || next.blocked)
  };
  const nextBase = (next.base || merged.base) as MapVisualBase;
  const nextOverlay = (next.overlay || merged.overlay || null) as MapVisualOverlay | null;
  if (next.base && basePriority(nextBase) >= basePriority(merged.base)) {
    merged.base = nextBase;
  }
  if (next.overlay && overlayPriority(nextOverlay) >= overlayPriority(merged.overlay)) {
    merged.overlay = nextOverlay;
  }
  if (merged.base === 'void') merged.base = 'ground';
  return merged;
}

export function classifyMapTile(source: string, layerName: string, theme: MapVisualTheme): Partial<MapVisualCell> {
  const text = `${String(layerName || '').toLowerCase()} ${String(source || '').toLowerCase()}`;
  const normalized = text
    .replaceAll('city_', '')
    .replaceAll('forest_', '')
    .replaceAll('lava_', '')
    .replaceAll('undead_', '')
    .replaceAll('dungeon_', '');
  const inDungeon = theme === 'dungeon';

  if (normalized.includes('bridge')) return { base: 'bridge', blocked: false };
  if (normalized.includes('pool') || normalized.includes('molten') || normalized.includes('core')) return { base: 'lava', blocked: true };
  if (normalized.includes('water') || normalized.includes('river') || normalized.includes('canal')) return { base: inDungeon ? 'swamp' : 'water', blocked: true };
  if (normalized.includes('swamp') || normalized.includes('mire') || normalized.includes('blackwater')) return { base: 'swamp', blocked: true };
  if (normalized.includes('path') || normalized.includes('trail') || normalized.includes('road') || normalized.includes('avenue') || normalized.includes('plaza') || normalized.includes('cobble')) {
    return { base: 'path', blocked: false };
  }
  if (normalized.includes('grave') || normalized.includes('tomb')) return { overlay: 'grave', blocked: true };
  if (normalized.includes('bone')) return { overlay: 'bones', blocked: true };
  if (normalized.includes('tree') || normalized.includes('garden')) return { overlay: 'tree', blocked: true };
  if (normalized.includes('ruin')) return { overlay: 'ruins', blocked: true };
  if (normalized.includes('house') || normalized.includes('hub') || normalized.includes('fort') || normalized.includes('mausoleum') || normalized.includes('structure') || normalized.includes('market') || normalized.includes('wall') || normalized.includes('statue')) {
    return { overlay: 'structure', blocked: true };
  }
  if (normalized.includes('blocker') || normalized.includes('rock') || normalized.includes('cliff') || normalized.includes('obsidian') || normalized.includes('gate') || normalized.includes('walls') || normalized.includes('pared')) {
    return { overlay: theme === 'forest' ? 'tree' : 'rock', blocked: true };
  }
  if (normalized.includes('ground') || normalized.includes('details')) return { base: 'ground', blocked: false };
  return { base: 'ground', blocked: false };
}

export function resolveMapBaseColor(theme: MapVisualTheme, base: MapVisualBase) {
  const palette = MAP_VISUAL_PALETTES[theme] || MAP_VISUAL_PALETTES.generic;
  return palette[base] || palette.ground;
}

export function resolveMapOverlayColor(theme: MapVisualTheme, overlay: MapVisualOverlay | null) {
  const palette = MAP_VISUAL_PALETTES[theme] || MAP_VISUAL_PALETTES.generic;
  if (!overlay) return palette.highlight;
  return palette[overlay] || palette.structure;
}

export function hexToColorNumber(hex: string) {
  const sanitized = String(hex || '').replace('#', '').trim();
  const parsed = Number.parseInt(sanitized, 16);
  return Number.isFinite(parsed) ? parsed : 0xffffff;
}
