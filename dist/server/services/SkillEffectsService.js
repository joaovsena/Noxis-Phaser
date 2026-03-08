"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SkillEffectsService = void 0;
class SkillEffectsService {
    constructor(players, sendRaw) {
        this.players = players;
        this.sendRaw = sendRaw;
    }
    pruneExpiredSkillEffects(player, now = Date.now()) {
        if (!Array.isArray(player.activeSkillEffects)) {
            player.activeSkillEffects = [];
            return;
        }
        player.activeSkillEffects = player.activeSkillEffects.filter((fx) => Number(fx?.expiresAt || 0) > now);
    }
    hasActiveSkillEffect(player, effectId, now = Date.now()) {
        this.pruneExpiredSkillEffects(player, now);
        return Array.isArray(player.activeSkillEffects)
            && player.activeSkillEffects.some((fx) => String(fx?.id || '') === String(effectId));
    }
    removeSkillEffectById(player, effectId) {
        if (!Array.isArray(player.activeSkillEffects))
            return;
        player.activeSkillEffects = player.activeSkillEffects.filter((fx) => String(fx?.id || '') !== String(effectId));
    }
    getActiveSkillEffectAggregate(player, now = Date.now()) {
        this.pruneExpiredSkillEffects(player, now);
        const out = {
            attackMul: 1,
            defenseMul: 1,
            magicDefenseMul: 1,
            moveMul: 1,
            attackSpeedMul: 1,
            critAdd: 0,
            evasionAdd: 0,
            damageReduction: 0,
            lifesteal: 0,
            reflect: 0,
            stealth: false
        };
        for (const fx of player.activeSkillEffects || []) {
            const data = fx && typeof fx === 'object' ? fx : {};
            if (Number(data.attackMul) > 0)
                out.attackMul *= Number(data.attackMul);
            if (Number(data.defenseMul) > 0)
                out.defenseMul *= Number(data.defenseMul);
            if (Number(data.magicDefenseMul) > 0)
                out.magicDefenseMul *= Number(data.magicDefenseMul);
            if (Number(data.moveMul) > 0)
                out.moveMul *= Number(data.moveMul);
            if (Number(data.attackSpeedMul) > 0)
                out.attackSpeedMul *= Number(data.attackSpeedMul);
            if (Number.isFinite(Number(data.critAdd)))
                out.critAdd += Number(data.critAdd);
            if (Number.isFinite(Number(data.evasionAdd)))
                out.evasionAdd += Number(data.evasionAdd);
            if (Number.isFinite(Number(data.damageReduction)))
                out.damageReduction = Math.max(out.damageReduction, Number(data.damageReduction));
            if (Number.isFinite(Number(data.lifesteal)))
                out.lifesteal = Math.max(out.lifesteal, Number(data.lifesteal));
            if (Number.isFinite(Number(data.reflect)))
                out.reflect = Math.max(out.reflect, Number(data.reflect));
            if (data.stealth)
                out.stealth = true;
        }
        return out;
    }
    applyTimedSkillEffect(player, buff, now = Date.now()) {
        if (!buff || typeof buff !== 'object')
            return;
        if (!Array.isArray(player.activeSkillEffects))
            player.activeSkillEffects = [];
        const id = String(buff.id || `${now}_${Math.random()}`);
        const expiresAt = now + Math.max(500, Number(buff.durationMs || 1000));
        player.activeSkillEffects = player.activeSkillEffects.filter((fx) => String(fx?.id || '') !== id);
        player.activeSkillEffects.push({ ...buff, id, expiresAt });
    }
    applyOnHitSkillEffects(player, dealtDamage, now = Date.now()) {
        const effects = this.getActiveSkillEffectAggregate(player, now);
        const lifesteal = Math.max(0, Math.min(0.6, Number(effects.lifesteal || 0)));
        if (lifesteal <= 0)
            return 0;
        const heal = Math.max(1, Math.floor(Number(dealtDamage || 0) * lifesteal));
        player.hp = Math.min(Number(player.maxHp || player.hp), Number(player.hp || 0) + heal);
        return heal;
    }
    sendSkillEffect(mapKey, mapId, payload) {
        for (const receiver of this.players.values()) {
            if (receiver.mapKey !== mapKey || receiver.mapId !== mapId)
                continue;
            this.sendRaw(receiver.ws, { type: 'skill.effect', ...payload });
        }
    }
    broadcastMobHit(player, mob) {
        for (const receiver of this.players.values()) {
            if (receiver.mapId !== player.mapId || receiver.mapKey !== player.mapKey)
                continue;
            this.sendRaw(receiver.ws, {
                type: 'combat_hit',
                attackerId: player.id,
                mobId: mob.id,
                attackerX: player.x,
                attackerY: player.y,
                mobX: mob.x,
                mobY: mob.y
            });
        }
    }
}
exports.SkillEffectsService = SkillEffectsService;
//# sourceMappingURL=SkillEffectsService.js.map