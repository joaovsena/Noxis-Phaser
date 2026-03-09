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

export class DungeonMap {
    readonly id: string;
    readonly template: DungeonTemplate;
    mapKey: string;
    mapId: string;
    mapInstanceId: string;
    readonly players: Map<number, DungeonMemberState> = new Map();
    readonly mobs: Map<string, DungeonMobSpawn & { runtimeId?: string }> = new Map();
    readonly addMobRuntimeIds: Set<string> = new Set();

    state: 'ready_check' | 'open' | 'active' | 'completed' = 'ready_check';
    readyPurpose: 'open' | 'teleport' = 'open';
    ownerPartyId: string | null = null;
    mobsSpawned = false;
    locked = false;
    bossRuntimeId: string | null = null;
    bossMaxHp = 0;
    bossAggroRange = 260;
    nextShockwaveAt = 0;
    addsSummoned = false;
    cleanupAt: number | null = null;
    generatedFeatures: MapFeature[] = [];
    doorFeature: MapFeature | null = null;
    doorLocked = false;
    entrySpawn: { x: number; y: number } | null = null;
    readyCheckId: string | null = null;
    readyDeadlineAt: number | null = null;
    readyMemberIds: number[] = [];
    createdAt: number;

    constructor(id: string, template: DungeonTemplate, mapKey: string, mapId: string, mapInstanceId: string, now: number) {
        this.id = id;
        this.template = template;
        this.mapKey = mapKey;
        this.mapId = mapId;
        this.mapInstanceId = mapInstanceId;
        this.createdAt = now;
        this.nextShockwaveAt = now + Math.max(1000, Number(template.bossMechanics.shockwaveIntervalMs || 7000));
    }

    addPlayer(playerId: number, origin: DungeonMemberState['origin']) {
        this.players.set(playerId, {
            playerId,
            origin,
            connected: true,
            responded: false,
            ready: false
        });
    }

    removePlayer(playerId: number) {
        this.players.delete(playerId);
    }

    setConnected(playerId: number, connected: boolean) {
        const state = this.players.get(playerId);
        if (!state) return;
        state.connected = connected;
    }

    markReady(playerId: number, ready: boolean) {
        const state = this.players.get(playerId);
        if (!state) return;
        state.responded = true;
        state.ready = ready;
    }

    allResponded() {
        if (this.players.size <= 0) return false;
        for (const state of this.players.values()) {
            if (!state.responded) return false;
        }
        return true;
    }

    getAcceptedMemberIds() {
        const out: number[] = [];
        for (const state of this.players.values()) {
            if (state.ready) out.push(state.playerId);
        }
        return out;
    }

    allReady() {
        if (this.players.size <= 0) return false;
        for (const state of this.players.values()) {
            if (!state.ready) return false;
        }
        return true;
    }

    getMemberIds() {
        return [...this.players.keys()];
    }
}
