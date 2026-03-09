"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DungeonMap = void 0;
class DungeonMap {
    constructor(id, template, mapKey, mapId, mapInstanceId, now) {
        this.players = new Map();
        this.mobs = new Map();
        this.addMobRuntimeIds = new Set();
        this.state = 'ready_check';
        this.readyPurpose = 'open';
        this.ownerPartyId = null;
        this.mobsSpawned = false;
        this.locked = false;
        this.bossRuntimeId = null;
        this.bossMaxHp = 0;
        this.bossAggroRange = 260;
        this.nextShockwaveAt = 0;
        this.addsSummoned = false;
        this.cleanupAt = null;
        this.generatedFeatures = [];
        this.doorFeature = null;
        this.doorLocked = false;
        this.entrySpawn = null;
        this.readyCheckId = null;
        this.readyDeadlineAt = null;
        this.readyMemberIds = [];
        this.id = id;
        this.template = template;
        this.mapKey = mapKey;
        this.mapId = mapId;
        this.mapInstanceId = mapInstanceId;
        this.createdAt = now;
        this.nextShockwaveAt = now + Math.max(1000, Number(template.bossMechanics.shockwaveIntervalMs || 7000));
    }
    addPlayer(playerId, origin) {
        this.players.set(playerId, {
            playerId,
            origin,
            connected: true,
            responded: false,
            ready: false
        });
    }
    removePlayer(playerId) {
        this.players.delete(playerId);
    }
    setConnected(playerId, connected) {
        const state = this.players.get(playerId);
        if (!state)
            return;
        state.connected = connected;
    }
    markReady(playerId, ready) {
        const state = this.players.get(playerId);
        if (!state)
            return;
        state.responded = true;
        state.ready = ready;
    }
    allResponded() {
        if (this.players.size <= 0)
            return false;
        for (const state of this.players.values()) {
            if (!state.responded)
                return false;
        }
        return true;
    }
    getAcceptedMemberIds() {
        const out = [];
        for (const state of this.players.values()) {
            if (state.ready)
                out.push(state.playerId);
        }
        return out;
    }
    allReady() {
        if (this.players.size <= 0)
            return false;
        for (const state of this.players.values()) {
            if (!state.ready)
                return false;
        }
        return true;
    }
    getMemberIds() {
        return [...this.players.keys()];
    }
}
exports.DungeonMap = DungeonMap;
//# sourceMappingURL=DungeonMap.js.map