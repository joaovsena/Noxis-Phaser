import { Mob } from '../models/types';
import {
    DEFAULT_MOB,
    MOB_COUNTS,
    MOB_RESPAWN_MS,
    MOB_VARIANTS,
    WORLD,
    MAP_FEATURES_BY_KEY
} from '../config';
import { randomUUID } from 'crypto';
import { getMapMetadata } from '../maps/mapMetadata';
import { getMapTiledCollisionSampler } from '../maps/tiledCollision';
import { getStrategicMobSpawns, hasStrategicMobLayout } from '../maps/mapSpawns';

interface MobTemplateRuntime {
    kind: string;
    maxHp: number;
    size: number;
    color: string;
    xpReward: number;
    physicalDefense: number;
    magicDefense: number;
    aggroRange: number;
    leashRange: number;
    attackRange: number;
    attackCadenceMs: number;
    moveSpeed: number;
    wanderRadius: number;
    repathMs: number;
    idleMinMs: number;
    idleMaxMs: number;
    luckyStrikeChance: number;
    accuracy: number;
    evasion: number;
}

export class MobService {
    private mobs: Mob[] = [];
    private templateCache: Map<string, MobTemplateRuntime> = new Map();
    private mobById: Map<string, Mob> = new Map();
    private mobsByMapId: Map<string, Set<Mob>> = new Map();

    constructor() {
        this.loadTemplateCache([]);
    }

    loadTemplateCache(rawTemplates: Array<any>) {
        const byKind = new Map<string, any>();
        for (const template of rawTemplates || []) {
            if (!template || typeof template !== 'object') continue;
            const kind = String(template.kind || '').toLowerCase();
            if (!kind) continue;
            byKind.set(kind, template);
        }

        for (const [kind] of Object.entries(MOB_COUNTS)) {
            const variant = (MOB_VARIANTS as any)[kind] || MOB_VARIANTS.normal;
            const fromDb = byKind.get(kind) || {};
            const mult = Number.isFinite(Number(variant.mult)) ? Number(variant.mult) : 1;
            const template: MobTemplateRuntime = {
                kind,
                maxHp: this.pickNumber(fromDb.maxHp, Math.floor(DEFAULT_MOB.maxHp * mult)),
                size: this.pickNumber(fromDb.size, Number(variant.size) || DEFAULT_MOB.size),
                color: String(fromDb.color || variant.color || '#d63031'),
                xpReward: this.pickNumber(fromDb.xpReward, Math.floor(DEFAULT_MOB.xpReward * mult)),
                physicalDefense: this.pickNumber(fromDb.physicalDefense, Math.floor(DEFAULT_MOB.physicalDefense * mult)),
                magicDefense: this.pickNumber(fromDb.magicDefense, Math.floor(DEFAULT_MOB.magicDefense * mult)),
                aggroRange: this.pickNumber(fromDb.aggroRange, 260),
                leashRange: this.pickNumber(fromDb.leashRange, 420),
                attackRange: this.pickNumber(fromDb.attackRange, 64),
                attackCadenceMs: this.pickNumber(fromDb.attackCadenceMs, 1200),
                moveSpeed: this.pickNumber(fromDb.moveSpeed, kind === 'boss' ? 72 : kind === 'subboss' ? 82 : kind === 'elite' ? 95 : 108),
                wanderRadius: this.pickNumber(fromDb.wanderRadius, 180),
                repathMs: this.pickNumber(fromDb.repathMs, 500),
                idleMinMs: this.pickNumber(fromDb.idleMinMs, 350),
                idleMaxMs: this.pickNumber(fromDb.idleMaxMs, 1300),
                luckyStrikeChance: this.pickNumber(fromDb.luckyStrikeChance, kind === 'boss' ? 0.2 : kind === 'subboss' ? 0.14 : 0.08),
                accuracy: this.pickNumber(fromDb.accuracy, kind === 'boss' ? 90 : kind === 'subboss' ? 80 : kind === 'elite' ? 70 : 60),
                evasion: this.pickNumber(fromDb.evasion, kind === 'boss' ? 16 : kind === 'subboss' ? 11 : kind === 'elite' ? 8 : 5)
            };
            this.templateCache.set(kind, template);
        }
    }

    private pickNumber(value: any, fallback: number) {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : fallback;
    }

    private getTemplate(kind: string): MobTemplateRuntime {
        const key = String(kind || 'normal').toLowerCase();
        return this.templateCache.get(key) || this.templateCache.get('normal')!;
    }

    createMob(kind: string = 'normal', mapId: string, preferredSpawn?: { x: number; y: number }): Mob {
        const template = this.getTemplate(kind);
        const padding = 80;
        const spawn = this.findValidSpawnPoint(mapId, padding, preferredSpawn);
        const now = Date.now();
        return {
            id: `mob-${randomUUID()}`,
            x: spawn.x,
            y: spawn.y,
            kind: template.kind,
            color: template.color,
            size: Math.floor(template.size),
            hp: Math.floor(template.maxHp),
            maxHp: Math.floor(template.maxHp),
            physicalDefense: Math.floor(template.physicalDefense),
            magicDefense: Math.floor(template.magicDefense),
            xpReward: Math.floor(template.xpReward),
            mapId,
            state: 'idle',
            homeX: spawn.x,
            homeY: spawn.y,
            spawnX: spawn.x,
            spawnY: spawn.y,
            wanderTargetX: null,
            wanderTargetY: null,
            nextThinkAt: now + this.randomIdleDelay(template),
            nextAttackAt: 0,
            nextRepathAt: 0,
            ignoreDamage: false,
            hateTable: {},
            level: 1,
            targetPlayerId: null,
            lastAttackAt: 0
        };
    }

    createMobWithOverrides(
        kind: string,
        mapId: string,
        overrides: Partial<Mob> = {},
        options: { skipQuota?: boolean; useSpawnFinder?: boolean } = {}
    ): Mob | null {
        const safeKind = String(kind || 'normal').toLowerCase();
        if (!options.skipQuota) {
            const quota = MOB_COUNTS[safeKind as keyof typeof MOB_COUNTS] || 0;
            const current = this.mobs.filter((m) => m.kind === safeKind && m.mapId === mapId).length;
            if (current >= quota) return null;
        }
        const preferredSpawn = Number.isFinite(Number(overrides.x)) && Number.isFinite(Number(overrides.y))
            ? { x: Number(overrides.x), y: Number(overrides.y) }
            : undefined;
        const base = this.createMob(safeKind, mapId, preferredSpawn);
        const merged: Mob = {
            ...base,
            ...overrides,
            id: String(overrides.id || base.id),
            kind: String(overrides.kind || base.kind),
            mapId: String(overrides.mapId || mapId)
        };
        const safeSpawn = this.findValidSpawnPoint(
            mapId,
            80,
            Number.isFinite(Number(merged.spawnX)) && Number.isFinite(Number(merged.spawnY))
                ? { x: Number(merged.spawnX), y: Number(merged.spawnY) }
                : Number.isFinite(Number(merged.x)) && Number.isFinite(Number(merged.y))
                    ? { x: Number(merged.x), y: Number(merged.y) }
                    : undefined
        );
        const safeHome = this.findValidSpawnPoint(
            mapId,
            80,
            Number.isFinite(Number(merged.homeX)) && Number.isFinite(Number(merged.homeY))
                ? { x: Number(merged.homeX), y: Number(merged.homeY) }
                : safeSpawn
        );
        merged.x = safeSpawn.x;
        merged.y = safeSpawn.y;
        merged.spawnX = safeSpawn.x;
        merged.spawnY = safeSpawn.y;
        merged.homeX = safeHome.x;
        merged.homeY = safeHome.y;
        this.mobs.push(merged);
        this.indexMob(merged);
        return merged;
    }

    private randomIdleDelay(template: MobTemplateRuntime) {
        const min = Math.max(0, Math.floor(template.idleMinMs));
        const max = Math.max(min, Math.floor(template.idleMaxMs));
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    private findValidSpawnPoint(mapInstanceId: string, padding: number, preferredSpawn?: { x: number; y: number }) {
        const mapKey = String(mapInstanceId || '').split('::')[0] || 'forest';
        const mapWorld = getMapMetadata(mapKey)?.world || WORLD;
        const fallback = {
            x: padding + Math.random() * Math.max(1, mapWorld.width - padding * 2),
            y: padding + Math.random() * Math.max(1, mapWorld.height - padding * 2)
        };
        const tiledSampler = getMapTiledCollisionSampler(mapKey);
        const features = MAP_FEATURES_BY_KEY[mapKey] || [];
        const radius = 24;

        const isBlocked = (x: number, y: number) => {
            if (tiledSampler) return tiledSampler.isBlockedAt(x, y, radius);
            for (const feature of features) {
                if (!feature.collision) continue;
                if (feature.shape === 'rect') {
                    const insideX = x >= (feature.x - radius) && x <= (feature.x + feature.w + radius);
                    const insideY = y >= (feature.y - radius) && y <= (feature.y + feature.h + radius);
                    if (insideX && insideY) return true;
                    continue;
                }
                const dx = x - feature.x;
                const dy = y - feature.y;
                if (dx * dx + dy * dy <= (feature.r + radius) * (feature.r + radius)) return true;
            }
            return false;
        };

        if (preferredSpawn && Number.isFinite(Number(preferredSpawn.x)) && Number.isFinite(Number(preferredSpawn.y))) {
            const preferredX = Math.max(padding, Math.min(mapWorld.width - padding, Number(preferredSpawn.x)));
            const preferredY = Math.max(padding, Math.min(mapWorld.height - padding, Number(preferredSpawn.y)));
            if (!isBlocked(preferredX, preferredY)) return { x: preferredX, y: preferredY };
            for (let i = 0; i < 24; i++) {
                const angle = (Math.PI * 2 * i) / 24;
                const radius = 18 + i * 6;
                const x = Math.max(padding, Math.min(mapWorld.width - padding, preferredX + Math.cos(angle) * radius));
                const y = Math.max(padding, Math.min(mapWorld.height - padding, preferredY + Math.sin(angle) * radius));
                if (!isBlocked(x, y)) return { x, y };
            }
        }

        for (let i = 0; i < 120; i++) {
            const x = padding + Math.random() * Math.max(1, mapWorld.width - padding * 2);
            const y = padding + Math.random() * Math.max(1, mapWorld.height - padding * 2);
            if (!isBlocked(x, y)) return { x, y };
        }
        return fallback;
    }

    spawnMob(kind: string = 'normal', mapId: string, overrides: Partial<Mob> = {}, options: { skipQuota?: boolean } = {}): void {
        this.createMobWithOverrides(kind, mapId, overrides, options);
    }

    seedMapInstance(mapId: string) {
        const mapKey = String(mapId || '').split('::')[0] || 'forest';
        if (hasStrategicMobLayout(mapKey)) {
            const strategicSpawns = getStrategicMobSpawns(mapKey);
            for (const spawn of strategicSpawns) {
                this.spawnMob(spawn.kind, mapId, {
                    id: `mob-${String(mapId).replace(/[^a-z0-9_-]+/gi, '-')}-${spawn.id}`,
                    x: spawn.x,
                    y: spawn.y,
                    homeX: spawn.x,
                    homeY: spawn.y,
                    spawnX: spawn.x,
                    spawnY: spawn.y
                });
            }
            return;
        }
        for (const [kind, quota] of Object.entries(MOB_COUNTS)) {
            for (let i = 0; i < quota; i++) this.spawnMob(kind, mapId);
        }
    }

    removeMob(mobId: string, options: { skipRespawn?: boolean } = {}): void {
        const index = this.mobs.findIndex((m) => m.id === mobId);
        if (index === -1) return;
        const removed = this.mobs[index];
        const kind = removed.kind;
        const mapId = removed.mapId;
        const noRespawn = Boolean(removed.noRespawn);
        const respawnX = Number.isFinite(Number(removed.spawnX)) ? Number(removed.spawnX) : Number(removed.x);
        const respawnY = Number.isFinite(Number(removed.spawnY)) ? Number(removed.spawnY) : Number(removed.y);
        const respawnHomeX = Number.isFinite(Number(removed.homeX)) ? Number(removed.homeX) : respawnX;
        const respawnHomeY = Number.isFinite(Number(removed.homeY)) ? Number(removed.homeY) : respawnY;
        this.mobs.splice(index, 1);
        this.deindexMob(removed);
        if (options.skipRespawn || noRespawn) return;
        setTimeout(() => this.spawnMob(kind, mapId, {
            x: respawnX,
            y: respawnY,
            homeX: respawnHomeX,
            homeY: respawnHomeY,
            spawnX: respawnX,
            spawnY: respawnY
        }), MOB_RESPAWN_MS);
    }

    getMobs(): Mob[] {
        return this.mobs;
    }

    getMobById(mobId: string): Mob | null {
        return this.mobById.get(mobId) || null;
    }

    getMobsByMap(mapId: string): Mob[] {
        return Array.from(this.mobsByMapId.get(mapId) || []);
    }

    getMobByIdInMap(mobId: string, mapId: string): Mob | null {
        const mob = this.mobById.get(mobId);
        if (!mob || mob.mapId !== mapId) return null;
        return mob;
    }

    getTemplateByMob(mob: Mob): MobTemplateRuntime {
        return this.getTemplate(mob.kind);
    }

    addHate(mob: Mob, playerId: number, amount: number) {
        if (!mob.hateTable) mob.hateTable = {};
        const key = String(playerId);
        mob.hateTable[key] = Number(mob.hateTable[key] || 0) + Math.max(1, Number(amount || 1));
    }

    getTopHateTarget(mob: Mob): number | null {
        if (!mob.hateTable) return null;
        let best: string | null = null;
        let bestValue = -1;
        for (const [playerId, value] of Object.entries(mob.hateTable)) {
            const threat = Number(value || 0);
            if (threat > bestValue) {
                bestValue = threat;
                best = playerId;
            }
        }
        if (!best) return null;
        const parsed = Number(best);
        return Number.isInteger(parsed) ? parsed : null;
    }

    clearTarget(mob: Mob) {
        mob.targetPlayerId = null;
    }

    private indexMob(mob: Mob) {
        this.mobById.set(mob.id, mob);
        let bucket = this.mobsByMapId.get(mob.mapId);
        if (!bucket) {
            bucket = new Set<Mob>();
            this.mobsByMapId.set(mob.mapId, bucket);
        }
        bucket.add(mob);
    }

    private deindexMob(mob: Mob) {
        this.mobById.delete(mob.id);
        const bucket = this.mobsByMapId.get(mob.mapId);
        if (!bucket) return;
        bucket.delete(mob);
        if (bucket.size === 0) this.mobsByMapId.delete(mob.mapId);
    }
}
