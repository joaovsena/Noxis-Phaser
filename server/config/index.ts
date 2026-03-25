// @ts-check

import {
    BUILTIN_ITEM_TEMPLATE_BY_ID,
    BUILTIN_ITEM_TEMPLATES,
    CLASS_EQUIPMENT_TEMPLATES,
    HP_POTION_TEMPLATE,
    NPC_SHOPS,
    SKILL_RESET_HOURGLASS_TEMPLATE,
    WEAPON_TEMPLATE,
    WEAPON_TEMPLATE_RUBI,
    WEAPON_TEMPLATES,
    pickMapMaterialTemplateId,
    pickProgressionLootTemplate,
    resolveClassEquipmentTemplateId,
    resolveClassWeaponTemplateId
} from '../content/itemCatalog';

export const WORLD = { width: 6400, height: 6400 };
export const INSTANCE_IDS = ['Z1', 'Z2'] as const;
export const MAP_KEYS = ['city', 'forest', 'lava', 'undead'] as const;
export const MAP_IDS = [...INSTANCE_IDS];
export const DEFAULT_MAP_ID = 'Z1';
export const DEFAULT_MAP_KEY = 'city';
const parsedTickMs = Number(process.env.TICK_MS);
export const TICK_MS = Number.isFinite(parsedTickMs)
    ? Math.max(16, Math.min(100, Math.floor(parsedTickMs)))
    : 33;
export const MOB_COUNTS = { normal: 25, elite: 15, subboss: 5, boss: 1 };
export const INVENTORY_SIZE = 36;
export const MOB_RESPAWN_MS = 10000;
export const BASE_MOVE_SPEED = 140;
export const PLAYER_HALF_SIZE = 20;
export const LOCAL_CHAT_RADIUS = 650;
export const PORTAL_COOLDOWN_MS = 1200;
export const MOB_AGGRO_RANGE = 260;
export const MOB_LEASH_RANGE = 420;
export const MOB_ATTACK_RANGE = 64;
export const MOB_ATTACK_INTERVAL_MS = 1200;

export const MAP_THEMES: Record<string, 'city' | 'forest' | 'lava' | 'undead'> = {
    city: 'city',
    forest: 'forest',
    lava: 'lava',
    undead: 'undead'
};

export type MapFeature =
    | {
        id: string;
        kind: 'water' | 'lava' | 'mountain' | 'building' | 'trees' | 'ruins';
        shape: 'rect';
        x: number;
        y: number;
        w: number;
        h: number;
        collision?: boolean;
    }
    | {
        id: string;
        kind: 'water' | 'lava' | 'mountain' | 'building' | 'trees' | 'ruins';
        shape: 'circle';
        x: number;
        y: number;
        r: number;
        collision?: boolean;
    };

export const MAP_FEATURES_BY_KEY: Record<string, MapFeature[]> = {
    city: [],
    forest: [],
    lava: [],
    undead: []
};

export const MAP_CODE_BY_KEY: Record<string, string> = {
    city: 'A0',
    forest: 'A1',
    lava: 'A2',
    undead: 'A3'
};

export const MAP_KEY_BY_CODE: Record<string, string> = {
    A0: 'city',
    A1: 'forest',
    A2: 'lava',
    A3: 'undead'
};

export const DEFAULT_PLAYER_SPAWN_BY_MAP_KEY: Record<string, { x: number; y: number }> = {
    city: { x: 3160, y: 3400 },
    forest: { x: 1880, y: 2920 },
    lava: { x: 1240, y: 4200 },
    undead: { x: 1240, y: 4520 }
};

export function mapCodeFromKey(mapKey: string) {
    if (String(mapKey || '').startsWith('dng_')) return 'DNG';
    return MAP_CODE_BY_KEY[mapKey] || 'A0';
}

export const PORTALS_BY_MAP_KEY: Record<string, Array<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    toMapKey?: string;
    toX?: number;
    toY?: number;
    dungeonTemplateId?: string;
}>> = {
    city: [
        { id: 'city_to_forest_01', x: 5930, y: 3130, w: 120, h: 120, toMapKey: 'forest', toX: 260, toY: 3440 }
    ],
    forest: [
        { id: 'forest_to_city_01', x: 170, y: 3370, w: 120, h: 120, toMapKey: 'city', toX: 5730, toY: 3210 },
        { id: 'forest_to_lava_01', x: 6090, y: 3130, w: 120, h: 120, toMapKey: 'lava', toX: 260, toY: 3600 },
        { id: 'forest_dungeon_ruins_01', x: 2890, y: 1370, w: 120, h: 120, dungeonTemplateId: 'dng_forest_ruins_mvp' }
    ],
    lava: [
        { id: 'lava_to_forest_01', x: 170, y: 3530, w: 120, h: 120, toMapKey: 'forest', toX: 5950, toY: 3050 },
        { id: 'lava_to_undead_01', x: 6090, y: 2330, w: 120, h: 120, toMapKey: 'undead', toX: 260, toY: 3920 }
    ],
    undead: [
        { id: 'undead_to_lava_01', x: 170, y: 3850, w: 120, h: 120, toMapKey: 'lava', toX: 5950, toY: 2490 }
    ]
};

export function composeMapInstanceId(mapKey: string, instanceId: string) {
    return `${mapKey}::${instanceId}`;
}

export const DEFAULT_MOB = {
    size: 40,
    maxHp: 120,
    physicalDefense: 4,
    magicDefense: 4,
    xpReward: 35
};
export const MOB_VARIANTS = {
    normal: { mult: 1, size: 40, color: '#d63031' },
    elite: { mult: 2, size: 56, color: '#e67e22' },
    subboss: { mult: 5, size: 72, color: '#8e44ad' },
    boss: { mult: 9, size: 96, color: '#111111' }
};
export const ITEM_PICKUP_RANGE = 110;
export const GROUND_ITEM_TTL_MS = 60000;
export const COMBAT_LOCK_MS = 10000;
export const PARTY_MAX_MEMBERS = 5;
export const PARTY_INVITE_TTL_MS = 30000;
export const PARTY_JOIN_REQUEST_TTL_MS = 30000;
export {
    WEAPON_TEMPLATE,
    WEAPON_TEMPLATE_RUBI,
    WEAPON_TEMPLATES,
    HP_POTION_TEMPLATE,
    SKILL_RESET_HOURGLASS_TEMPLATE,
    CLASS_EQUIPMENT_TEMPLATES,
    BUILTIN_ITEM_TEMPLATES,
    BUILTIN_ITEM_TEMPLATE_BY_ID,
    NPC_SHOPS,
    resolveClassEquipmentTemplateId,
    resolveClassWeaponTemplateId,
    pickProgressionLootTemplate,
    pickMapMaterialTemplateId
};
export const SKILL_RESET_HOURGLASS_DROP_CHANCE = 0.5;
export const STATUS_IDS = {
    physicalAttack: 1,
    magicAttack: 2,
    physicalDefense: 3,
    magicDefense: 4,
    moveSpeed: 5,
    attackSpeed: 6,
    attackRange: 7,
    maxHp: 8
};
export const STATUS_BY_ID = Object.fromEntries(Object.entries(STATUS_IDS).map(([k, v]) => [String(v), k]));

export const CLASS_TEMPLATES = {
    shifter: {
        // Alias legado para Druida.
        str: 4,
        int: 13,
        dex: 6,
        vit: 9,
        initialHp: 135,
        moveSpeed: 100,
        attackSpeed: 100,
        attackRange: 250,
        damageType: 'magic'
    },
    knight: {
        str: 9,
        int: 3,
        dex: 5,
        vit: 13,
        initialHp: 190,
        moveSpeed: 95,
        attackSpeed: 95,
        attackRange: 64,
        damageType: 'physical'
    },
    archer: {
        str: 6,
        int: 4,
        dex: 13,
        vit: 7,
        initialHp: 120,
        moveSpeed: 112,
        attackSpeed: 130,
        attackRange: 260,
        damageType: 'physical'
    },
    druid: {
        str: 4,
        int: 13,
        dex: 6,
        vit: 9,
        initialHp: 135,
        moveSpeed: 100,
        attackSpeed: 100,
        attackRange: 250,
        damageType: 'magic'
    },
    bandit: {
        // Alias legado para Assassino.
        str: 8,
        int: 3,
        dex: 13,
        vit: 5,
        initialHp: 105,
        moveSpeed: 118,
        attackSpeed: 140,
        attackRange: 68,
        damageType: 'physical'
    },
    assassin: {
        str: 8,
        int: 3,
        dex: 13,
        vit: 5,
        initialHp: 105,
        moveSpeed: 118,
        attackSpeed: 140,
        attackRange: 68,
        damageType: 'physical'
    }
};
