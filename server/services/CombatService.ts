import { PlayerRuntime } from '../models/types';

type MapInstanceIdFn = (mapKey: string, mapId: string) => string;
type SendRawFn = (ws: any, payload: any) => void;
type HasPartyFn = (partyId: string | null | undefined) => boolean;
type SamePartyFn = (a: PlayerRuntime, b: PlayerRuntime) => boolean;
type TryPlayerAttackFn = (player: PlayerRuntime, targetPlayerId: number, now: number, silent: boolean) => void;

export class CombatService {
    constructor(
        private readonly players: Map<number, PlayerRuntime>,
        private readonly mapInstanceId: MapInstanceIdFn,
        private readonly sendRaw: SendRawFn,
        private readonly hasParty: HasPartyFn,
        private readonly sameParty: SamePartyFn,
        private readonly tryPlayerAttack: TryPlayerAttackFn
    ) {}

    handleCombatTargetPlayer(player: PlayerRuntime, msg: any) {
        if (player.dead || player.hp <= 0) return;
        const targetPlayerId = Number(msg?.targetPlayerId);
        if (!Number.isInteger(targetPlayerId) || targetPlayerId <= 0 || targetPlayerId === player.id) return;
        const target = this.players.get(targetPlayerId);
        if (!target || target.dead || target.hp <= 0) return;
        if (player.mapId !== target.mapId || player.mapKey !== target.mapKey) return;
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

    handleCombatClearTarget(player: PlayerRuntime) {
        player.pvpAutoAttackActive = false;
        player.attackTargetPlayerId = null;
        player.movePath = [];
        player.rawMovePath = [];
        player.pathDestinationX = player.x;
        player.pathDestinationY = player.y;
    }

    handleCombatAttack(player: PlayerRuntime, msg: any) {
        if (player.dead || player.hp <= 0) return;
        const targetPlayerId = Number(msg?.targetPlayerId);
        if (!Number.isInteger(targetPlayerId) || targetPlayerId <= 0) return;
        if (targetPlayerId === player.id) return;
        this.tryPlayerAttack(player, targetPlayerId, Date.now(), false);
    }

    getPvpAttackPermission(player: PlayerRuntime, target: PlayerRuntime): { ok: boolean; reason?: string } {
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
        if (mode === 'evil') return { ok: true };
        return { ok: false, reason: 'Modo PVP invalido.' };
    }
}

