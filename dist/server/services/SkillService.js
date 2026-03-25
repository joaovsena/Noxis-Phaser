"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillService = void 0;
const config_1 = require("../config");
const math_1 = require("../utils/math");
class SkillService {
    constructor(skillDefs, sendRaw, normalizeClassId, getSkillLevel, pruneExpiredSkillEffects, applyTimedSkillEffect, sendSkillEffect, computeMobDamage, applyDamageToMobAndHandleDeath, broadcastMobHit, applyOnHitSkillEffects, hasActiveSkillEffect, removeSkillEffectById, getSkillPowerWithLevel, sendStatsUpdated, mapInstanceId, getMobByIdInMap, getMobsByMap, assignPathTo, getSkillPrerequisite, getSkillRequiredLevel, normalizeSkillLevels, getAvailableSkillPoints, recomputePlayerStats, persistPlayer, getPlayerById) {
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
        const hpBeforeCast = Number(player.hp || 0);
        let targetMob = null;
        let mapInstanceId = '';
        if (skill.target === 'mob') {
            const targetMobId = String(msg?.targetMobId || player.attackTargetId || '');
            mapInstanceId = this.mapInstanceId(player.mapKey, player.mapId);
            targetMob = this.getMobByIdInMap(targetMobId, mapInstanceId);
            if (!targetMob) {
                player.pendingSkillCast = null;
                if (!isAutoRetry)
                    this.sendRaw(player.ws, { type: 'system_message', text: 'Selecione um alvo para usar a habilidade.' });
                return;
            }
            const currentDistance = (0, math_1.distance)(player, targetMob);
            const edgeDistance = currentDistance - (targetMob.size / 2 + config_1.PLAYER_HALF_SIZE);
            const range = Number(skill.range || 100) + Number(skill.rangeStep || 0) * Math.max(0, skillLevel - 1);
            if (edgeDistance > range) {
                player.pendingSkillCast = {
                    skillId,
                    targetMobId: targetMob.id,
                    targetPlayerId: null,
                    issuedAt: Number(player.pendingSkillCast?.issuedAt || now),
                    nextAttemptAt: now + 150
                };
                // Skill em alvo mob deve manter pressao com ataque basico enquanto aproxima.
                player.pvpAutoAttackActive = false;
                player.attackTargetPlayerId = null;
                player.autoAttackActive = true;
                player.attackTargetId = targetMob.id;
                this.assignPathTo(player, Number(targetMob.x), Number(targetMob.y));
                return;
            }
        }
        player.pendingSkillCast = null;
        if (skill.hpCostPct && skill.hpCostPct > 0) {
            const hpCost = Math.max(1, Math.floor(Number(player.maxHp || 1) * Number(skill.hpCostPct)));
            if (player.hp <= hpCost) {
                this.sendRaw(player.ws, { type: 'system_message', text: 'HP insuficiente para usar esta habilidade.' });
                return;
            }
            player.hp = Math.max(1, player.hp - hpCost);
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
            this.applyTimedSkillEffect(player, this.scaleBuffForLevel(skill.buff, skill.buffStep || null, skillLevel), now);
            this.sendSkillEffect(player.mapKey, player.mapId, {
                sourceId: player.id,
                targetId: player.id,
                x: player.x,
                y: player.y,
                effectKey: skill.effectKey || skill.id
            });
        }
        if (skill.target === 'self') {
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
        const aoeRadius = Math.max(0, Number(skill.aoeRadius || 0) + Number(skill.aoeRadiusStep || 0) * Math.max(0, skillLevel - 1));
        if (aoeRadius > 0) {
            const mobsInRange = this.getMobsByMap(mapInstanceId).filter((m) => {
                const d = (0, math_1.distance)({ x: targetMob.x, y: targetMob.y }, m);
                return d <= aoeRadius;
            });
            for (const mob of mobsInRange) {
                const damage = this.computeMobDamage(player, mob, scaledPower, Boolean(skill.magic), now);
                this.applyDamageToMobAndHandleDeath(player, mob, damage, now);
                this.broadcastMobHit(player, mob);
                this.applyOnHitSkillEffects(player, damage, now);
            }
        }
        else {
            let damage = this.computeMobDamage(player, targetMob, scaledPower, Boolean(skill.magic), now);
            if (skill.id === 'ass_letal_emboscada' && this.hasActiveSkillEffect(player, 'ocultar', now)) {
                damage = Math.max(1, Math.floor(damage * 1.45));
                this.removeSkillEffectById(player, 'ocultar');
            }
            this.applyDamageToMobAndHandleDeath(player, targetMob, damage, now);
            this.broadcastMobHit(player, targetMob);
            this.applyOnHitSkillEffects(player, damage, now);
            if (skill.id === 'arc_franco_ponteira_envenenada' && Number(targetMob.hp || 0) > 0) {
                this.applyMobDamageOverTime(player, targetMob, mapInstanceId, {
                    dotKey: 'arc_poison',
                    ticks: 4,
                    intervalMs: 1000,
                    damagePerTick: Math.max(1, Math.floor(damage * 0.24)),
                    effectKey: 'arc_poison_tick'
                });
            }
            if (skill.id === 'ass_letal_sentenca') {
                const delayedDamage = Math.max(1, Math.floor(damage * 0.75));
                setTimeout(() => {
                    const livePlayer = this.getPlayerById(player.id);
                    if (!livePlayer || livePlayer.dead || livePlayer.mapKey !== player.mapKey || livePlayer.mapId !== player.mapId)
                        return;
                    const liveMob = this.getMobByIdInMap(String(targetMob.id), mapInstanceId);
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
        }
        this.sendSkillEffect(player.mapKey, player.mapId, {
            sourceId: player.id,
            targetId: targetMob.id,
            x: targetMob.x,
            y: targetMob.y,
            effectKey: skill.effectKey || skill.id
        });
        // Apos usar habilidade em mob, continua no ciclo de ataque basico.
        if (Number(targetMob.hp || 0) > 0) {
            player.pvpAutoAttackActive = false;
            player.attackTargetPlayerId = null;
            player.autoAttackActive = true;
            player.attackTargetId = String(targetMob.id);
        }
        player.lastCombatAt = now;
        this.sendStatsUpdated(player);
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
            if (current > 1 && !['critAdd', 'evasionAdd', 'damageReduction', 'lifesteal', 'reflect'].includes(String(key))) {
                next[key] = current + step * scaleTimes;
                continue;
            }
            next[key] = current + step * scaleTimes;
        }
        return next;
    }
}
exports.SkillService = SkillService;
//# sourceMappingURL=SkillService.js.map