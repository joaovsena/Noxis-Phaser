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
        mapKey: 'city',
        mapId: 'Z1',
        x: 3960,
        y: 3160,
        greeting: 'Patrulheiro, preciso de ajuda na area.'
    }),
    npc({
        id: 'npc_scout_lina',
        name: 'Exploradora Lina',
        category: 'quest',
        role: 'quest_giver',
        mapKey: 'forest',
        mapId: 'Z1',
        x: 1880,
        y: 2920,
        greeting: 'Estou observando os movimentos dos monstros.'
    }),
    npc({
        id: 'npc_curandeira_selene',
        name: 'Curandeira Selene',
        category: 'quest',
        role: 'quest_giver',
        mapKey: 'city',
        mapId: 'Z1',
        x: 2440,
        y: 2440,
        greeting: 'Traga-me noticias da linha de frente e eu manterei todos de pe.'
    }),
    npc({
        id: 'npc_mestre_rowan',
        name: 'Mestre Rowan',
        category: 'quest',
        role: 'quest_giver',
        mapKey: 'city',
        mapId: 'Z1',
        x: 3880,
        y: 2440,
        greeting: 'Disciplina, postura e repeticao. E assim que se sobrevive alem do portao.'
    }),
    npc({
        id: 'npc_cidadao_marek',
        name: 'Cidadao Marek',
        category: 'quest',
        role: 'quest_giver',
        mapKey: 'city',
        mapId: 'Z1',
        x: 2920,
        y: 3480,
        greeting: 'Os mercados andam movimentados hoje.'
    }),
    npc({
        id: 'npc_vigia_kael',
        name: 'Vigia Kael',
        category: 'quest',
        role: 'quest_giver',
        mapKey: 'lava',
        mapId: 'Z1',
        x: 1500,
        y: 4160,
        greeting: 'O calor daqui testa ate os mais disciplinados. Se vai atravessar as brasas, faca isso com ordem.'
    }),
    npc({
        id: 'npc_pesquisadora_iris',
        name: 'Pesquisadora Iris',
        category: 'quest',
        role: 'quest_giver',
        mapKey: 'lava',
        mapId: 'Z1',
        x: 1860,
        y: 3940,
        greeting: 'As fendas de magma escondem reagentes valiosos. Traga amostras e eu transformarei isso em vantagem.'
    }),
    npc({
        id: 'npc_exorcista_sera',
        name: 'Exorcista Sera',
        category: 'quest',
        role: 'quest_giver',
        mapKey: 'undead',
        mapId: 'Z1',
        x: 1520,
        y: 4440,
        greeting: 'Cada passo neste brejo e uma oracao. Se pretende avancar, va purificando o caminho.'
    }),
    npc({
        id: 'npc_coveiro_doran',
        name: 'Coveiro Doran',
        category: 'quest',
        role: 'quest_giver',
        mapKey: 'undead',
        mapId: 'Z1',
        x: 1880,
        y: 4240,
        greeting: 'Conheco este lodo melhor que ninguem. Junte restos uteis e eu lhe conto onde os mortos se agitam mais.'
    })
];
exports.SHOP_NPCS = [
    npc({
        id: 'npc_ferreiro_borin',
        name: 'Ferreiro Borin',
        category: 'shop',
        role: 'shopkeeper',
        mapKey: 'city',
        mapId: 'Z1',
        x: 1903,
        y: 4149,
        interactRange: 220,
        greeting: 'Aco temperado e precos justos. O que vai levar?'
    }),
    npc({
        id: 'npc_armeira_maeve',
        name: 'Armeira Maeve',
        category: 'shop',
        role: 'shopkeeper',
        mapKey: 'city',
        mapId: 'Z1',
        x: 2732,
        y: 4089,
        greeting: 'Couro, malha e mantos ajustados para cada trilha. Escolha o que veste melhor.'
    }),
    npc({
        id: 'npc_joalheiro_orin',
        name: 'Joalheiro Orin',
        category: 'shop',
        role: 'shopkeeper',
        mapKey: 'city',
        mapId: 'Z1',
        x: 4473,
        y: 3764,
        greeting: 'Uma boa joia muda o destino de uma batalha. Veja as pecas que acabei de lapidar.'
    }),
    npc({
        id: 'npc_mercadora_tessa',
        name: 'Mercadora Tessa',
        category: 'shop',
        role: 'shopkeeper',
        mapKey: 'city',
        mapId: 'Z1',
        x: 4329,
        y: 3824,
        greeting: 'Mantimentos, reagentes e utilidades para quem vai alem da ponte.'
    })
];
exports.CHEST_NPCS = [
    npc({
        id: 'npc_bau_zenon',
        name: 'Guardiao do Bau',
        category: 'chest',
        role: 'chest_keeper',
        mapKey: 'city',
        mapId: 'Z1',
        x: 3512,
        y: 3824,
        greeting: 'Seu bau pessoal esta seguro comigo.'
    })
];
exports.AMBIENT_NPCS = [
    npc({
        id: 'npc_dungeon_warden',
        name: 'Guardiao das Ruinas',
        category: 'ambient',
        role: 'civilian',
        mapKey: 'forest',
        mapId: 'Z1',
        x: 2680,
        y: 1880,
        greeting: 'Somente os preparados sobrevivem as Ruinas de Alder.',
        dungeonTemplateId: 'dng_forest_ruins_mvp'
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