import {
    MOB_AGGRO_RANGE,
    MOB_ATTACK_INTERVAL_MS,
    MOB_ATTACK_RANGE,
    MOB_LEASH_RANGE,
    PLAYER_HALF_SIZE,
    WORLD
} from '../config';
import { PlayerRuntime } from '../models/types';
import { clamp, distance } from '../utils/math';

type MapInstanceIdFn = (mapKey: string, mapId: string) => string;
type ProjectToWalkableFn = (mapKey: string, x: number, y: number) => { x: number; y: number };
type RecalcPathFn = (player: PlayerRuntime, destinationX: number, destinationY: number, now: number) => void;
type SkillAggregateFn = (player: PlayerRuntime, now: number) => any;
type ComputeHitChanceFn = (attackerAccuracy: number, defenderEvasion: number) => number;
type GetMobEvasionFn = (mob: any) => number;
type ComputeMobDamageFn = (player: PlayerRuntime, mob: any, multiplier: number, forceMagic: boolean, now: number) => number;
type ApplyDamageMobFn = (player: PlayerRuntime, mob: any, damage: number, now: number) => boolean;
type ApplyOnHitFn = (player: PlayerRuntime, dealtDamage: number, now: number) => number;
type SendStatsUpdatedFn = (player: PlayerRuntime) => void;
type BroadcastMobHitFn = (player: PlayerRuntime, mob: any) => void;
type SendRawFn = (ws: any, payload: any) => void;
type PersistPlayerFn = (player: PlayerRuntime) => void;
type SyncPartyFn = () => void;
type TryPlayerAttackFn = (player: PlayerRuntime, targetPlayerId: number, now: number, silent: boolean) => void;
type GetPvpPermissionFn = (player: PlayerRuntime, target: PlayerRuntime) => { ok: boolean; reason?: string };
type IsBlockedAtFn = (mapKey: string, x: number, y: number) => boolean;
type ComputeDamageAfterMitigationFn = (rawDamage: number, defense: number, targetLevel: number) => number;

const MOB_AI_CELL_SIZE = 512;
const MOB_DECISION_MS = 500;
const MOB_ATTACK_WINDUP_MS = 220;
const MOB_LEASH_REGEN_PER_SEC = 0.10;

export class CombatRuntimeService {
    constructor(
        private readonly players: Map<number, PlayerRuntime>,
        private readonly mobService: any,
        private readonly mobsPeacefulMode: () => boolean,
        private readonly mapInstanceId: MapInstanceIdFn,
        private readonly projectToWalkable: ProjectToWalkableFn,
        private readonly recalculatePathToward: RecalcPathFn,
        private readonly getActiveSkillEffectAggregate: SkillAggregateFn,
        private readonly computeHitChance: ComputeHitChanceFn,
        private readonly getMobEvasion: GetMobEvasionFn,
        private readonly computeMobDamage: ComputeMobDamageFn,
        private readonly applyDamageToMobAndHandleDeath: ApplyDamageMobFn,
        private readonly applyOnHitSkillEffects: ApplyOnHitFn,
        private readonly sendStatsUpdated: SendStatsUpdatedFn,
        private readonly broadcastMobHit: BroadcastMobHitFn,
        private readonly sendRaw: SendRawFn,
        private readonly persistPlayer: PersistPlayerFn,
        private readonly syncAllPartyStates: SyncPartyFn,
        private readonly tryPlayerAttack: TryPlayerAttackFn,
        private readonly getPvpAttackPermission: GetPvpPermissionFn,
        private readonly isBlockedAt: IsBlockedAtFn,
        private readonly computeDamageAfterMitigation: ComputeDamageAfterMitigationFn
    ) {}

    private hasLineOfSight(mapKey: string, fromX: number, fromY: number, toX: number, toY: number) {
        const dx = Number(toX || 0) - Number(fromX || 0);
        const dy = Number(toY || 0) - Number(fromY || 0);
        const distanceTotal = Math.sqrt(dx * dx + dy * dy);
        if (!Number.isFinite(distanceTotal) || distanceTotal <= 1) return true;
        const step = 18;
        const samples = Math.max(2, Math.ceil(distanceTotal / step));
        for (let i = 1; i < samples; i++) {
            const t = i / samples;
            const sampleX = Number(fromX || 0) + dx * t;
            const sampleY = Number(fromY || 0) + dy * t;
            if (this.isBlockedAt(mapKey, sampleX, sampleY)) return false;
        }
        return true;
    }

    processAutoAttack(player: PlayerRuntime, now: number) {
        if (!player.autoAttackActive || !player.attackTargetId) return;
        const mob = this.mobService.getMobs().find((m: any) => m.id === player.attackTargetId && m.mapId === this.mapInstanceId(player.mapKey, player.mapId));
        if (!mob) {
            player.autoAttackActive = false;
            player.attackTargetId = null;
            player.movePath = [];
            player.rawMovePath = [];
            player.pathDestinationX = player.x;
            player.pathDestinationY = player.y;
            return;
        }

        const currentDistance = distance(player, mob);
        const edgeDistance = currentDistance - (mob.size / 2 + PLAYER_HALF_SIZE);
        const attackRange = Number(player.stats?.attackRange || 60);
        const inRange = edgeDistance <= attackRange;
        const hasLos = this.hasLineOfSight(player.mapKey, player.x, player.y, mob.x, mob.y);
        if (!inRange || !hasLos) {
            const desiredDistance = mob.size / 2 + PLAYER_HALF_SIZE + Math.max(2, attackRange - 4);
            const dx = player.x - mob.x;
            const dy = player.y - mob.y;
            const norm = Math.sqrt(dx * dx + dy * dy) || 1;
            const projected = this.projectToWalkable(
                player.mapKey,
                clamp(mob.x + (dx / norm) * desiredDistance, 0, WORLD.width),
                clamp(mob.y + (dy / norm) * desiredDistance, 0, WORLD.height)
            );
            this.recalculatePathToward(player, projected.x, projected.y, now);
            return;
        }

        player.movePath = [];
        player.rawMovePath = [];
        player.targetX = player.x;
        player.targetY = player.y;
        player.pathDestinationX = player.x;
        player.pathDestinationY = player.y;

        const fx = this.getActiveSkillEffectAggregate(player, now);
        const rawAttackSpeed = Number(player.stats?.attackSpeed);
        const attackSpeedStat = Number.isFinite(rawAttackSpeed) && rawAttackSpeed > 0 ? rawAttackSpeed : 100;
        const boostedAttackSpeed = attackSpeedStat * Math.max(0.2, Number(fx.attackSpeedMul || 1));
        const attackIntervalMs = 1000 * (100 / boostedAttackSpeed);
        if (now - player.lastAttackAt < attackIntervalMs) return;
        player.lastAttackAt = now;

        const hitChance = this.computeHitChance(Number(player.stats?.accuracy || 0), this.getMobEvasion(mob));
        if (Math.random() > hitChance) {
            this.broadcastMobHit(player, mob);
            return;
        }
        const damage = this.computeMobDamage(player, mob, 1, false, now);
        this.applyDamageToMobAndHandleDeath(player, mob, damage, now);
        const healed = this.applyOnHitSkillEffects(player, damage, now);
        if (healed > 0) this.sendStatsUpdated(player);
        player.lastCombatAt = now;
        this.broadcastMobHit(player, mob);
    }

    processAutoAttackPlayer(player: PlayerRuntime, now: number) {
        if (!player.pvpAutoAttackActive || !player.attackTargetPlayerId) return;
        const target = this.players.get(player.attackTargetPlayerId);
        if (!target || target.dead || target.hp <= 0) {
            this.clearPvpTarget(player);
            return;
        }
        if (player.mapId !== target.mapId || player.mapKey !== target.mapKey) {
            this.clearPvpTarget(player);
            return;
        }
        const permission = this.getPvpAttackPermission(player, target);
        if (!permission.ok) {
            this.clearPvpTarget(player);
            return;
        }

        const currentDistance = distance(player, target);
        const edgeDistance = Math.max(0, currentDistance - PLAYER_HALF_SIZE * 2);
        const attackRange = Number(player.stats?.attackRange || 60);
        const hasLos = this.hasLineOfSight(player.mapKey, player.x, player.y, target.x, target.y);
        if (edgeDistance > attackRange || !hasLos) {
            const desiredDistance = PLAYER_HALF_SIZE * 2 + Math.max(2, attackRange - 4);
            const dx = player.x - target.x;
            const dy = player.y - target.y;
            const norm = Math.sqrt(dx * dx + dy * dy) || 1;
            const projected = this.projectToWalkable(
                player.mapKey,
                clamp(target.x + (dx / norm) * desiredDistance, 0, WORLD.width),
                clamp(target.y + (dy / norm) * desiredDistance, 0, WORLD.height)
            );
            this.recalculatePathToward(player, projected.x, projected.y, now);
            return;
        }
        player.movePath = [];
        player.rawMovePath = [];
        player.targetX = player.x;
        player.targetY = player.y;
        player.pathDestinationX = player.x;
        player.pathDestinationY = player.y;
        this.tryPlayerAttack(player, target.id, now, true);
    }

    processMobAggroAndCombat(deltaSeconds: number, now: number) {
        const mobs = this.mobService.getMobs();
        const playerIndex = this.buildPlayerSpatialIndex();
        if (this.mobsPeacefulMode()) {
            for (const mob of mobs) {
                mob.targetPlayerId = null;
                mob.lastAttackAt = 0;
                mob.state = 'idle';
                mob.ignoreDamage = false;
            }
            return;
        }

        for (const mob of mobs) {
            const template = this.mobService.getTemplateByMob(mob);
            const [mapKey, mapId] = String(mob.mapId || '').split('::');
            if (!mapKey || !mapId) continue;
            if (!Number.isFinite(Number(mob.homeX))) mob.homeX = Number(mob.x || 0);
            if (!Number.isFinite(Number(mob.homeY))) mob.homeY = Number(mob.y || 0);
            if (!mob.state) mob.state = 'idle';
            if (!mob.hateTable) mob.hateTable = {};
            const home = { x: Number(mob.homeX || mob.x), y: Number(mob.homeY || mob.y) };
            const distanceToHome = distance(mob, home);
            const leashRange = Number(template.leashRange || MOB_LEASH_RANGE);

            if (mob.state === 'leash_return' || distanceToHome > leashRange) {
                mob.state = 'leash_return';
                mob.ignoreDamage = true;
                mob.targetPlayerId = null;
                mob.hateTable = {};
                const regen = Number(mob.maxHp || 1) * MOB_LEASH_REGEN_PER_SEC * deltaSeconds;
                mob.hp = Math.min(Number(mob.maxHp || 1), Number(mob.hp || 0) + regen);
                const arrived = this.moveMobToward(mob, home.x, home.y, Number(template.moveSpeed) * 2, deltaSeconds, mapKey);
                if (arrived || distance(mob, home) <= 8) {
                    mob.x = home.x;
                    mob.y = home.y;
                    mob.state = 'idle';
                    mob.ignoreDamage = false;
                    mob.nextThinkAt = now + this.randomInt(Number(template.idleMinMs), Number(template.idleMaxMs));
                }
                continue;
            }

            mob.ignoreDamage = false;
            let target = mob.targetPlayerId ? this.players.get(Number(mob.targetPlayerId)) : null;
            if (!target || target.dead || target.hp <= 0 || target.mapKey !== mapKey || target.mapId !== mapId) {
                target = null;
                const hateTargetId = this.mobService.getTopHateTarget(mob);
                if (hateTargetId) {
                    const hated = this.players.get(hateTargetId);
                    if (hated && !hated.dead && hated.hp > 0 && hated.mapKey === mapKey && hated.mapId === mapId) {
                        target = hated;
                        mob.targetPlayerId = hated.id;
                    }
                }
            }

            const canThink = now >= Number(mob.nextThinkAt || 0);
            if (!target && canThink) {
                const candidates = this.getPlayersNearCell(playerIndex, mapKey, mapId, mob.x, mob.y);
                let nearest: PlayerRuntime | null = null;
                let nearestDist = Number.POSITIVE_INFINITY;
                for (const p of candidates) {
                    const d = distance(mob, p);
                    if (d > Number(template.aggroRange || MOB_AGGRO_RANGE)) continue;
                    if (d < nearestDist) {
                        nearestDist = d;
                        nearest = p;
                    }
                }
                if (nearest) {
                    target = nearest;
                    mob.targetPlayerId = nearest.id;
                    mob.state = 'aggro';
                    mob.nextRepathAt = now + MOB_DECISION_MS;
                } else {
                    if (mob.state !== 'wander') {
                        const wander = this.pickWanderTarget(home.x, home.y, template.wanderRadius);
                        mob.wanderTargetX = wander.x;
                        mob.wanderTargetY = wander.y;
                        mob.state = 'wander';
                    } else {
                        mob.state = 'idle';
                    }
                    mob.nextThinkAt = now + this.randomInt(Number(template.idleMinMs), Number(template.idleMaxMs));
                }
            }

            if (!target) {
                if (mob.state === 'wander' && Number.isFinite(Number(mob.wanderTargetX)) && Number.isFinite(Number(mob.wanderTargetY))) {
                    const arrived = this.moveMobToward(mob, Number(mob.wanderTargetX), Number(mob.wanderTargetY), Number(template.moveSpeed) * 0.55, deltaSeconds, mapKey);
                    if (arrived) {
                        mob.state = 'idle';
                        mob.nextThinkAt = now + this.randomInt(Number(template.idleMinMs), Number(template.idleMaxMs));
                        mob.wanderTargetX = null;
                        mob.wanderTargetY = null;
                    }
                }
                continue;
            }

            const centerDistance = distance(mob, target);
            if (centerDistance > leashRange) {
                mob.state = 'leash_return';
                continue;
            }

            const edgeDistance = Math.max(0, centerDistance - (mob.size / 2 + PLAYER_HALF_SIZE));
            const attackRange = Number(template.attackRange || MOB_ATTACK_RANGE);
            if (edgeDistance > attackRange) {
                mob.state = 'aggro';
                if (now >= Number(mob.nextRepathAt || 0)) mob.nextRepathAt = now + Number(template.repathMs || MOB_DECISION_MS);
                this.moveMobToward(mob, target.x, target.y, Number(template.moveSpeed), deltaSeconds, mapKey);
                continue;
            }

            if (now < Number(mob.nextAttackAt || 0)) continue;
            if (mob.state !== 'attack_windup') {
                mob.state = 'attack_windup';
                mob.nextAttackAt = now + MOB_ATTACK_WINDUP_MS;
                continue;
            }
            mob.state = 'aggro';
            mob.lastAttackAt = now;
            mob.nextAttackAt = now + Number(template.attackCadenceMs || MOB_ATTACK_INTERVAL_MS);

            const baseDamage = mob.kind === 'boss' ? 34 : mob.kind === 'subboss' ? 21 : mob.kind === 'elite' ? 14 : 8;
            const targetFx = this.getActiveSkillEffectAggregate(target, now);
            const hitChance = this.computeHitChance(Number(template.accuracy || 60), Number(target.stats?.evasion || 0) + Number(targetFx.evasionAdd || 0));
            if (Math.random() > hitChance) continue;
            const defense = Number(target.stats?.physicalDefense || 0) * Math.max(0.1, Number(targetFx.defenseMul || 1));
            const luckyBypass = Math.random() < Number(template.luckyStrikeChance || 0);
            const effectiveDefense = luckyBypass ? defense * 0.5 : defense;
            let damage = this.computeDamageAfterMitigation(baseDamage, effectiveDefense, Number(target.level || 1));
            damage = Math.max(1, Math.floor(damage * (1 - Math.max(0, Math.min(0.95, Number(targetFx.damageReduction || 0))))));
            target.hp = Math.max(0, target.hp - damage);
            target.lastCombatAt = now;
            if (target.hp <= 0) {
                target.dead = true;
                target.deathX = target.x;
                target.deathY = target.y;
                target.autoAttackActive = false;
                target.attackTargetId = null;
                target.pvpAutoAttackActive = false;
                target.attackTargetPlayerId = null;
                this.sendRaw(target.ws, { type: 'player.dead' });
            }
            const reflect = Math.max(0, Math.min(0.5, Number(targetFx.reflect || 0)));
            if (reflect > 0 && Number(mob.hp || 0) > 0) {
                const reflected = Math.max(1, Math.floor(damage * reflect));
                mob.hp = Math.max(0, Number(mob.hp || 0) - reflected);
                if (mob.hp <= 0) this.applyDamageToMobAndHandleDeath(target, mob, reflected, now);
            }
            this.persistPlayer(target);
            this.syncAllPartyStates();

            for (const receiver of this.players.values()) {
                if (receiver.mapKey !== mapKey || receiver.mapId !== mapId) continue;
                this.sendRaw(receiver.ws, {
                    type: 'combat.mobHitPlayer',
                    mobId: mob.id,
                    mobX: mob.x,
                    mobY: mob.y,
                    targetPlayerId: target.id,
                    targetX: target.x,
                    targetY: target.y,
                    damage,
                    luckyStrike: luckyBypass,
                    targetHp: target.hp,
                    targetMaxHp: target.maxHp
                });
            }
        }
    }

    private clearPvpTarget(player: PlayerRuntime) {
        player.pvpAutoAttackActive = false;
        player.attackTargetPlayerId = null;
        player.movePath = [];
        player.rawMovePath = [];
        player.pathDestinationX = player.x;
        player.pathDestinationY = player.y;
    }

    private cellKey(x: number, y: number, mapKey: string, mapId: string) {
        const cx = Math.floor(Number(x || 0) / MOB_AI_CELL_SIZE);
        const cy = Math.floor(Number(y || 0) / MOB_AI_CELL_SIZE);
        return `${mapKey}::${mapId}::${cx},${cy}`;
    }

    private buildPlayerSpatialIndex() {
        const index = new Map<string, PlayerRuntime[]>();
        for (const player of this.players.values()) {
            if (player.dead || player.hp <= 0) continue;
            const key = this.cellKey(player.x, player.y, player.mapKey, player.mapId);
            const bucket = index.get(key);
            if (bucket) bucket.push(player);
            else index.set(key, [player]);
        }
        return index;
    }

    private getPlayersNearCell(index: Map<string, PlayerRuntime[]>, mapKey: string, mapId: string, x: number, y: number) {
        const baseCx = Math.floor(Number(x || 0) / MOB_AI_CELL_SIZE);
        const baseCy = Math.floor(Number(y || 0) / MOB_AI_CELL_SIZE);
        const out: PlayerRuntime[] = [];
        for (let oy = -1; oy <= 1; oy++) {
            for (let ox = -1; ox <= 1; ox++) {
                const key = `${mapKey}::${mapId}::${baseCx + ox},${baseCy + oy}`;
                const bucket = index.get(key);
                if (!bucket || !bucket.length) continue;
                for (const player of bucket) out.push(player);
            }
        }
        return out;
    }

    private randomInt(min: number, max: number) {
        const safeMin = Math.floor(Math.max(0, Number(min || 0)));
        const safeMax = Math.floor(Math.max(safeMin, Number(max || safeMin)));
        return safeMin + Math.floor(Math.random() * (safeMax - safeMin + 1));
    }

    private pickWanderTarget(homeX: number, homeY: number, radius: number) {
        const r = Math.max(24, Number(radius || 120));
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * r;
        return {
            x: clamp(homeX + Math.cos(angle) * dist, 0, WORLD.width),
            y: clamp(homeY + Math.sin(angle) * dist, 0, WORLD.height)
        };
    }

    private moveMobToward(mob: any, targetX: number, targetY: number, speed: number, deltaSeconds: number, mapKey: string) {
        const dx = Number(targetX || 0) - Number(mob.x || 0);
        const dy = Number(targetY || 0) - Number(mob.y || 0);
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= 0.001) return true;
        const step = Math.max(0, Number(speed || 0)) * Math.max(0, Number(deltaSeconds || 0));
        if (step <= 0.0001) return false;
        const nx = clamp(Number(mob.x || 0) + (dx / dist) * Math.min(step, dist), 0, WORLD.width);
        const ny = clamp(Number(mob.y || 0) + (dy / dist) * Math.min(step, dist), 0, WORLD.height);
        if (!this.isBlockedAt(mapKey, nx, ny)) {
            mob.x = nx;
            mob.y = ny;
        } else {
            const axisX = clamp(Number(mob.x || 0) + (dx / dist) * Math.min(step, dist), 0, WORLD.width);
            const axisY = clamp(Number(mob.y || 0) + (dy / dist) * Math.min(step, dist), 0, WORLD.height);
            if (!this.isBlockedAt(mapKey, axisX, Number(mob.y || 0))) mob.x = axisX;
            else if (!this.isBlockedAt(mapKey, Number(mob.x || 0), axisY)) mob.y = axisY;
            else return false;
        }
        return Math.abs(Number(targetX || 0) - Number(mob.x || 0)) < 2 && Math.abs(Number(targetY || 0) - Number(mob.y || 0)) < 2;
    }
}
