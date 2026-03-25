"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventService = void 0;
const crypto_1 = require("crypto");
const EVENT_DEFS = [
    {
        id: 'event_forest_rift',
        name: 'Fenda da Floresta',
        mapKey: 'forest',
        mapId: 'Z1',
        centerX: 4440,
        centerY: 2760,
        durationMs: 3 * 60 * 1000,
        cooldownMs: 6 * 60 * 1000,
        startDelayMs: 75 * 1000,
        startText: 'Evento iniciado: Fenda da Floresta! Derrote os invasores.',
        endText: 'Evento encerrado: Fenda da Floresta se dissipou.',
        completionText: 'Evento concluido: todos os invasores foram derrotados!',
        spawns: [
            { kind: 'elite', count: 8, centerX: 4440, centerY: 2760, radius: 420 },
            { kind: 'subboss', count: 2, centerX: 4440, centerY: 2760, radius: 180 }
        ],
        lootTable: [
            { type: 'potion_hp', chance: 0.85 },
            { type: 'weapon', chance: 0.22 },
            { type: 'skill_reset_hourglass', chance: 0.08 }
        ]
    }
];
class EventService {
    constructor(mobService, broadcastMapInstance, getMapWorld, projectToWalkable) {
        this.mobService = mobService;
        this.broadcastMapInstance = broadcastMapInstance;
        this.getMapWorld = getMapWorld;
        this.projectToWalkable = projectToWalkable;
        this.activeByInstance = new Map();
        this.nextStartByEvent = new Map();
        const now = Date.now();
        for (const def of EVENT_DEFS) {
            this.nextStartByEvent.set(def.id, now + Math.max(1000, Number(def.startDelayMs || def.cooldownMs)));
        }
    }
    tick(now) {
        for (const def of EVENT_DEFS) {
            const instanceId = this.mapInstanceId(def.mapKey, def.mapId);
            const active = this.activeByInstance.get(instanceId);
            if (active && active.id === def.id) {
                this.syncActiveState(active, def, now);
                continue;
            }
            const nextStartAt = Number(this.nextStartByEvent.get(def.id) || 0);
            if (now < nextStartAt)
                continue;
            this.startEvent(def, now);
        }
    }
    getActiveEventsForMap(mapKey, mapId) {
        const instanceId = this.mapInstanceId(mapKey, mapId);
        const active = this.activeByInstance.get(instanceId);
        if (!active)
            return [];
        const def = EVENT_DEFS.find((entry) => entry.id === active.id && entry.mapKey === active.mapKey && entry.mapId === active.mapId);
        return [{
                id: active.id,
                name: active.name,
                mapKey: active.mapKey,
                mapId: active.mapId,
                x: Number(def?.centerX || 0),
                y: Number(def?.centerY || 0),
                startedAt: active.startedAt,
                endsAt: active.endsAt
            }];
    }
    syncActiveState(state, def, now) {
        const living = this.mobService.getMobsByMap(this.mapInstanceId(state.mapKey, state.mapId))
            .filter((mob) => String(mob.eventId || '') === state.id)
            .map((mob) => String(mob.id));
        state.mobIds = new Set(living);
        if (!living.length) {
            this.finishEvent(state, def, now, true);
            return;
        }
        if (now >= state.endsAt) {
            this.finishEvent(state, def, now, false);
        }
    }
    startEvent(def, now) {
        const instanceId = this.mapInstanceId(def.mapKey, def.mapId);
        if (this.activeByInstance.has(instanceId))
            return;
        const spawnedIds = [];
        const mapWorld = this.getMapWorld(def.mapKey);
        for (const spawn of def.spawns) {
            const count = Math.max(0, Math.floor(Number(spawn.count || 0)));
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const r = Math.random() * Math.max(1, Number(spawn.radius || 1));
                const tx = Number(spawn.centerX) + Math.cos(angle) * r;
                const ty = Number(spawn.centerY) + Math.sin(angle) * r;
                const projected = this.projectToWalkable(def.mapKey, Math.max(0, Math.min(mapWorld.width, tx)), Math.max(0, Math.min(mapWorld.height, ty)));
                const mob = this.mobService.createMobWithOverrides(spawn.kind, instanceId, {
                    id: `evt-${def.id}-${(0, crypto_1.randomUUID)()}`,
                    x: projected.x,
                    y: projected.y,
                    homeX: projected.x,
                    homeY: projected.y,
                    spawnX: projected.x,
                    spawnY: projected.y,
                    noRespawn: true,
                    eventId: def.id,
                    eventName: def.name,
                    eventLootTable: def.lootTable.map((it) => ({ type: it.type, chance: Number(it.chance || 0) }))
                }, { skipQuota: true });
                if (mob?.id)
                    spawnedIds.push(String(mob.id));
            }
        }
        const state = {
            id: def.id,
            name: def.name,
            mapKey: def.mapKey,
            mapId: def.mapId,
            startedAt: now,
            endsAt: now + Math.max(30000, Number(def.durationMs || 180000)),
            mobIds: new Set(spawnedIds)
        };
        this.activeByInstance.set(instanceId, state);
        this.broadcastMapInstance(def.mapKey, def.mapId, { type: 'system_message', text: def.startText });
        this.broadcastMapInstance(def.mapKey, def.mapId, {
            type: 'event.state',
            activeEvents: this.getActiveEventsForMap(def.mapKey, def.mapId)
        });
    }
    finishEvent(state, def, now, completed) {
        const instanceId = this.mapInstanceId(state.mapKey, state.mapId);
        const eventMobs = this.mobService.getMobsByMap(instanceId)
            .filter((mob) => String(mob.eventId || '') === state.id);
        for (const mob of eventMobs) {
            this.mobService.removeMob(String(mob.id), { skipRespawn: true });
        }
        this.activeByInstance.delete(instanceId);
        this.nextStartByEvent.set(def.id, now + Math.max(60000, Number(def.cooldownMs || 360000)));
        this.broadcastMapInstance(def.mapKey, def.mapId, {
            type: 'system_message',
            text: completed ? def.completionText : def.endText
        });
        this.broadcastMapInstance(def.mapKey, def.mapId, {
            type: 'event.state',
            activeEvents: []
        });
    }
    mapInstanceId(mapKey, mapId) {
        return `${mapKey}::${mapId}`;
    }
}
exports.EventService = EventService;
//# sourceMappingURL=EventService.js.map