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
    hitbox?: {
        w: number;
        h: number;
        offsetX?: number;
        offsetY?: number;
    };
    anchor?: {
        x: number;
        y: number;
    };
    interactRange?: number;
    spriteKey?: string | null;
    dungeonTemplateId?: string | null;
};
export declare const NPC_INTERACT_RANGE = 170;
export declare const QUEST_NPCS: NpcDef[];
export declare const SHOP_NPCS: NpcDef[];
export declare const CHEST_NPCS: NpcDef[];
export declare const AMBIENT_NPCS: NpcDef[];
export declare const NPCS: NpcDef[];
export declare const NPC_BY_ID: Record<string, NpcDef>;
//# sourceMappingURL=npcs.d.ts.map