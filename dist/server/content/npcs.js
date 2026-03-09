"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NPC_BY_ID = exports.NPCS = exports.AMBIENT_NPCS = exports.CHEST_NPCS = exports.SHOP_NPCS = exports.QUEST_NPCS = exports.NPC_INTERACT_RANGE = void 0;
exports.NPC_INTERACT_RANGE = 170;
const NPC_DEFAULTS = {
    hitbox: { w: 54, h: 80, offsetX: 0, offsetY: 0 },
    anchor: { x: 0.5, y: 1 },
    interactRange: exports.NPC_INTERACT_RANGE,
    spriteKey: null,
    dungeonTemplateId: null
};
function npc(def) {
    return {
        ...NPC_DEFAULTS,
        ...def
    };
}
exports.QUEST_NPCS = [
    npc({
        id: 'npc_guard_alden',
        name: 'Guarda Alden',
        category: 'quest',
        role: 'quest_giver',
        mapKey: 'forest',
        mapId: 'Z1',
        x: 560,
        y: 560,
        greeting: 'Patrulheiro, preciso de ajuda na area.'
    }),
    npc({
        id: 'npc_scout_lina',
        name: 'Exploradora Lina',
        category: 'quest',
        role: 'quest_giver',
        mapKey: 'forest',
        mapId: 'Z1',
        x: 930,
        y: 680,
        greeting: 'Estou observando os movimentos dos monstros.'
    })
];
exports.SHOP_NPCS = [
    npc({
        id: 'npc_ferreiro_borin',
        name: 'Ferreiro Borin',
        category: 'shop',
        role: 'shopkeeper',
        mapKey: 'forest',
        mapId: 'Z1',
        x: 690,
        y: 565,
        greeting: 'Aco temperado e precos justos. O que vai levar?'
    })
];
exports.CHEST_NPCS = [
// Exemplo para futuro:
// npc({
//     id: 'npc_bau_zenon',
//     name: 'Guardiao do Bau',
//     category: 'chest',
//     role: 'chest_keeper',
//     mapKey: 'forest',
//     mapId: 'Z1',
//     x: 780,
//     y: 600,
//     greeting: 'Quer acessar seu bau pessoal?'
// })
];
exports.AMBIENT_NPCS = [
    npc({
        id: 'npc_dungeon_warden',
        name: 'Guardiao das Ruinas',
        category: 'ambient',
        role: 'civilian',
        mapKey: 'forest',
        mapId: 'Z1',
        x: 760,
        y: 520,
        greeting: 'Somente os preparados sobrevivem as Ruinas de Alder.',
        dungeonTemplateId: 'dng_forest_ruins_mvp'
    }),
    npc({
        id: 'npc_cidadao_marek',
        name: 'Cidadao Marek',
        category: 'ambient',
        role: 'civilian',
        mapKey: 'forest',
        mapId: 'Z1',
        x: 510,
        y: 640,
        greeting: 'Os mercados andam movimentados hoje.'
    })
];
exports.NPCS = [
    ...exports.QUEST_NPCS,
    ...exports.SHOP_NPCS,
    ...exports.CHEST_NPCS,
    ...exports.AMBIENT_NPCS
];
exports.NPC_BY_ID = Object.fromEntries(exports.NPCS.map((n) => [n.id, n]));
//# sourceMappingURL=npcs.js.map