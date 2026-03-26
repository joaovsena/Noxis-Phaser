"use strict";
// @ts-check
Object.defineProperty(exports, "__esModule", { value: true });
exports.CLASS_TEMPLATES = exports.STATUS_BY_ID = exports.STATUS_IDS = exports.SKILL_RESET_HOURGLASS_DROP_CHANCE = exports.pickMapMaterialTemplateId = exports.pickProgressionLootTemplate = exports.resolveClassWeaponTemplateId = exports.resolveClassEquipmentTemplateId = exports.NPC_SHOPS = exports.BUILTIN_ITEM_TEMPLATE_BY_ID = exports.BUILTIN_ITEM_TEMPLATES = exports.CLASS_EQUIPMENT_TEMPLATES = exports.SKILL_RESET_HOURGLASS_TEMPLATE = exports.HP_POTION_TEMPLATE = exports.WEAPON_TEMPLATES = exports.WEAPON_TEMPLATE_RUBI = exports.WEAPON_TEMPLATE = exports.PARTY_JOIN_REQUEST_TTL_MS = exports.PARTY_INVITE_TTL_MS = exports.PARTY_MAX_MEMBERS = exports.COMBAT_LOCK_MS = exports.GROUND_ITEM_TTL_MS = exports.ITEM_PICKUP_RANGE = exports.MOB_VARIANTS = exports.DEFAULT_MOB = exports.PORTALS_BY_MAP_KEY = exports.DEFAULT_PLAYER_SPAWN_BY_MAP_KEY = exports.MAP_KEY_BY_CODE = exports.MAP_CODE_BY_KEY = exports.MAP_FEATURES_BY_KEY = exports.MAP_THEMES = exports.MOB_ATTACK_INTERVAL_MS = exports.MOB_ATTACK_RANGE = exports.MOB_LEASH_RANGE = exports.MOB_AGGRO_RANGE = exports.PORTAL_COOLDOWN_MS = exports.LOCAL_CHAT_RADIUS = exports.PLAYER_HALF_SIZE = exports.BASE_MOVE_SPEED = exports.MOB_RESPAWN_MS = exports.INVENTORY_SIZE = exports.MOB_COUNTS = exports.TICK_MS = exports.DEFAULT_MAP_KEY = exports.DEFAULT_MAP_ID = exports.MAP_IDS = exports.MAP_KEYS = exports.INSTANCE_IDS = exports.WORLD = void 0;
exports.mapCodeFromKey = mapCodeFromKey;
exports.composeMapInstanceId = composeMapInstanceId;
const itemCatalog_1 = require("../content/itemCatalog");
Object.defineProperty(exports, "BUILTIN_ITEM_TEMPLATE_BY_ID", { enumerable: true, get: function () { return itemCatalog_1.BUILTIN_ITEM_TEMPLATE_BY_ID; } });
Object.defineProperty(exports, "BUILTIN_ITEM_TEMPLATES", { enumerable: true, get: function () { return itemCatalog_1.BUILTIN_ITEM_TEMPLATES; } });
Object.defineProperty(exports, "CLASS_EQUIPMENT_TEMPLATES", { enumerable: true, get: function () { return itemCatalog_1.CLASS_EQUIPMENT_TEMPLATES; } });
Object.defineProperty(exports, "HP_POTION_TEMPLATE", { enumerable: true, get: function () { return itemCatalog_1.HP_POTION_TEMPLATE; } });
Object.defineProperty(exports, "NPC_SHOPS", { enumerable: true, get: function () { return itemCatalog_1.NPC_SHOPS; } });
Object.defineProperty(exports, "SKILL_RESET_HOURGLASS_TEMPLATE", { enumerable: true, get: function () { return itemCatalog_1.SKILL_RESET_HOURGLASS_TEMPLATE; } });
Object.defineProperty(exports, "WEAPON_TEMPLATE", { enumerable: true, get: function () { return itemCatalog_1.WEAPON_TEMPLATE; } });
Object.defineProperty(exports, "WEAPON_TEMPLATE_RUBI", { enumerable: true, get: function () { return itemCatalog_1.WEAPON_TEMPLATE_RUBI; } });
Object.defineProperty(exports, "WEAPON_TEMPLATES", { enumerable: true, get: function () { return itemCatalog_1.WEAPON_TEMPLATES; } });
Object.defineProperty(exports, "pickMapMaterialTemplateId", { enumerable: true, get: function () { return itemCatalog_1.pickMapMaterialTemplateId; } });
Object.defineProperty(exports, "pickProgressionLootTemplate", { enumerable: true, get: function () { return itemCatalog_1.pickProgressionLootTemplate; } });
Object.defineProperty(exports, "resolveClassEquipmentTemplateId", { enumerable: true, get: function () { return itemCatalog_1.resolveClassEquipmentTemplateId; } });
Object.defineProperty(exports, "resolveClassWeaponTemplateId", { enumerable: true, get: function () { return itemCatalog_1.resolveClassWeaponTemplateId; } });
exports.WORLD = { width: 6400, height: 6400 };
exports.INSTANCE_IDS = ['Z1', 'Z2'];
exports.MAP_KEYS = ['city', 'forest', 'lava', 'undead'];
exports.MAP_IDS = [...exports.INSTANCE_IDS];
exports.DEFAULT_MAP_ID = 'Z1';
exports.DEFAULT_MAP_KEY = 'city';
const parsedTickMs = Number(process.env.TICK_MS);
exports.TICK_MS = Number.isFinite(parsedTickMs)
    ? Math.max(16, Math.min(100, Math.floor(parsedTickMs)))
    : 33;
exports.MOB_COUNTS = { normal: 25, elite: 15, subboss: 5, boss: 1 };
exports.INVENTORY_SIZE = 36;
exports.MOB_RESPAWN_MS = 10000;
exports.BASE_MOVE_SPEED = 140;
exports.PLAYER_HALF_SIZE = 20;
exports.LOCAL_CHAT_RADIUS = 650;
exports.PORTAL_COOLDOWN_MS = 1200;
exports.MOB_AGGRO_RANGE = 260;
exports.MOB_LEASH_RANGE = 420;
exports.MOB_ATTACK_RANGE = 64;
exports.MOB_ATTACK_INTERVAL_MS = 1200;
exports.MAP_THEMES = {
    city: 'city',
    forest: 'forest',
    lava: 'lava',
    undead: 'undead'
};
exports.MAP_FEATURES_BY_KEY = {
    city: [],
    forest: [],
    lava: [],
    undead: []
};
exports.MAP_CODE_BY_KEY = {
    city: 'A0',
    forest: 'A1',
    lava: 'A2',
    undead: 'A3'
};
exports.MAP_KEY_BY_CODE = {
    A0: 'city',
    A1: 'forest',
    A2: 'lava',
    A3: 'undead'
};
exports.DEFAULT_PLAYER_SPAWN_BY_MAP_KEY = {
    city: { x: 3160, y: 3400 },
    forest: { x: 1880, y: 2920 },
    lava: { x: 1240, y: 4200 },
    undead: { x: 1240, y: 4520 }
};
function mapCodeFromKey(mapKey) {
    if (String(mapKey || '').startsWith('dng_'))
        return 'DNG';
    return exports.MAP_CODE_BY_KEY[mapKey] || 'A0';
}
exports.PORTALS_BY_MAP_KEY = {
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
function composeMapInstanceId(mapKey, instanceId) {
    return `${mapKey}::${instanceId}`;
}
exports.DEFAULT_MOB = {
    size: 40,
    maxHp: 120,
    physicalDefense: 4,
    magicDefense: 4,
    xpReward: 35
};
exports.MOB_VARIANTS = {
    normal: { mult: 1, size: 40, color: '#d63031' },
    elite: { mult: 2, size: 56, color: '#e67e22' },
    subboss: { mult: 5, size: 72, color: '#8e44ad' },
    boss: { mult: 9, size: 96, color: '#111111' }
};
exports.ITEM_PICKUP_RANGE = 110;
exports.GROUND_ITEM_TTL_MS = 60000;
exports.COMBAT_LOCK_MS = 10000;
exports.PARTY_MAX_MEMBERS = 5;
exports.PARTY_INVITE_TTL_MS = 30000;
exports.PARTY_JOIN_REQUEST_TTL_MS = 30000;
exports.SKILL_RESET_HOURGLASS_DROP_CHANCE = 0.5;
exports.STATUS_IDS = {
    physicalAttack: 1,
    magicAttack: 2,
    physicalDefense: 3,
    magicDefense: 4,
    moveSpeed: 5,
    attackSpeed: 6,
    attackRange: 7,
    maxHp: 8
};
exports.STATUS_BY_ID = Object.fromEntries(Object.entries(exports.STATUS_IDS).map(([k, v]) => [String(v), k]));
exports.CLASS_TEMPLATES = {
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
    },
    necromancer: {
        str: 3,
        int: 14,
        dex: 6,
        vit: 9,
        initialHp: 128,
        moveSpeed: 98,
        attackSpeed: 102,
        attackRange: 265,
        damageType: 'magic'
    }
};
//# sourceMappingURL=index.js.map