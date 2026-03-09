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

export const SHOP_NPCS: NpcDef[] = [
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

export const CHEST_NPCS: NpcDef[] = [
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

export const AMBIENT_NPCS: NpcDef[] = [
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

export const NPCS: NpcDef[] = [
    ...QUEST_NPCS,
    ...SHOP_NPCS,
    ...CHEST_NPCS,
    ...AMBIENT_NPCS
];

export const NPC_BY_ID = Object.fromEntries(NPCS.map((n) => [n.id, n])) as Record<string, NpcDef>;
