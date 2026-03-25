export type NpcDef = {
    id: string;
    name: string;
    mapKey: string;
    mapId: string;
    x: number;
    y: number;
    role: 'quest_giver' | 'shopkeeper' | 'chest_keeper' | 'civilian';
    category: 'quest' | 'shop' | 'chest' | 'ambient';
    greeting: string;
    hitbox?: { w: number; h: number; offsetX?: number; offsetY?: number };
    anchor?: { x: number; y: number };
    interactRange?: number;
    spriteKey?: string | null;
    dungeonTemplateId?: string | null;
};

export const NPC_INTERACT_RANGE = 170;

const NPC_DEFAULTS: Pick<NpcDef, 'hitbox' | 'anchor' | 'interactRange' | 'spriteKey' | 'dungeonTemplateId'> = {
    hitbox: { w: 54, h: 80, offsetX: 0, offsetY: 0 },
    anchor: { x: 0.5, y: 1 },
    interactRange: NPC_INTERACT_RANGE,
    spriteKey: null,
    dungeonTemplateId: null
};

function npc(def: Omit<NpcDef, 'hitbox' | 'anchor' | 'interactRange' | 'spriteKey'> & Partial<NpcDef>): NpcDef {
    return {
        ...NPC_DEFAULTS,
        ...def
    };
}

export const QUEST_NPCS: NpcDef[] = [
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
    })
];

export const SHOP_NPCS: NpcDef[] = [
    npc({
        id: 'npc_ferreiro_borin',
        name: 'Ferreiro Borin',
        category: 'shop',
        role: 'shopkeeper',
        mapKey: 'city',
        mapId: 'Z1',
        x: 2280,
        y: 4120,
        greeting: 'Aco temperado e precos justos. O que vai levar?'
    }),
    npc({
        id: 'npc_armeira_maeve',
        name: 'Armeira Maeve',
        category: 'shop',
        role: 'shopkeeper',
        mapKey: 'city',
        mapId: 'Z1',
        x: 2640,
        y: 4180,
        greeting: 'Couro, malha e mantos ajustados para cada trilha. Escolha o que veste melhor.'
    }),
    npc({
        id: 'npc_joalheiro_orin',
        name: 'Joalheiro Orin',
        category: 'shop',
        role: 'shopkeeper',
        mapKey: 'city',
        mapId: 'Z1',
        x: 4540,
        y: 3840,
        greeting: 'Uma boa joia muda o destino de uma batalha. Veja as pecas que acabei de lapidar.'
    }),
    npc({
        id: 'npc_mercadora_tessa',
        name: 'Mercadora Tessa',
        category: 'shop',
        role: 'shopkeeper',
        mapKey: 'city',
        mapId: 'Z1',
        x: 4200,
        y: 3960,
        greeting: 'Mantimentos, reagentes e utilidades para quem vai alem da ponte.'
    })
];

export const CHEST_NPCS: NpcDef[] = [
    npc({
        id: 'npc_bau_zenon',
        name: 'Guardiao do Bau',
        category: 'chest',
        role: 'chest_keeper',
        mapKey: 'city',
        mapId: 'Z1',
        x: 3640,
        y: 3960,
        greeting: 'Seu bau pessoal esta seguro comigo.'
    })
];

export const AMBIENT_NPCS: NpcDef[] = [
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

export const NPCS: NpcDef[] = [
    ...QUEST_NPCS,
    ...SHOP_NPCS,
    ...CHEST_NPCS,
    ...AMBIENT_NPCS
];

export const NPC_BY_ID = Object.fromEntries(NPCS.map((n) => [n.id, n])) as Record<string, NpcDef>;
