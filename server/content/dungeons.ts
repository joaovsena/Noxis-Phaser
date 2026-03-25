import { Wallet } from '../utils/currency';

export type DungeonMobSpawn = {
    id: string;
    kind: 'normal' | 'elite' | 'subboss' | 'boss';
    x: number;
    y: number;
    hpMultiplier?: number;
    level?: number;
};

export type DungeonBossMechanics = {
    shockwaveIntervalMs: number;
    shockwaveDamagePctMaxHp: number;
    addSummonHpThresholdPct: number;
    addSpawns: DungeonMobSpawn[];
};

export type DungeonTemplate = {
    id: string;
    name: string;
    description: string;
    mapKey: string;
    mapAssetKey?: string;
    maxPlayers: number;
    entryNpcId?: string;
    entryPortalId?: string;
    entrySpawn: { x: number; y: number };
    exitSpawn: { mapKey: string; mapId: string; x: number; y: number };
    mobs: DungeonMobSpawn[];
    rewards: {
        currency?: Partial<Wallet>;
        items?: Array<{ templateId: string; quantity: number }>;
    };
    bossMechanics: DungeonBossMechanics;
};

export const DUNGEON_TEMPLATES: DungeonTemplate[] = [
    {
        id: 'dng_forest_ruins_mvp',
        name: 'Ruinas de Alder',
        description: 'Instancia curta para grupo: limpe os corredores e derrote o Guardiao das Ruinas.',
        mapKey: 'forest',
        mapAssetKey: 'dungeon1',
        maxPlayers: 4,
        entryNpcId: 'npc_dungeon_warden',
        entryPortalId: 'forest_dungeon_ruins_01',
        entrySpawn: { x: 420, y: 420 },
        exitSpawn: { mapKey: 'forest', mapId: 'Z1', x: 2680, y: 1880 },
        mobs: [
            { id: 'pack_1_a', kind: 'normal', x: 560, y: 460 },
            { id: 'pack_1_b', kind: 'normal', x: 620, y: 480 },
            { id: 'pack_1_c', kind: 'elite', x: 690, y: 500, hpMultiplier: 1.15 },
            { id: 'pack_2_a', kind: 'normal', x: 860, y: 560 },
            { id: 'pack_2_b', kind: 'elite', x: 930, y: 590, hpMultiplier: 1.2 },
            { id: 'pack_2_c', kind: 'normal', x: 980, y: 620 },
            { id: 'boss_guardian', kind: 'boss', x: 1320, y: 710, hpMultiplier: 0.75, level: 4 }
        ],
        rewards: {
            currency: { gold: 1, silver: 20 },
            items: [{ templateId: 'skill_reset_hourglass', quantity: 1 }]
        },
        bossMechanics: {
            shockwaveIntervalMs: 7000,
            shockwaveDamagePctMaxHp: 0.08,
            addSummonHpThresholdPct: 0.6,
            addSpawns: [
                { id: 'add_1', kind: 'elite', x: 1210, y: 640, hpMultiplier: 0.9 },
                { id: 'add_2', kind: 'elite', x: 1420, y: 760, hpMultiplier: 0.9 }
            ]
        }
    }
];

export const DUNGEON_BY_ID = Object.fromEntries(DUNGEON_TEMPLATES.map((d) => [d.id, d])) as Record<string, DungeonTemplate>;
export const DUNGEON_BY_ENTRY_NPC = Object.fromEntries(
    DUNGEON_TEMPLATES.filter((d) => d.entryNpcId).map((d) => [String(d.entryNpcId), d])
) as Record<string, DungeonTemplate>;
export const DUNGEON_BY_ENTRY_PORTAL = Object.fromEntries(
    DUNGEON_TEMPLATES.filter((d) => d.entryPortalId).map((d) => [String(d.entryPortalId), d])
) as Record<string, DungeonTemplate>;
