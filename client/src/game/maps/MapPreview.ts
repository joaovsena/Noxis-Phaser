import { DEFAULT_MAP_URL, resolveMapTmjUrl } from '../config';
import { loadMapDocument, type LoadedMapDocument } from './MapDocument';
import {
  classifyMapTile,
  inferMapTheme,
  MAP_VISUAL_PALETTES,
  mergeMapVisualCell,
  resolveMapBaseColor,
  resolveMapOverlayColor,
  type MapVisualBase,
  type MapVisualCell,
  type MapVisualOverlay,
  type MapVisualTheme
} from './MapVisuals';

type PreviewTheme = MapVisualTheme;
type PreviewBase = MapVisualBase;
type PreviewOverlay = MapVisualOverlay;

export type PreviewViewport = {
  centerX: number;
  centerY: number;
  zoom?: number;
};

export type MapPreviewCell = MapVisualCell;

export type MapPreviewData = {
  url: string;
  width: number;
  height: number;
  world: { width: number; height: number };
  theme: PreviewTheme;
  cells: MapPreviewCell[];
  tileRenderWidth: number;
  tileRenderHeight: number;
  originX: number;
  originY: number;
  rasterWidth: number;
  rasterHeight: number;
  raster: HTMLCanvasElement | null;
};

const mapPreviewCache = new Map<string, Promise<MapPreviewData | null>>();

const PALETTES = MAP_VISUAL_PALETTES;

function propertyRecord(properties: any[] | undefined) {
  const out: Record<string, unknown> = {};
  for (const entry of Array.isArray(properties) ? properties : []) {
    const name = String(entry?.name || '').trim();
    if (!name) continue;
    out[name] = entry?.value;
  }
  return out;
}

function determineTheme(doc: LoadedMapDocument, mapCode?: string | null): PreviewTheme {
  return inferMapTheme({
    mapCode,
    mapUrl: doc.url,
    tileSources: Object.values(doc.tileImages || {}).map((entry) => String(entry?.source || ''))
  });
}

function createPreviewSurface(width: number, height: number) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

function buildPreview(doc: LoadedMapDocument, world: { width: number; height: number }, mapCode?: string | null): MapPreviewData {
  const theme = determineTheme(doc, mapCode);
  const cells: MapPreviewCell[] = Array.from({ length: doc.width * doc.height }, () => ({
    base: 'void',
    overlay: null,
    blocked: false
  }));

  for (const layer of doc.layers || []) {
    if (!layer?.visible) continue;
    const layerName = String(layer.name || '').toLowerCase();
    const data = Array.isArray(layer.data) ? layer.data : [];
    for (let index = 0; index < data.length; index += 1) {
      const gid = Number(data[index] || 0);
      if (!gid) continue;
      const tile = doc.tileImages?.[gid];
      const cell = cells[index];
      cells[index] = mergeMapVisualCell(cell, classifyMapTile(String(tile?.source || ''), layerName, theme));
    }
  }

  const tileRenderWidth = 18;
  const tileRenderHeight = 9;
  const halfW = tileRenderWidth / 2;
  const halfH = tileRenderHeight / 2;
  const rasterWidth = Math.ceil((doc.width + doc.height) * halfW + tileRenderWidth * 2);
  const rasterHeight = Math.ceil((doc.width + doc.height) * halfH + tileRenderHeight * 4);
  const originX = Math.ceil(doc.height * halfW + tileRenderWidth);
  const originY = Math.ceil(tileRenderHeight * 2);

  return {
    url: doc.url,
    width: doc.width,
    height: doc.height,
    world,
    theme,
    cells,
    tileRenderWidth,
    tileRenderHeight,
    originX,
    originY,
    rasterWidth,
    rasterHeight,
    raster: null
  };
}

function resolveCellColor(preview: MapPreviewData, cell: MapPreviewCell) {
  return resolveMapBaseColor(preview.theme, cell.base);
}

function projectGridPoint(preview: MapPreviewData, gridX: number, gridY: number) {
  const halfW = preview.tileRenderWidth / 2;
  const halfH = preview.tileRenderHeight / 2;
  return {
    x: (gridX - gridY) * halfW + preview.originX,
    y: (gridX + gridY) * halfH + preview.originY
  };
}

function drawDiamond(ctx: CanvasRenderingContext2D, cx: number, cy: number, tileW: number, tileH: number, fill: string, stroke?: string) {
  const halfW = tileW / 2;
  const halfH = tileH / 2;
  ctx.beginPath();
  ctx.moveTo(cx, cy - halfH);
  ctx.lineTo(cx + halfW, cy);
  ctx.lineTo(cx, cy + halfH);
  ctx.lineTo(cx - halfW, cy);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
}

function drawOverlay(ctx: CanvasRenderingContext2D, preview: MapPreviewData, cx: number, cy: number, overlay: PreviewOverlay | null) {
  if (!overlay) return;
  const color = resolveMapOverlayColor(preview.theme, overlay);
  switch (overlay) {
    case 'tree':
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.moveTo(cx, cy - preview.tileRenderHeight * 1.1);
      ctx.lineTo(cx + preview.tileRenderWidth * 0.24, cy - preview.tileRenderHeight * 0.1);
      ctx.lineTo(cx - preview.tileRenderWidth * 0.24, cy - preview.tileRenderHeight * 0.1);
      ctx.closePath();
      ctx.fill();
      break;
    case 'ruins':
      ctx.fillStyle = color;
      ctx.fillRect(cx - preview.tileRenderWidth * 0.22, cy - preview.tileRenderHeight * 0.74, preview.tileRenderWidth * 0.22, preview.tileRenderHeight * 0.5);
      ctx.fillRect(cx + preview.tileRenderWidth * 0.02, cy - preview.tileRenderHeight * 0.58, preview.tileRenderWidth * 0.18, preview.tileRenderHeight * 0.34);
      break;
    case 'grave':
    case 'bones':
      ctx.fillStyle = color;
      ctx.fillRect(cx - preview.tileRenderWidth * 0.12, cy - preview.tileRenderHeight * 0.65, preview.tileRenderWidth * 0.24, preview.tileRenderHeight * 0.4);
      break;
    case 'rock':
    case 'structure':
    default:
      ctx.fillStyle = color;
      ctx.fillRect(cx - preview.tileRenderWidth * 0.18, cy - preview.tileRenderHeight * 0.76, preview.tileRenderWidth * 0.36, preview.tileRenderHeight * 0.52);
      break;
  }
}

function ensureRaster(preview: MapPreviewData) {
  if (preview.raster) return preview.raster;
  const surface = createPreviewSurface(preview.rasterWidth, preview.rasterHeight);
  if (!surface) return null;
  const ctx = surface.getContext('2d');
  if (!ctx) return null;
  const palette = PALETTES[preview.theme] || PALETTES.generic;
  ctx.clearRect(0, 0, surface.width, surface.height);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, surface.width, surface.height);

  for (let row = 0; row < preview.height; row += 1) {
    for (let col = 0; col < preview.width; col += 1) {
      const cell = preview.cells[row * preview.width + col];
      const point = projectGridPoint(preview, col, row);
      drawDiamond(
        ctx,
        point.x,
        point.y,
        preview.tileRenderWidth,
        preview.tileRenderHeight,
        resolveCellColor(preview, cell),
        cell.blocked ? 'rgba(0,0,0,0.18)' : 'rgba(255,248,228,0.08)'
      );
      if (cell.base === 'water' || cell.base === 'lava' || cell.base === 'swamp') {
        ctx.globalAlpha = 0.18;
        drawDiamond(ctx, point.x, point.y, preview.tileRenderWidth * 0.72, preview.tileRenderHeight * 0.72, '#ffffff');
        ctx.globalAlpha = 1;
      }
      if (cell.blocked && !cell.overlay) {
        ctx.globalAlpha = 0.16;
        drawDiamond(
          ctx,
          point.x,
          point.y,
          preview.tileRenderWidth * 0.86,
          preview.tileRenderHeight * 0.86,
          resolveMapOverlayColor(preview.theme, 'rock')
        );
        ctx.globalAlpha = 1;
      }
      drawOverlay(ctx, preview, point.x, point.y, cell.overlay);
    }
  }

  preview.raster = surface;
  return preview.raster;
}

function clamp(value: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  if (parsed < min) return min;
  if (parsed > max) return max;
  return parsed;
}

function resolveViewportCrop(preview: MapPreviewData, viewport?: PreviewViewport | null) {
  const raster = ensureRaster(preview);
  const fullWidth = Number(raster?.width || preview.rasterWidth);
  const fullHeight = Number(raster?.height || preview.rasterHeight);
  if (!viewport) return { x: 0, y: 0, width: fullWidth, height: fullHeight };
  const zoom = clamp(Number(viewport.zoom || 0) || 3.2, 1.4, 8);
  const center = worldPointToRaster(viewport.centerX, viewport.centerY, preview);
  const cropWidth = Math.max(preview.tileRenderWidth * 14, fullWidth / zoom);
  const cropHeight = Math.max(preview.tileRenderHeight * 18, fullHeight / zoom);
  const maxX = Math.max(0, fullWidth - cropWidth);
  const maxY = Math.max(0, fullHeight - cropHeight);
  return {
    x: clamp(center.x - cropWidth / 2, 0, maxX),
    y: clamp(center.y - cropHeight / 2, 0, maxY),
    width: cropWidth,
    height: cropHeight
  };
}

function worldPointToRaster(worldX: number, worldY: number, preview: MapPreviewData) {
  const gx = clamp((Number(worldX || 0) / Math.max(1, preview.world.width)) * Math.max(1, preview.width - 1), 0, Math.max(0, preview.width - 1));
  const gy = clamp((Number(worldY || 0) / Math.max(1, preview.world.height)) * Math.max(1, preview.height - 1), 0, Math.max(0, preview.height - 1));
  return projectGridPoint(preview, gx, gy);
}

function rasterPointToWorld(rasterX: number, rasterY: number, preview: MapPreviewData) {
  const halfW = preview.tileRenderWidth / 2;
  const halfH = preview.tileRenderHeight / 2;
  const localX = Number(rasterX || 0) - preview.originX;
  const localY = Number(rasterY || 0) - preview.originY;
  const gx = ((localY / Math.max(0.0001, halfH)) + (localX / Math.max(0.0001, halfW))) * 0.5;
  const gy = ((localY / Math.max(0.0001, halfH)) - (localX / Math.max(0.0001, halfW))) * 0.5;
  return {
    x: clamp((gx / Math.max(1, preview.width - 1)) * preview.world.width, 0, preview.world.width),
    y: clamp((gy / Math.max(1, preview.height - 1)) * preview.world.height, 0, preview.world.height)
  };
}

export async function loadMapPreview(options?: { tmjUrl?: string | null; world?: { width: number; height: number } | null; mapCode?: string | null; mapKey?: string | null }) {
  const tmjUrl = String(options?.tmjUrl || resolveMapTmjUrl(options?.mapCode || null, options?.mapKey || null) || DEFAULT_MAP_URL);
  const key = `${tmjUrl}|${Number(options?.world?.width || 0)}x${Number(options?.world?.height || 0)}|${String(options?.mapCode || '')}|${String(options?.mapKey || '')}`;
  if (!mapPreviewCache.has(key)) {
    mapPreviewCache.set(key, (async () => {
      try {
        const doc = await loadMapDocument(tmjUrl);
        const props = propertyRecord(doc.raw?.properties);
        const world = {
          width: Math.max(
            1,
            Number(options?.world?.width || 0)
            || Number(props.worldWidth || props.worldwidth || 0)
            || Math.round(doc.width * doc.worldTileSize)
          ),
          height: Math.max(
            1,
            Number(options?.world?.height || 0)
            || Number(props.worldHeight || props.worldheight || 0)
            || Math.round(doc.height * doc.worldTileSize)
          )
        };
        const preview = buildPreview(doc, world, options?.mapCode || null);
        ensureRaster(preview);
        return preview;
      } catch {
        return null;
      }
    })());
  }
  return mapPreviewCache.get(key)!;
}

export function worldPointToPreview(
  worldX: number,
  worldY: number,
  preview: MapPreviewData,
  width: number,
  height: number,
  viewport?: PreviewViewport | null
) {
  const crop = resolveViewportCrop(preview, viewport);
  const point = worldPointToRaster(worldX, worldY, preview);
  return {
    x: ((point.x - crop.x) / Math.max(1, crop.width)) * width,
    y: ((point.y - crop.y) / Math.max(1, crop.height)) * height
  };
}

export function previewPointToWorld(
  previewX: number,
  previewY: number,
  preview: MapPreviewData,
  width: number,
  height: number,
  viewport?: PreviewViewport | null
) {
  const crop = resolveViewportCrop(preview, viewport);
  const rasterX = crop.x + (clamp(previewX, 0, width) / Math.max(1, width)) * crop.width;
  const rasterY = crop.y + (clamp(previewY, 0, height) / Math.max(1, height)) * crop.height;
  return rasterPointToWorld(rasterX, rasterY, preview);
}

export function drawMapPreview(
  ctx: CanvasRenderingContext2D,
  preview: MapPreviewData,
  width: number,
  height: number,
  options?: { showGrid?: boolean; viewport?: PreviewViewport | null }
) {
  const palette = PALETTES[preview.theme] || PALETTES.generic;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = palette.background;
  ctx.fillRect(0, 0, width, height);

  const raster = ensureRaster(preview);
  if (raster) {
    const crop = resolveViewportCrop(preview, options?.viewport || null);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      raster,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      width,
      height
    );
  }

  if (options?.showGrid) {
    ctx.strokeStyle = 'rgba(255, 244, 213, 0.05)';
    ctx.lineWidth = 1;
    for (let col = 0; col <= 8; col += 1) {
      const x = (col / 8) * width;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let row = 0; row <= 6; row += 1) {
      const y = (row / 6) * height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }
}
