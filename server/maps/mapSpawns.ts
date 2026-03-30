import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { MAP_CODE_BY_KEY } from '../config';

type SpawnPointMap = Record<string, any>;
type MobKind = 'normal' | 'elite' | 'subboss' | 'boss';
type Formation = 'solo' | 'pack' | 'line';

type SpawnGroupDef = {
    id: string;
    kind: MobKind;
    formation: Formation;
    count: number;
    anchor: string | { x: number; y: number };
    spacing?: number;
    jitter?: number;
    direction?: 'horizontal' | 'vertical' | 'diag-down' | 'diag-up';
};

export type StrategicMobSpawn = {
    id: string;
    kind: MobKind;
    x: number;
    y: number;
};

const pointsCache = new Map<string, SpawnPointMap | null>();

const MAP_LAYOUTS: Record<string, SpawnGroupDef[]> = {
    city: [],
    forest: [
        { id: 'forest-outskirts-pack-a', kind: 'normal', formation: 'pack', count: 3, anchor: 'mobZones.outskirts', spacing: 132, jitter: 24 },
        { id: 'forest-outskirts-pack-b', kind: 'normal', formation: 'line', count: 1, anchor: { x: 2220, y: 3920 }, spacing: 144, jitter: 16, direction: 'horizontal' },
        { id: 'forest-bridge-pack', kind: 'normal', formation: 'pack', count: 2, anchor: 'mobZones.bridge', spacing: 118, jitter: 20 },
        { id: 'forest-east-road-pack', kind: 'normal', formation: 'line', count: 2, anchor: { x: 5100, y: 3200 }, spacing: 136, jitter: 16, direction: 'diag-up' },
        { id: 'forest-ruins-approach-pack', kind: 'normal', formation: 'pack', count: 1, anchor: { x: 2760, y: 1640 }, spacing: 110, jitter: 18 },
        { id: 'forest-lava-road-scouts', kind: 'normal', formation: 'solo', count: 1, anchor: { x: 5501, y: 2936 }, spacing: 86, jitter: 0 },

        { id: 'forest-bridge-elite-pair', kind: 'elite', formation: 'line', count: 2, anchor: { x: 3640, y: 3300 }, spacing: 146, jitter: 18, direction: 'diag-down' },
        { id: 'forest-rift-elite-pair', kind: 'elite', formation: 'line', count: 2, anchor: { x: 4443, y: 2666 }, spacing: 420, jitter: 0, direction: 'horizontal' },
        { id: 'forest-ruins-elite', kind: 'elite', formation: 'solo', count: 1, anchor: { x: 3040, y: 1400 }, jitter: 14 },

        { id: 'forest-ruins-subboss', kind: 'subboss', formation: 'solo', count: 1, anchor: 'mobZones.ruins', jitter: 12 }
    ],
    lava: [
        { id: 'lava-outpost-pack', kind: 'normal', formation: 'pack', count: 2, anchor: 'outpost', spacing: 122, jitter: 20 },
        { id: 'lava-bridge-line', kind: 'normal', formation: 'line', count: 3, anchor: 'lavaBridge', spacing: 128, jitter: 16, direction: 'horizontal' },
        { id: 'lava-central-pack', kind: 'normal', formation: 'pack', count: 2, anchor: { x: 3720, y: 3000 }, spacing: 132, jitter: 22 },
        { id: 'lava-east-road-pack', kind: 'normal', formation: 'line', count: 2, anchor: { x: 5160, y: 2780 }, spacing: 140, jitter: 16, direction: 'diag-up' },

        { id: 'lava-bridge-elite-pair', kind: 'elite', formation: 'line', count: 2, anchor: { x: 4040, y: 2940 }, spacing: 150, jitter: 16, direction: 'diag-down' },
        { id: 'lava-crater-elite-pair', kind: 'elite', formation: 'pack', count: 2, anchor: { x: 4560, y: 3360 }, spacing: 152, jitter: 18 },
        { id: 'lava-undead-gate-elite', kind: 'elite', formation: 'solo', count: 1, anchor: 'undeadPortal', jitter: 34 },

        { id: 'lava-crater-subboss', kind: 'subboss', formation: 'solo', count: 1, anchor: { x: 4860, y: 3480 }, jitter: 14 }
    ],
    undead: [
        { id: 'undead-west-approach-pack', kind: 'normal', formation: 'pack', count: 3, anchor: { x: 1160, y: 4300 }, spacing: 126, jitter: 18 },
        { id: 'undead-graveyard-pack', kind: 'normal', formation: 'pack', count: 3, anchor: 'graveyard', spacing: 120, jitter: 18 },
        { id: 'undead-mausoleum-pack', kind: 'normal', formation: 'line', count: 2, anchor: 'mausoleum', spacing: 136, jitter: 16, direction: 'vertical' },
        { id: 'undead-south-mire-pack', kind: 'normal', formation: 'line', count: 2, anchor: { x: 4120, y: 4680 }, spacing: 146, jitter: 22, direction: 'diag-up' },

        { id: 'undead-graveyard-elites', kind: 'elite', formation: 'line', count: 2, anchor: { x: 4700, y: 2060 }, spacing: 150, jitter: 14, direction: 'horizontal' },
        { id: 'undead-mausoleum-elites', kind: 'elite', formation: 'line', count: 2, anchor: { x: 5620, y: 2800 }, spacing: 152, jitter: 14, direction: 'vertical' },
        { id: 'undead-mire-elite', kind: 'elite', formation: 'solo', count: 1, anchor: { x: 4240, y: 3820 }, jitter: 18 },

        { id: 'undead-mausoleum-subboss', kind: 'subboss', formation: 'solo', count: 1, anchor: { x: 5680, y: 2760 }, jitter: 12 }
    ]
};

function hashSeed(input: string) {
    let h = 2166136261;
    const text = String(input || 'seed');
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) || 1;
}

function createRng(seedInput: string) {
    let state = hashSeed(seedInput);
    return () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        return (state >>> 0) / 0xffffffff;
    };
}

function readPoints(mapKey: string) {
    if (pointsCache.has(mapKey)) return pointsCache.get(mapKey) || null;
    const mapCode = String(MAP_CODE_BY_KEY[mapKey] || '').trim();
    if (!mapCode) {
        pointsCache.set(mapKey, null);
        return null;
    }
    const filePath = path.resolve(process.cwd(), 'public', 'maps', mapCode, 'spawns.json');
    if (!existsSync(filePath)) {
        pointsCache.set(mapKey, null);
        return null;
    }
    try {
        const parsed = JSON.parse(readFileSync(filePath, 'utf8'));
        pointsCache.set(mapKey, parsed && typeof parsed === 'object' ? parsed : null);
        return pointsCache.get(mapKey) || null;
    } catch {
        pointsCache.set(mapKey, null);
        return null;
    }
}

function resolveAnchor(mapKey: string, anchor: SpawnGroupDef['anchor']) {
    if (typeof anchor !== 'string') return { x: Number(anchor.x || 0), y: Number(anchor.y || 0) };
    const points = readPoints(mapKey);
    const chunks = String(anchor || '').split('.').filter(Boolean);
    let current: any = points;
    for (const chunk of chunks) {
        if (!current || typeof current !== 'object') return { x: 0, y: 0 };
        current = current[chunk];
    }
    return {
        x: Number(current?.x || 0),
        y: Number(current?.y || 0)
    };
}

function expandSpawnGroup(mapKey: string, def: SpawnGroupDef) {
    const rng = createRng(`${mapKey}:${def.id}`);
    const anchor = resolveAnchor(mapKey, def.anchor);
    const spacing = Math.max(28, Number(def.spacing || 64));
    const jitter = Math.max(0, Number(def.jitter || 0));
    const out: StrategicMobSpawn[] = [];

    for (let index = 0; index < Math.max(1, Number(def.count || 1)); index += 1) {
        let x = anchor.x;
        let y = anchor.y;
        if (def.formation === 'pack') {
            const angle = (Math.PI * 2 * index) / Math.max(1, def.count);
            const radius = spacing * (0.55 + rng() * 0.35);
            x += Math.cos(angle) * radius;
            y += Math.sin(angle) * radius;
        } else if (def.formation === 'line') {
            const offset = (index - (Math.max(1, def.count) - 1) / 2) * spacing;
            if (def.direction === 'vertical') {
                y += offset;
            } else if (def.direction === 'diag-down') {
                x += offset;
                y += offset * 0.65;
            } else if (def.direction === 'diag-up') {
                x += offset;
                y -= offset * 0.65;
            } else {
                x += offset;
            }
        } else if (def.formation === 'solo' && def.count > 1) {
            const angle = (Math.PI * 2 * index) / Math.max(1, def.count);
            x += Math.cos(angle) * spacing * 0.55;
            y += Math.sin(angle) * spacing * 0.55;
        }
        x += (rng() - 0.5) * jitter * 2;
        y += (rng() - 0.5) * jitter * 2;
        out.push({
            id: `${def.id}-${index + 1}`,
            kind: def.kind,
            x: Math.round(x),
            y: Math.round(y)
        });
    }
    return out;
}

export function getStrategicMobSpawns(mapKey: string) {
    const defs = MAP_LAYOUTS[String(mapKey || '')] || [];
    return defs.flatMap((def) => expandSpawnGroup(mapKey, def));
}

export function hasStrategicMobLayout(mapKey: string) {
    return Object.prototype.hasOwnProperty.call(MAP_LAYOUTS, String(mapKey || ''));
}
