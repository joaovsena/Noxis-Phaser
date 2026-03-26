"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillService = void 0;
const config_1 = require("../config");
const math_1 = require("../utils/math");
class SkillService {
    constructor(skillDefs, sendRaw, normalizeClassId, getSkillLevel, pruneExpiredSkillEffects, applyTimedSkillEffect, sendSkillEffect, computeMobDamage, applyDamageToMobAndHandleDeath, broadcastMobHit, applyOnHitSkillEffects, hasActiveSkillEffect, removeSkillEffectById, getSkillPowerWithLevel, sendStatsUpdated, mapInstanceId, getMobByIdInMap, getMobsByMap, assignPathTo, getSkillPrerequisite, getSkillRequiredLevel, normalizeSkillLevels, getAvailableSkillPoints, recomputePlayerStats, persistPlayer, getPlayerById, raiseDead, commandDead, legionCall, armyOfShadows, getActiveSummonCount) {
        this.skillDefs = skillDefs;
        this.sendRaw = sendRaw;
        this.normalizeClassId = normalizeClassId;
        this.getSkillLevel = getSkillLevel;
        this.pruneExpiredSkillEffects = pruneExpiredSkillEffects;
        this.applyTimedSkillEffect = applyTimedSkillEffect;
        this.sendSkillEffect = sendSkillEffect;
        this.computeMobDamage = computeMobDamage;
        this.applyDamageToMobAndHandleDeath = applyDamageToMobAndHandleDeath;
        this.broadcastMobHit = broadcastMobHit;
        this.applyOnHitSkillEffects = applyOnHitSkillEffects;
        this.hasActiveSkillEffect = hasActiveSkillEffect;
        this.removeSkillEffectById = removeSkillEffectById;
        this.getSkillPowerWithLevel = getSkillPowerWithLevel;
        this.sendStatsUpdated = sendStatsUpdated;
        this.mapInstanceId = mapInstanceId;
        this.getMobByIdInMap = getMobByIdInMap;
        this.getMobsByMap = getMobsByMap;
        this.assignPathTo = assignPathTo;
        this.getSkillPrerequisite = getSkillPrerequisite;
        this.getSkillRequiredLevel = getSkillRequiredLevel;
        this.normalizeSkillLevels = normalizeSkillLevels;
        this.getAvailableSkillPoints = getAvailableSkillPoints;
        this.recomputePlayerStats = recomputePlayerStats;
        this.persistPlayer = persistPlayer;
        this.getPlayerById = getPlayerById;
        this.raiseDead = raiseDead;
        this.commandDead = commandDead;
        this.legionCall = legionCall;
        this.armyOfShadows = armyOfShadows;
        this.getActiveSummonCount = getActiveSummonCount;
        this.mobDotTokens = new Map();
    }
    processPendingSkillCast(player, now) {
        const pending = player.pendingSkillCast;
        if (!pending || typeof pending !== 'object')
            return;
        const issuedAt = Number(pending.issuedAt || 0);
        if (!Number.isFinite(issuedAt) || now - issuedAt > 7000) {
            player.pendingSkillCast = null;
            return;
        }
        const nextAttemptAt = Number(pending.nextAttemptAt || 0);
        if (now < nextAttemptAt)
            return;
        pending.nextAttemptAt = now + 150;
        this.handleSkillCast(player, {
            skillId: pending.skillId,
            targetMobId: pending.targetMobId || null,
            targetPlayerId: pending.targetPlayerId || null,
            targetX: pending.targetX ?? null,
            targetY: pending.targetY ?? null,
            __autoRetry: true
        });
    }
    handleSkillCast(player, msg) {
        if (player.dead || player.hp <= 0)
            return;
        const isAutoRetry = Boolean(msg?.__autoRetry);
        const skillId = String(msg?.skillId || '');
        const skill = this.skillDefs[skillId];
        if (!skill)
            return;
        const skillLevel = skillId === 'class_primary' || skillId === 'mod_fire_wing' ? 1 : this.getSkillLevel(player, skillId);
        if (skillId !== 'class_primary' && skillId !== 'mod_fire_wing' && skillLevel <= 0) {
            if (!isAutoRetry)
                this.sendRaw(player.ws, { type: 'system_message', text: 'Habilidade nao aprendida.' });
            return;
        }
        const now = Date.now();
        player.skillCooldowns = player.skillCooldowns || {};
        const classId = this.normalizeClassId(player.class);
        const normalizedClass = classId === 'bandit' ? 'assassin' : classId === 'shifter' ? 'druid' : classId;
        const classMismatch = skill.id !== 'class_primary'
            && skill.id !== 'mod_fire_wing'
            && normalizedClass !== skill.classId;
        if (classMismatch) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Essa habilidade nao pertence a sua classe.' });
            return;
        }
        this.pruneExpiredSkillEffects(player, now);
        const cooldownMs = Math.max(400, Number(skill.cooldownMs || 2000));
        const nextAt = Number(player.skillCooldowns[skillId] || 0);
        if (now < nextAt) {
            if (!isAutoRetry)
                this.sendRaw(player.ws, { type: 'system_message', text: `Habilidade em recarga (${Math.ceil((nextAt - now) / 1000)}s).` });
            return;
        }
        const context = this.resolveCastContext(player, msg, skillId, skill, skillLevel, now, isAutoRetry);
        if (!context)
            return;
        if (skill.hpCostPct && skill.hpCostPct > 0) {
            const hpCost = Math.max(1, Math.floor(Number(player.maxHp || 1) * Number(skill.hpCostPct)));
            if (player.hp <= hpCost) {
                this.sendRaw(player.ws, { type: 'system_message', text: 'HP insuficiente para usar esta habilidade.' });
                return;
            }
            player.hp = Math.max(1, player.hp - hpCost);
        }
        if (skill.id === 'nec_grave_raise_dead' && !this.raiseDead(player, skillLevel, now))
            return;
        if (skill.id === 'nec_grave_harvest') {
            player.graveHarvestBonusUntil = now + 2400;
        }
        player.skillCooldowns[skillId] = now + cooldownMs;
        if (skill.healVitScale && skill.healVitScale > 0) {
            const vit = Number(player.stats?.vit || 0);
            const healScale = Math.max(0.1, Number(skill.healVitScale || 0) + Number(skill.healVitScaleStep || 0) * Math.max(0, skillLevel - 1));
            const heal = Math.max(10, Math.floor(vit * healScale + Number(player.maxHp || 0) * (0.08 + (skillLevel - 1) * 0.01)));
            player.hp = Math.min(Number(player.maxHp || player.hp), Number(player.hp || 0) + heal);
            this.sendSkillEffect(player.mapKey, player.mapId, {
                sourceId: player.id,
                targetId: player.id,
                x: player.x,
                y: player.y,
                effectKey: skill.effectKey || skill.id
            });
        }
        if (skill.buff) {
            const buff = this.scaleBuffForLevel(skill.buff, skill.buffStep || null, skillLevel);
            if (skill.id === 'nec_grave_bone_ward') {
                const summonCount = this.getActiveSummonCount(player);
                buff.defenseMul = Number(buff.defenseMul || 1) + Math.min(0.18, summonCount * 0.02);
                buff.magicDefenseMul = Number(buff.magicDefenseMul || 1) + Math.min(0.22, summonCount * 0.025);
                buff.damageReduction = Number(buff.damageReduction || 0) + Math.min(0.12, summonCount * 0.01);
            }
            this.applyTimedSkillEffect(player, buff, now);
            this.sendSkillEffect(player.mapKey, player.mapId, {
                sourceId: player.id,
                targetId: player.id,
                x: player.x,
                y: player.y,
                effectKey: skill.effectKey || skill.id
            });
        }
        if (skill.id === 'nec_grave_legion_call') {
            this.legionCall(player, skillLevel, now);
            this.sendSkillEffect(player.mapKey, player.mapId, {
                sourceId: player.id,
                targetId: player.id,
                x: player.x,
                y: player.y,
                effectKey: skill.effectKey || skill.id
            });
            this.sendStatsUpdated(player);
            return;
        }
        if (skill.id === 'nec_bone_army_of_shadows') {
            this.armyOfShadows(player, skillLevel, now);
            this.sendSkillEffect(player.mapKey, player.mapId, {
                sourceId: player.id,
                targetId: player.id,
                x: player.x,
                y: player.y,
                effectKey: skill.effectKey || skill.id
            });
            this.sendStatsUpdated(player);
            return;
        }
        if (context.castMode === 'summon') {
            this.sendSkillEffect(player.mapKey, player.mapId, {
                sourceId: player.id,
                targetId: player.id,
                x: player.x,
                y: player.y,
                effectKey: skill.effectKey || skill.id
            });
            this.sendStatsUpdated(player);
            return;
        }
        const basePower = Math.max(0.05, this.getSkillPowerWithLevel(skill, skillLevel));
        const hpLostRatio = Number(player.maxHp || 1) > 0
            ? Math.max(0, Math.min(1, (Number(player.maxHp || 1) - Number(player.hp || 0)) / Number(player.maxHp || 1)))
            : 0;
        const scaledPower = skill.lostHpScale
            ? basePower * (1 + hpLostRatio * (Number(skill.lostHpScale || 0) + Number(skill.lostHpScaleStep || 0) * Math.max(0, skillLevel - 1)))
            : basePower;
        const targets = this.resolveTargetsForCast(player, context);
        let totalDamage = 0;
        let directPrimaryTarget = null;
        for (const mob of targets) {
            let damage = this.computeMobDamage(player, mob, scaledPower, Boolean(skill.magic), now);
            if (skill.id === 'ass_letal_emboscada' && this.hasActiveSkillEffect(player, 'ocultar', now)) {
                damage = Math.max(1, Math.floor(damage * 1.45));
                this.removeSkillEffectById(player, 'ocultar');
            }
            this.applyDamageToMobAndHandleDeath(player, mob, damage, now);
            this.broadcastMobHit(player, mob);
            this.applyOnHitSkillEffects(player, damage, now);
            totalDamage += Math.max(0, damage);
            if (!directPrimaryTarget)
                directPrimaryTarget = mob;
        }
        if (context.castMode === 'direct' && context.targetMob && directPrimaryTarget) {
            if (skill.id === 'arc_franco_ponteira_envenenada' && Number(context.targetMob.hp || 0) > 0) {
                this.applyMobDamageOverTime(player, context.targetMob, context.mapInstanceId, {
                    dotKey: 'arc_poison',
                    ticks: 4,
                    intervalMs: 1000,
                    damagePerTick: Math.max(1, Math.floor(totalDamage * 0.24)),
                    effectKey: 'arc_poison_tick'
                });
            }
            if (skill.id === 'ass_letal_sentenca') {
                const delayedDamage = Math.max(1, Math.floor(totalDamage * 0.75));
                setTimeout(() => {
                    const livePlayer = this.getPlayerById(player.id);
                    if (!livePlayer || livePlayer.dead || livePlayer.mapKey !== player.mapKey || livePlayer.mapId !== player.mapId)
                        return;
                    const liveMob = this.getMobByIdInMap(String(context.targetMob?.id), context.mapInstanceId);
                    if (!liveMob || liveMob.hp <= 0)
                        return;
                    this.applyDamageToMobAndHandleDeath(livePlayer, liveMob, delayedDamage, Date.now());
                    this.broadcastMobHit(livePlayer, liveMob);
                    this.sendSkillEffect(livePlayer.mapKey, livePlayer.mapId, {
                        sourceId: livePlayer.id,
                        targetId: liveMob.id,
                        x: liveMob.x,
                        y: liveMob.y,
                        effectKey: 'ass_sentence_drop'
                    });
                }, 3000);
            }
            if (skill.id === 'nec_grave_command_dead') {
                this.commandDead(player, String(context.targetMob?.id || ''), skillLevel, now);
            }
            if (skill.id === 'nec_bone_soul_leech' && totalDamage > 0) {
                const heal = Math.max(8, Math.round(totalDamage * (0.18 + (skillLevel - 1) * 0.03)));
                player.hp = Math.min(Number(player.maxHp || 1), Number(player.hp || 0) + heal);
            }
        }
        const effectPoint = context.targetPoint || (context.targetMob ? { x: context.targetMob.x, y: context.targetMob.y } : { x: player.x, y: player.y });
        this.sendSkillEffect(player.mapKey, player.mapId, {
            sourceId: player.id,
            targetId: context.targetMob?.id || player.id,
            x: Number(effectPoint.x || player.x || 0),
            y: Number(effectPoint.y || player.y || 0),
            effectKey: skill.effectKey || skill.id
        });
        if (context.targetMob && Number(context.targetMob.hp || 0) > 0) {
            player.pvpAutoAttackActive = false;
            player.attackTargetPlayerId = null;
            player.autoAttackActive = true;
            player.attackTargetId = String(context.targetMob.id);
        }
        player.lastCombatAt = now;
        this.sendStatsUpdated(player);
    }
    resolveCastContext(player, msg, skillId, skill, skillLevel, now, isAutoRetry) {
        const castMode = skill.castMode || 'direct';
        const mapInstanceId = this.mapInstanceId(player.mapKey, player.mapId);
        const range = Number(skill.range || 100) + Number(skill.rangeStep || 0) * Math.max(0, skillLevel - 1);
        const targetMobId = String(msg?.targetMobId || player.attackTargetId || '');
        const targetMob = targetMobId ? this.getMobByIdInMap(targetMobId, mapInstanceId) : null;
        const hasTargetPoint = Number.isFinite(Number(msg?.targetX)) && Number.isFinite(Number(msg?.targetY));
        const pointFromMsg = hasTargetPoint ? { x: Number(msg.targetX), y: Number(msg.targetY) } : null;
        if (castMode === 'direct') {
            if (skill.target !== 'mob' || !targetMob) {
                player.pendingSkillCast = null;
                if (!isAutoRetry)
                    this.sendRaw(player.ws, { type: 'system_message', text: 'Selecione um alvo para usar a habilidade.' });
                return null;
            }
            const currentDistance = (0, math_1.distance)(player, targetMob);
            const edgeDistance = currentDistance - (Number(targetMob.size || 0) / 2 + config_1.PLAYER_HALF_SIZE);
            if (edgeDistance > range) {
                player.pendingSkillCast = {
                    skillId,
                    targetMobId: targetMob.id,
                    targetPlayerId: null,
                    targetX: null,
                    targetY: null,
                    issuedAt: Number(player.pendingSkillCast?.issuedAt || now),
                    nextAttemptAt: now + 150
                };
                player.pvpAutoAttackActive = false;
                player.attackTargetPlayerId = null;
                player.autoAttackActive = true;
                player.attackTargetId = targetMob.id;
                this.assignPathTo(player, Number(targetMob.x), Number(targetMob.y));
                return null;
            }
            player.pendingSkillCast = null;
            return {
                now,
                isAutoRetry,
                skillId,
                skill,
                skillLevel,
                castMode,
                mapInstanceId,
                targetMob,
                targetPoint: { x: Number(targetMob.x || 0), y: Number(targetMob.y || 0) }
            };
        }
        if (castMode === 'self_aoe' || castMode === 'summon') {
            player.pendingSkillCast = null;
            return {
                now,
                isAutoRetry,
                skillId,
                skill,
                skillLevel,
                castMode,
                mapInstanceId,
                targetMob: null,
                targetPoint: { x: Number(player.x || 0), y: Number(player.y || 0) }
            };
        }
        if (skill.target === 'self') {
            player.pendingSkillCast = null;
            return {
                now,
                isAutoRetry,
                skillId,
                skill,
                skillLevel,
                castMode,
                mapInstanceId,
                targetMob: null,
                targetPoint: { x: Number(player.x || 0), y: Number(player.y || 0) }
            };
        }
        const targetPoint = pointFromMsg || (targetMob ? { x: Number(targetMob.x || 0), y: Number(targetMob.y || 0) } : null);
        if (!targetPoint) {
            player.pendingSkillCast = null;
            if (!isAutoRetry)
                this.sendRaw(player.ws, { type: 'system_message', text: 'Escolha um ponto para usar a habilidade.' });
            return null;
        }
        if ((0, math_1.distance)(player, targetPoint) > range) {
            player.pendingSkillCast = {
                skillId,
                targetMobId: targetMob ? String(targetMob.id || '') : null,
                targetPlayerId: null,
                targetX: Number(targetPoint.x),
                targetY: Number(targetPoint.y),
                issuedAt: Number(player.pendingSkillCast?.issuedAt || now),
                nextAttemptAt: now + 150
            };
            this.assignPathTo(player, Number(targetPoint.x), Number(targetPoint.y));
            return null;
        }
        player.pendingSkillCast = null;
        return {
            now,
            isAutoRetry,
            skillId,
            skill,
            skillLevel,
            castMode,
            mapInstanceId,
            targetMob,
            targetPoint
        };
    }
    resolveTargetsForCast(player, context) {
        const { castMode, mapInstanceId, targetMob, targetPoint, skill, skillLevel } = context;
        const allMobs = this.getMobsByMap(mapInstanceId).filter((mob) => Number(mob?.hp || 0) > 0);
        if (castMode === 'direct')
            return targetMob ? [targetMob] : [];
        if (castMode === 'self_aoe' || castMode === 'ground') {
            const center = castMode === 'self_aoe'
                ? { x: Number(player.x || 0), y: Number(player.y || 0) }
                : (targetPoint || { x: Number(player.x || 0), y: Number(player.y || 0) });
            const radius = Math.max(24, Number(skill.aoeRadius || 0) + Number(skill.aoeRadiusStep || 0) * Math.max(0, skillLevel - 1));
            return allMobs.filter((mob) => (0, math_1.distance)(center, mob) <= radius);
        }
        if (castMode === 'line') {
            const start = { x: Number(player.x || 0), y: Number(player.y || 0) };
            const end = this.resolveProjectedEndPoint(start, targetPoint || start, skill.lineLength, skill.lineLengthStep, skillLevel);
            const halfWidth = Math.max(16, (Number(skill.lineWidth || 0) + Number(skill.lineWidthStep || 0) * Math.max(0, skillLevel - 1)) / 2);
            return allMobs.filter((mob) => this.distanceToSegment(mob, start, end) <= halfWidth);
        }
        if (castMode === 'cone') {
            const origin = { x: Number(player.x || 0), y: Number(player.y || 0) };
            const aim = targetPoint || origin;
            const coneLength = Math.max(40, Number(skill.aoeRadius || 0) + Number(skill.aoeRadiusStep || 0) * Math.max(0, skillLevel - 1) || Number(skill.range || 0));
            const halfAngle = ((Number(skill.coneAngleDeg || 72) + Number(skill.coneAngleStep || 0) * Math.max(0, skillLevel - 1)) * Math.PI) / 360;
            const facing = Math.atan2(Number(aim.y || 0) - origin.y, Number(aim.x || 0) - origin.x);
            return allMobs.filter((mob) => {
                const dx = Number(mob.x || 0) - origin.x;
                const dy = Number(mob.y || 0) - origin.y;
                const mobDistance = Math.hypot(dx, dy);
                if (mobDistance > coneLength)
                    return false;
                const angle = Math.atan2(dy, dx);
                const delta = Math.atan2(Math.sin(angle - facing), Math.cos(angle - facing));
                return Math.abs(delta) <= halfAngle;
            });
        }
        return [];
    }
    resolveProjectedEndPoint(start, target, baseLength, lengthStep, skillLevel) {
        const dx = Number(target.x || 0) - Number(start.x || 0);
        const dy = Number(target.y || 0) - Number(start.y || 0);
        const length = Math.max(40, Number(baseLength || 180) + Number(lengthStep || 0) * Math.max(0, skillLevel - 1));
        const magnitude = Math.hypot(dx, dy) || 1;
        const scale = Math.min(1, length / magnitude);
        return {
            x: start.x + dx * scale,
            y: start.y + dy * scale
        };
    }
    distanceToSegment(point, start, end) {
        const px = Number(point?.x || 0);
        const py = Number(point?.y || 0);
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq <= 0.0001)
            return Math.hypot(px - start.x, py - start.y);
        const t = Math.max(0, Math.min(1, ((px - start.x) * dx + (py - start.y) * dy) / lenSq));
        const projX = start.x + dx * t;
        const projY = start.y + dy * t;
        return Math.hypot(px - projX, py - projY);
    }
    applyMobDamageOverTime(player, targetMob, mapInstanceId, config) {
        const key = `${config.dotKey}:${player.id}:${String(targetMob.id)}`;
        const token = Number(this.mobDotTokens.get(key) || 0) + 1;
        this.mobDotTokens.set(key, token);
        const ticks = Math.max(1, Math.floor(Number(config.ticks || 1)));
        const intervalMs = Math.max(250, Math.floor(Number(config.intervalMs || 1000)));
        const damagePerTick = Math.max(1, Math.floor(Number(config.damagePerTick || 1)));
        for (let i = 1; i <= ticks; i++) {
            setTimeout(() => {
                const activeToken = Number(this.mobDotTokens.get(key) || 0);
                if (activeToken !== token)
                    return;
                const livePlayer = this.getPlayerById(player.id);
                if (!livePlayer || livePlayer.dead || livePlayer.mapKey !== player.mapKey || livePlayer.mapId !== player.mapId)
                    return;
                const liveMob = this.getMobByIdInMap(String(targetMob.id), mapInstanceId);
                if (!liveMob || Number(liveMob.hp || 0) <= 0)
                    return;
                this.applyDamageToMobAndHandleDeath(livePlayer, liveMob, damagePerTick, Date.now());
                this.broadcastMobHit(livePlayer, liveMob);
                this.sendSkillEffect(livePlayer.mapKey, livePlayer.mapId, {
                    sourceId: livePlayer.id,
                    targetId: liveMob.id,
                    x: liveMob.x,
                    y: liveMob.y,
                    effectKey: config.effectKey
                });
            }, i * intervalMs);
        }
    }
    handleSkillLearn(player, msg) {
        const skillId = String(msg?.skillId || '');
        const skill = this.skillDefs[skillId];
        if (!skill)
            return;
        if (skillId === 'class_primary' || skillId === 'mod_fire_wing') {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Essa habilidade nao pode ser evoluida manualmente.' });
            return;
        }
        const classId = this.normalizeClassId(player.class);
        const normalizedClass = classId === 'bandit' ? 'assassin' : classId === 'shifter' ? 'druid' : classId;
        if (normalizedClass !== skill.classId) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Essa habilidade nao pertence a sua classe.' });
            return;
        }
        const levels = this.normalizeSkillLevels(player.skillLevels || {});
        const current = Math.max(0, Math.min(5, Number(levels[skillId] || 0)));
        if (current >= 5) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Essa habilidade ja esta no nivel maximo.' });
            return;
        }
        const nextLevel = current + 1;
        const prereq = this.getSkillPrerequisite(skillId);
        if (prereq) {
            const prereqLevel = Math.max(0, Math.min(5, Number(levels[prereq] || 0)));
            if (prereqLevel < 1) {
                this.sendRaw(player.ws, { type: 'system_message', text: 'Aprenda o pre-requisito antes desta habilidade.' });
                return;
            }
        }
        const requiredLevel = Math.max(1, Number(this.getSkillRequiredLevel(skillId) || 1));
        if (Math.max(1, Number(player.level || 1)) < requiredLevel) {
            this.sendRaw(player.ws, { type: 'system_message', text: `Essa habilidade exige nivel ${requiredLevel}.` });
            return;
        }
        const skillPointsAvailable = this.getAvailableSkillPoints(player);
        if (skillPointsAvailable <= 0) {
            this.sendRaw(player.ws, { type: 'system_message', text: 'Sem pontos de habilidade disponiveis.' });
            return;
        }
        levels[skillId] = nextLevel;
        player.skillLevels = levels;
        this.recomputePlayerStats(player);
        this.persistPlayer(player);
        this.sendRaw(player.ws, { type: 'system_message', text: `${skill.name} evoluiu para nivel ${nextLevel}.` });
        this.sendStatsUpdated(player);
    }
    scaleBuffForLevel(baseBuff, buffStep, level) {
        const safeLevel = Math.max(1, Math.min(5, Number(level || 1)));
        const next = { ...baseBuff };
        if (!buffStep || safeLevel <= 1)
            return next;
        const scaleTimes = safeLevel - 1;
        for (const [key, value] of Object.entries(buffStep)) {
            if (!Number.isFinite(Number(value)))
                continue;
            const step = Number(value || 0);
            const current = Number(next[key] || 0);
            next[key] = current + step * scaleTimes;
        }
        return next;
    }
}
exports.SkillService = SkillService;
//# sourceMappingURL=SkillService.js.map