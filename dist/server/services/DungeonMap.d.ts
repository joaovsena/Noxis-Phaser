import { MapFeature } from '../config';
import { DungeonMobSpawn, DungeonTemplate } from '../content/dungeons';
export type DungeonMemberState = {
    playerId: number;
    origin: {
        mapKey: string;
        mapId: string;
        x: number;
        y: number;
    };
    connected: boolean;
    responded: boolean;
    ready: boolean;
};
export declare class DungeonMap {
    readonly id: string;
    readonly template: DungeonTemplate;
    mapKey: string;
    mapId: string;
    mapInstanceId: string;
    readonly players: Map<number, DungeonMemberState>;
    readonly mobs: Map<string, DungeonMobSpawn & {
        runtimeId?: string;
    }>;
    readonly addMobRuntimeIds: Set<string>;
    state: 'ready_check' | 'open' | 'active' | 'completed';
    readyPurpose: 'open' | 'teleport';
    ownerPartyId: string | null;
    mobsSpawned: boolean;
    locked: boolean;
    bossRuntimeId: string | null;
    bossMaxHp: number;
    bossAggroRange: number;
    nextShockwaveAt: number;
    addsSummoned: boolean;
    cleanupAt: number | null;
    generatedFeatures: MapFeature[];
    doorFeature: MapFeature | null;
    doorLocked: boolean;
    entrySpawn: {
        x: number;
        y: number;
    } | null;
    readyCheckId: string | null;
    readyDeadlineAt: number | null;
    readyMemberIds: number[];
    createdAt: number;
    constructor(id: string, template: DungeonTemplate, mapKey: string, mapId: string, mapInstanceId: string, now: number);
    addPlayer(playerId: number, origin: DungeonMemberState['origin']): void;
    removePlayer(playerId: number): void;
    setConnected(playerId: number, connected: boolean): void;
    markReady(playerId: number, ready: boolean): void;
    allResponded(): boolean;
    getAcceptedMemberIds(): number[];
    allReady(): boolean;
    getMemberIds(): number[];
}
//# sourceMappingURL=DungeonMap.d.ts.map