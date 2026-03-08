"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CombatService = void 0;
class CombatService {
    constructor(players, mapInstanceId, sendRaw, hasParty, sameParty, tryPlayerAttack) {
        this.players = players;
        this.mapInstanceId = mapInstanceId;
        this.sendRaw = sendRaw;
        this.hasParty = hasParty;
        this.sameParty = sameParty;
        this.tryPlayerAttack = tryPlayerAttack;
    }
    handleCombatTargetPlayer(player, msg) {
        if (player.dead || player.hp <= 0)
            return;
        const targetPlayerId = Number(msg?.targetPlayerId);
        if (!Number.isInteger(targetPlayerId) || targetPlayerId <= 0 || targetPlayerId === player.id)
            return;
        const target = this.players.get(targetPlayerId);
        if (!target || target.dead || target.hp <= 0)
            return;
        if (player.mapId !== target.mapId || player.mapKey !== target.mapKey)
            return;
        const permission = this.getPvpAttackPermission(player, target);
        if (!permission.ok) {
            this.sendRaw(player.ws, { type: 'system_message', text: permission.reason || 'Nao pode atacar esse alvo.' });
            return;
        }
        player.pvpAutoAttackActive = true;
        player.attackTargetPlayerId = targetPlayerId;
        player.autoAttackActive = false;
        player.attackTargetId = null;
    }
    handleCombatClearTarget(player) {
        player.pvpAutoAttackActive = false;
        player.attackTargetPlayerId = null;
        player.movePath = [];
        player.rawMovePath = [];
        player.pathDestinationX = player.x;
        player.pathDestinationY = player.y;
    }
    handleCombatAttack(player, msg) {
        if (player.dead || player.hp <= 0)
            return;
        const targetPlayerId = Number(msg?.targetPlayerId);
        if (!Number.isInteger(targetPlayerId) || targetPlayerId <= 0)
            return;
        if (targetPlayerId === player.id)
            return;
        this.tryPlayerAttack(player, targetPlayerId, Date.now(), false);
    }
    getPvpAttackPermission(player, target) {
        if (this.sameParty(player, target)) {
            return { ok: false, reason: 'Voce nao pode atacar membros do seu grupo.' };
        }
        const mode = player.pvpMode === 'evil' ? 'evil' : player.pvpMode === 'group' ? 'group' : 'peace';
        const targetMode = target.pvpMode === 'evil' ? 'evil' : target.pvpMode === 'group' ? 'group' : 'peace';
        if (mode === 'peace') {
            return { ok: false, reason: 'Modo Paz ativo: voce nao pode atacar jogadores.' };
        }
        if (mode === 'group') {
            if (!this.hasParty(player.partyId)) {
                return { ok: false, reason: 'Modo Grupo exige estar em grupo.' };
            }
            if (targetMode !== 'group' && targetMode !== 'evil') {
                return { ok: false, reason: 'Modo Grupo so pode atacar jogadores nos modos Grupo ou Mal.' };
            }
            return { ok: true };
        }
        if (mode === 'evil')
            return { ok: true };
        return { ok: false, reason: 'Modo PVP invalido.' };
    }
}
exports.CombatService = CombatService;
//# sourceMappingURL=CombatService.js.map