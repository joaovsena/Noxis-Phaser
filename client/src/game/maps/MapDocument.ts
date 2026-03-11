import { DEFAULT_MAP_URL, WORLD_TILE_SIZE } from '../config';

export type LoadedMapDocument = {
  raw: any;
  url: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  worldTileSize: number;
  layers: Array<{ name: string; data: number[]; visible: boolean }>;
  tileImages: Record<number, { source: string; width: number; height: number; offsetX: number; offsetY: number; tileWidth: number; tileHeight: number }>;
};

function decodeBase64LayerData(encoded: string): number[] {
  const cleaned = encoded.trim();
  if (!cleaned) return [];
  const binary = atob(cleaned);
  const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const out: number[] = [];
  for (let offset = 0; offset < view.byteLength; offset += 4) {
    out.push(view.getUint32(offset, true));
  }
  return out;
}

function dirname(url: string) {
  const clean = String(url || '').split('?')[0];
  const idx = clean.lastIndexOf('/');
  return idx >= 0 ? clean.slice(0, idx + 1) : clean;
}

function basename(path: string) {
  const clean = String(path || '').replaceAll('\\', '/');
  const idx = clean.lastIndexOf('/');
  return idx >= 0 ? clean.slice(idx + 1) : clean;
}

function resolveTilesetCandidate(mapUrl: string, tilesetUrl: string, source: string) {
  if (!source) return '';
  if (source.startsWith('http://') || source.startsWith('https://') || source.startsWith('/')) return source;
  const mapDir = dirname(mapUrl);
  const mapKey = basename(dirname(mapUrl).slice(0, -1)).toLowerCase();
  const file = basename(source);
  if (source.includes('Kenney') || source.includes('..\\..') || source.includes('../../../../')) {
    if (mapKey === 'dungeon1') return `${mapDir}tiles/${file}`;
    return `/maps/tileset/${mapKey}/${file}`;
  }
  return new URL(source, `${window.location.origin}${dirname(tilesetUrl)}`).pathname;
}

async function loadTileImages(raw: any, mapUrl: string) {
  const out: Record<number, { source: string; width: number; height: number; offsetX: number; offsetY: number; tileWidth: number; tileHeight: number }> = {};
  const tilesets = Array.isArray(raw?.tilesets) ? raw.tilesets : [];
  for (const tileset of tilesets) {
    const firstgid = Number(tileset?.firstgid || 1);
    if (tileset?.source) {
      const tilesetUrl = new URL(String(tileset.source), `${window.location.origin}${dirname(mapUrl)}`).pathname;
      const response = await fetch(tilesetUrl, { cache: 'no-store' });
      if (!response.ok) continue;
      const xml = await response.text();
      const doc = new DOMParser().parseFromString(xml, 'application/xml');
      const tilesetRoot = doc.querySelector('tileset');
      const tileOffsetNode = doc.querySelector('tileoffset');
      const tilesetTileWidth = Math.max(1, Number(tilesetRoot?.getAttribute('tilewidth') || raw?.tilewidth || 1));
      const tilesetTileHeight = Math.max(1, Number(tilesetRoot?.getAttribute('tileheight') || raw?.tileheight || 1));
      const offsetX = Number(tileOffsetNode?.getAttribute('x') || 0);
      const offsetY = Number(tileOffsetNode?.getAttribute('y') || 0);
      doc.querySelectorAll('tile').forEach((tileNode) => {
        const imageNode = tileNode.querySelector('image');
        if (!imageNode) return;
        const tileId = Number(tileNode.getAttribute('id') || 0);
        const source = resolveTilesetCandidate(mapUrl, tilesetUrl, String(imageNode.getAttribute('source') || ''));
        if (!source) return;
        out[firstgid + tileId] = {
          source,
          width: Math.max(1, Number(imageNode.getAttribute('width') || tilesetTileWidth)),
          height: Math.max(1, Number(imageNode.getAttribute('height') || tilesetTileHeight)),
          offsetX,
          offsetY,
          tileWidth: tilesetTileWidth,
          tileHeight: tilesetTileHeight
        };
      });
      continue;
    }
    const imageSource = tileset?.image ? resolveTilesetCandidate(mapUrl, mapUrl, String(tileset.image)) : '';
    if (!imageSource) continue;
    const columns = Math.max(1, Number(tileset?.columns || 1));
    const tileCount = Math.max(0, Number(tileset?.tilecount || 0));
    for (let i = 0; i < tileCount; i += 1) {
      out[firstgid + i] = {
        source: imageSource,
        width: Math.max(1, Number(tileset?.tilewidth || raw?.tilewidth || 1)),
        height: Math.max(1, Number(tileset?.tileheight || raw?.tileheight || 1)),
        offsetX: Number(tileset?.tileoffset?.x || 0),
        offsetY: Number(tileset?.tileoffset?.y || 0),
        tileWidth: Math.max(1, Number(tileset?.tilewidth || raw?.tilewidth || 1)),
        tileHeight: Math.max(1, Number(tileset?.tileheight || raw?.tileheight || 1))
      };
      if (columns <= 0) break;
    }
  }
  return out;
}

export async function loadMapDocument(url?: string): Promise<LoadedMapDocument> {
  const targetUrl = url || DEFAULT_MAP_URL;
  const response = await fetch(targetUrl, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`map_load_failed:${response.status}`);
  }
  const raw = await response.json();
  const width = Math.max(1, Number(raw?.width || 1));
  const height = Math.max(1, Number(raw?.height || 1));
  const tileWidth = Math.max(1, Number(raw?.tilewidth || 1));
  const tileHeight = Math.max(1, Number(raw?.tileheight || 1));
  const worldTileSize = Math.max(
    1,
    Number(raw?.properties?.find?.((item: any) => item?.name === 'worldTileSize')?.value || WORLD_TILE_SIZE)
  );
  const layers = Array.isArray(raw?.layers)
    ? raw.layers
        .filter((layer: any) => layer?.type === 'tilelayer')
        .map((layer: any) => ({
          name: String(layer?.name || 'layer'),
          visible: Boolean(layer?.visible ?? true),
          data: Array.isArray(layer?.data) ? layer.data.map((n: any) => Number(n || 0)) : decodeBase64LayerData(String(layer?.data || ''))
        }))
    : [];
  const tileImages = await loadTileImages(raw, targetUrl);

  return {
    raw,
    url: targetUrl,
    width,
    height,
    tileWidth,
    tileHeight,
    worldTileSize,
    layers,
    tileImages
  };
}
