export const DEFAULT_MAP_URL = '/maps/A0/a0.tmj';
export const WORLD_TILE_SIZE = 80;

const MAP_CODE_BY_KEY: Record<string, string> = {
  city: 'A0',
  forest: 'A1',
  lava: 'A2',
  undead: 'A3'
};

export function resolveMapCode(mapCode?: string | null, mapKey?: string | null) {
  const explicit = String(mapCode || '').trim().toUpperCase();
  if (explicit) return explicit;
  return MAP_CODE_BY_KEY[String(mapKey || '').trim().toLowerCase()] || 'A0';
}

export function resolveMapTmjUrl(mapCode?: string | null, mapKey?: string | null) {
  const code = resolveMapCode(mapCode, mapKey);
  return `/maps/${code}/${code.toLowerCase()}.tmj`;
}
