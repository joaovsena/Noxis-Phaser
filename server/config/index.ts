// @ts-check

export const WORLD = { width: 3200, height: 3200 };
export const INSTANCE_IDS = ['Z1', 'Z2'] as const;
export const MAP_KEYS = ['forest', 'lava', 'undead'] as const;
export const MAP_IDS = [...INSTANCE_IDS];
export const DEFAULT_MAP_ID = 'Z1';
export const DEFAULT_MAP_KEY = 'forest';
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

export const MAP_THEMES: Record<string, 'forest' | 'lava' | 'undead'> = {
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
    forest: [
        { id: 'a1-river-main-1', kind: 'water', shape: 'rect', x: 1410, y: 300, w: 260, h: 900, collision: true },
        { id: 'a1-river-main-2', kind: 'water', shape: 'rect', x: 1370, y: 1160, w: 320, h: 960, collision: true },
        { id: 'a1-river-branch-left', kind: 'water', shape: 'rect', x: 980, y: 1060, w: 380, h: 220, collision: true },
        { id: 'a1-river-branch-right', kind: 'water', shape: 'rect', x: 1690, y: 980, w: 420, h: 210, collision: true },
        { id: 'a1-forest-north', kind: 'trees', shape: 'rect', x: 280, y: 120, w: 2620, h: 640, collision: true },
        { id: 'a1-forest-west', kind: 'trees', shape: 'rect', x: 140, y: 640, w: 540, h: 1080, collision: true },
        { id: 'a1-forest-east', kind: 'trees', shape: 'rect', x: 2520, y: 640, w: 560, h: 1020, collision: true },
        { id: 'a1-cliff-north-mid', kind: 'mountain', shape: 'rect', x: 1220, y: 760, w: 760, h: 220, collision: true },
        { id: 'a1-rock-garden-1', kind: 'mountain', shape: 'circle', x: 1660, y: 1780, r: 90, collision: true }
    ],
    lava: [
        { id: 'l-pool-nw', kind: 'lava', shape: 'circle', x: 650, y: 700, r: 240, collision: true },
        { id: 'l-pool-center', kind: 'lava', shape: 'circle', x: 1600, y: 1520, r: 300, collision: true },
        { id: 'l-pool-se', kind: 'lava', shape: 'circle', x: 2630, y: 2490, r: 240, collision: true },
        { id: 'l-river-west', kind: 'lava', shape: 'rect', x: 260, y: 2140, w: 930, h: 170, collision: true },
        { id: 'l-river-east', kind: 'lava', shape: 'rect', x: 2040, y: 890, w: 910, h: 170, collision: true },
        { id: 'l-mtn-north', kind: 'mountain', shape: 'rect', x: 1060, y: 120, w: 1100, h: 300, collision: true },
        { id: 'l-mtn-west', kind: 'mountain', shape: 'rect', x: 140, y: 1220, w: 440, h: 840, collision: true },
        { id: 'l-mtn-east', kind: 'mountain', shape: 'rect', x: 2680, y: 1180, w: 360, h: 900, collision: true },
        { id: 'l-ruins-1', kind: 'ruins', shape: 'rect', x: 1220, y: 730, w: 210, h: 170, collision: true },
        { id: 'l-ruins-2', kind: 'ruins', shape: 'rect', x: 1460, y: 770, w: 230, h: 190, collision: true },
        { id: 'l-ruins-3', kind: 'ruins', shape: 'rect', x: 1720, y: 730, w: 220, h: 160, collision: true },
        { id: 'l-fort', kind: 'building', shape: 'rect', x: 1260, y: 2480, w: 640, h: 300, collision: true },
        { id: 'l-crater', kind: 'mountain', shape: 'circle', x: 2240, y: 1780, r: 160, collision: true }
    ],
    undead: [
        { id: 'u-swamp-main-1', kind: 'water', shape: 'rect', x: 520, y: 560, w: 690, h: 460, collision: true },
        { id: 'u-swamp-main-2', kind: 'water', shape: 'rect', x: 980, y: 980, w: 980, h: 430, collision: true },
        { id: 'u-swamp-main-3', kind: 'water', shape: 'rect', x: 1840, y: 1390, w: 740, h: 470, collision: true },
        { id: 'u-swamp-east', kind: 'water', shape: 'circle', x: 2770, y: 870, r: 210, collision: true },
        { id: 'u-ruins-north', kind: 'ruins', shape: 'rect', x: 1080, y: 280, w: 930, h: 260, collision: true },
        { id: 'u-ruins-center', kind: 'ruins', shape: 'rect', x: 1380, y: 1710, w: 530, h: 270, collision: true },
        { id: 'u-bones-west', kind: 'mountain', shape: 'rect', x: 210, y: 1420, w: 420, h: 770, collision: true },
        { id: 'u-graveyard-east', kind: 'building', shape: 'rect', x: 2530, y: 1890, w: 500, h: 760, collision: true },
        { id: 'u-dead-forest-north', kind: 'trees', shape: 'rect', x: 280, y: 70, w: 2640, h: 180, collision: true },
        { id: 'u-dead-forest-south', kind: 'trees', shape: 'rect', x: 300, y: 2830, w: 2620, h: 220, collision: true }
    ]
};

export const MAP_CODE_BY_KEY: Record<string, string> = {
    forest: 'A1',
    lava: 'A2',
    undead: 'A3'
};

export const MAP_KEY_BY_CODE: Record<string, string> = {
    A1: 'forest',
    A2: 'lava',
    A3: 'undead'
};

export function mapCodeFromKey(mapKey: string) {
    if (String(mapKey || '').startsWith('dng_')) return 'DNG';
    return MAP_CODE_BY_KEY[mapKey] || 'A1';
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
    forest: [
        // Portal na ponta da estrada leste (ativacao pontual).
        { id: 'forest_to_lava_01', x: 3053, y: 1821, w: 130, h: 130, toMapKey: 'lava', toX: 210, toY: 2286 },
        // Entrada de dungeon instanciada (MVP).
        { id: 'forest_dungeon_ruins_01', x: 740, y: 470, w: 120, h: 120, dungeonTemplateId: 'dng_forest_ruins_mvp' }
    ],
    lava: [
        // Corredor entre A1, A2 e A3 em pontos finais de estrada.
        { id: 'lava_to_forest_01', x: 0, y: 2221, w: 130, h: 130, toMapKey: 'forest', toX: 3002, toY: 1886 },
        { id: 'lava_to_undead_01', x: 3053, y: 2221, w: 130, h: 130, toMapKey: 'undead', toX: 210, toY: 2286 }
    ],
    undead: [
        { id: 'undead_to_lava_01', x: 0, y: 2221, w: 130, h: 130, toMapKey: 'lava', toX: 3002, toY: 2286 }
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
export const WEAPON_TEMPLATE = {
    id: 'weapon_teste',
    type: 'weapon',
    name: 'Arma Teste',
    rarity: 'common',
    spriteId: 'weapon_steel',
    iconUrl: '/assets/ui/items/weapon-steel.svg',
    slot: 'weapon',
    price: { silver: 12 },
    bonuses: {
        physicalAttack: 10,
        magicAttack: 10,
        moveSpeed: 50,
        attackSpeed: 50
    }
};
export const WEAPON_TEMPLATE_RUBI = {
    id: 'weapon_rubi',
    type: 'weapon',
    name: 'Arma de Rubi',
    rarity: 'rare',
    spriteId: 'weapon_ruby',
    iconUrl: '/assets/ui/items/weapon-ruby.svg',
    slot: 'weapon',
    price: { gold: 2, silver: 50 },
    bonuses: {
        physicalAttack: 16,
        magicAttack: 6,
        moveSpeed: 20,
        attackSpeed: 35
    }
};
export const WEAPON_TEMPLATES = [WEAPON_TEMPLATE, WEAPON_TEMPLATE_RUBI];
export const HP_POTION_TEMPLATE = {
    id: 'potion_hp',
    type: 'potion_hp',
    name: 'Pocao de HP',
    rarity: 'common',
    spriteId: 'potion_hp',
    iconUrl: '/assets/ui/items/potion-hp.svg',
    slot: 'consumable',
    price: { copper: 45 },
    healPercent: 0.5,
    stackable: true,
    maxStack: 250
};
export const SKILL_RESET_HOURGLASS_TEMPLATE = {
    id: 'skill_reset_hourglass',
    type: 'skill_reset_hourglass',
    name: 'Ampulheta de Habilidades',
    rarity: 'epic',
    spriteId: 'hourglass',
    iconUrl: '/assets/ui/items/hourglass.svg',
    slot: 'consumable',
    price: { silver: 30 },
    stackable: true,
    maxStack: 250
};
const CLASS_EQUIPMENT_BASE: Record<'knight' | 'archer' | 'druid' | 'assassin', { name: string; stat: 'physicalDefense' | 'magicDefense' | 'evasion' }> = {
    knight: { name: 'do Cavaleiro', stat: 'physicalDefense' },
    archer: { name: 'do Arqueiro', stat: 'evasion' },
    druid: { name: 'do Druida', stat: 'magicDefense' },
    assassin: { name: 'do Assassino', stat: 'evasion' }
};
const EQUIPMENT_SLOT_DEFS: Array<{ slot: 'helmet' | 'chest' | 'pants' | 'gloves' | 'boots' | 'ring' | 'necklace'; name: string; power: number; price: any }> = [
    { slot: 'helmet', name: 'Capacete', power: 4, price: { silver: 8 } },
    { slot: 'chest', name: 'Peitoral', power: 8, price: { silver: 13 } },
    { slot: 'pants', name: 'Calca', power: 6, price: { silver: 10 } },
    { slot: 'gloves', name: 'Luva', power: 3, price: { silver: 6 } },
    { slot: 'boots', name: 'Bota', power: 3, price: { silver: 6 } },
    { slot: 'ring', name: 'Anel', power: 5, price: { silver: 9 } },
    { slot: 'necklace', name: 'Colar', power: 5, price: { silver: 9 } }
];
export const CLASS_EQUIPMENT_TEMPLATES = (Object.keys(CLASS_EQUIPMENT_BASE) as Array<'knight' | 'archer' | 'druid' | 'assassin'>)
    .flatMap((classId) => {
        const classDef = CLASS_EQUIPMENT_BASE[classId];
        return EQUIPMENT_SLOT_DEFS.map((slotDef) => {
            const bonuses: Record<string, number> = {};
            bonuses[classDef.stat] = slotDef.power;
            if (slotDef.slot === 'boots') bonuses.moveSpeed = 8;
            if (slotDef.slot === 'gloves') bonuses.attackSpeed = 5;
            if (slotDef.slot === 'ring') bonuses.physicalAttack = classId === 'druid' ? 0 : 3;
            if (slotDef.slot === 'ring') bonuses.magicAttack = classId === 'druid' ? 3 : 0;
            if (slotDef.slot === 'necklace') bonuses.maxHp = 35;
            return {
                id: `equip_${classId}_${slotDef.slot}`,
                type: 'equipment',
                name: `${slotDef.name} ${classDef.name}`,
                rarity: slotDef.slot === 'ring' || slotDef.slot === 'necklace' ? 'epic' : 'common',
                spriteId: `equip_${slotDef.slot}`,
                iconUrl: `/assets/ui/items/${slotDef.slot}.svg`,
                slot: slotDef.slot,
                requiredClass: classId,
                price: slotDef.price,
                bonuses
            };
        });
    });
export const BUILTIN_ITEM_TEMPLATES = [
    WEAPON_TEMPLATE,
    WEAPON_TEMPLATE_RUBI,
    HP_POTION_TEMPLATE,
    SKILL_RESET_HOURGLASS_TEMPLATE,
    ...CLASS_EQUIPMENT_TEMPLATES
];
export const BUILTIN_ITEM_TEMPLATE_BY_ID = BUILTIN_ITEM_TEMPLATES.reduce((acc: Record<string, any>, template: any) => {
    if (template?.id) acc[String(template.id)] = template;
    if (template?.type) acc[String(template.type)] = template;
    return acc;
}, {});
export const NPC_SHOPS: Record<string, Array<{ offerId: string; templateId: string; quantity?: number }>> = {
    npc_ferreiro_borin: [
        { offerId: 'blacksmith_weapon_teste', templateId: 'weapon_teste', quantity: 1 },
        { offerId: 'blacksmith_weapon_rubi', templateId: 'weapon_rubi', quantity: 1 },
        { offerId: 'blacksmith_armor_knight_helmet', templateId: 'equip_knight_helmet', quantity: 1 },
        { offerId: 'blacksmith_armor_knight_chest', templateId: 'equip_knight_chest', quantity: 1 },
        { offerId: 'blacksmith_armor_knight_pants', templateId: 'equip_knight_pants', quantity: 1 },
        { offerId: 'blacksmith_armor_knight_gloves', templateId: 'equip_knight_gloves', quantity: 1 },
        { offerId: 'blacksmith_armor_knight_boots', templateId: 'equip_knight_boots', quantity: 1 },
        { offerId: 'blacksmith_armor_knight_ring', templateId: 'equip_knight_ring', quantity: 1 },
        { offerId: 'blacksmith_armor_knight_necklace', templateId: 'equip_knight_necklace', quantity: 1 },
        { offerId: 'blacksmith_armor_archer_helmet', templateId: 'equip_archer_helmet', quantity: 1 },
        { offerId: 'blacksmith_armor_archer_chest', templateId: 'equip_archer_chest', quantity: 1 },
        { offerId: 'blacksmith_armor_archer_pants', templateId: 'equip_archer_pants', quantity: 1 },
        { offerId: 'blacksmith_armor_archer_gloves', templateId: 'equip_archer_gloves', quantity: 1 },
        { offerId: 'blacksmith_armor_archer_boots', templateId: 'equip_archer_boots', quantity: 1 },
        { offerId: 'blacksmith_armor_archer_ring', templateId: 'equip_archer_ring', quantity: 1 },
        { offerId: 'blacksmith_armor_archer_necklace', templateId: 'equip_archer_necklace', quantity: 1 },
        { offerId: 'blacksmith_armor_druid_helmet', templateId: 'equip_druid_helmet', quantity: 1 },
        { offerId: 'blacksmith_armor_druid_chest', templateId: 'equip_druid_chest', quantity: 1 },
        { offerId: 'blacksmith_armor_druid_pants', templateId: 'equip_druid_pants', quantity: 1 },
        { offerId: 'blacksmith_armor_druid_gloves', templateId: 'equip_druid_gloves', quantity: 1 },
        { offerId: 'blacksmith_armor_druid_boots', templateId: 'equip_druid_boots', quantity: 1 },
        { offerId: 'blacksmith_armor_druid_ring', templateId: 'equip_druid_ring', quantity: 1 },
        { offerId: 'blacksmith_armor_druid_necklace', templateId: 'equip_druid_necklace', quantity: 1 },
        { offerId: 'blacksmith_armor_assassin_helmet', templateId: 'equip_assassin_helmet', quantity: 1 },
        { offerId: 'blacksmith_armor_assassin_chest', templateId: 'equip_assassin_chest', quantity: 1 },
        { offerId: 'blacksmith_armor_assassin_pants', templateId: 'equip_assassin_pants', quantity: 1 },
        { offerId: 'blacksmith_armor_assassin_gloves', templateId: 'equip_assassin_gloves', quantity: 1 },
        { offerId: 'blacksmith_armor_assassin_boots', templateId: 'equip_assassin_boots', quantity: 1 },
        { offerId: 'blacksmith_armor_assassin_ring', templateId: 'equip_assassin_ring', quantity: 1 },
        { offerId: 'blacksmith_armor_assassin_necklace', templateId: 'equip_assassin_necklace', quantity: 1 }
    ],
    npc_guard_alden: [
        { offerId: 'guard_potion_hp', templateId: 'potion_hp', quantity: 1 },
        { offerId: 'guard_hourglass', templateId: 'skill_reset_hourglass', quantity: 1 }
    ],
    npc_scout_lina: [
        { offerId: 'scout_potion_hp', templateId: 'potion_hp', quantity: 1 }
    ]
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
        str: 5,
        int: 12,
        dex: 6,
        vit: 9,
        initialHp: 140,
        moveSpeed: 100,
        attackSpeed: 100,
        attackRange: 220,
        damageType: 'magic'
    },
    knight: {
        str: 10,
        int: 5,
        dex: 5,
        vit: 12,
        initialHp: 180,
        moveSpeed: 100,
        attackSpeed: 100,
        attackRange: 58,
        damageType: 'physical'
    },
    archer: {
        str: 8,
        int: 5,
        dex: 12,
        vit: 7,
        initialHp: 120,
        moveSpeed: 110,
        attackSpeed: 130,
        attackRange: 220,
        damageType: 'physical'
    },
    druid: {
        str: 5,
        int: 12,
        dex: 6,
        vit: 9,
        initialHp: 140,
        moveSpeed: 100,
        attackSpeed: 100,
        attackRange: 220,
        damageType: 'magic'
    },
    bandit: {
        // Alias legado para Assassino.
        str: 9,
        int: 4,
        dex: 12,
        vit: 5,
        initialHp: 100,
        moveSpeed: 150,
        attackSpeed: 200,
        attackRange: 58,
        damageType: 'physical'
    },
    assassin: {
        str: 9,
        int: 4,
        dex: 12,
        vit: 5,
        initialHp: 100,
        moveSpeed: 150,
        attackSpeed: 200,
        attackRange: 58,
        damageType: 'physical'
    }
};
