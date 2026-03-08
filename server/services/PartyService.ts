import { randomUUID } from 'crypto';
import {
    PARTY_INVITE_TTL_MS,
    PARTY_JOIN_REQUEST_TTL_MS,
    PARTY_MAX_MEMBERS,
    WORLD
} from '../config';
import { PlayerRuntime } from '../models/types';
import { clamp } from '../utils/math';

const PARTY_WAYPOINT_TTL_MS = 10000;

export interface Party {
    id: string;
    leaderId: number;
    memberIds: number[];
    createdAt: number;
    areaId: string;
    maxMembers: number;
}

interface PartyInvite {
    id: string;
    partyId: string;
    fromPlayerId: number;
    toPlayerId: number;
    expiresAt: number;
}

interface PartyJoinRequest {
    id: string;
    partyId: string;
    fromPlayerId: number;
    toLeaderId: number;
    expiresAt: number;
}

type SendRawFn = (ws: any, payload: any) => void;
type BroadcastRawFn = (payload: any) => void;
type PersistPlayerFn = (player: PlayerRuntime) => void | Promise<void>;
type GetAreaIdFn = (player: PlayerRuntime) => string;

export class PartyService {
    private readonly parties: Map<string, Party> = new Map();
    private readonly partyInvites: Map<string, PartyInvite> = new Map();
    private readonly partyJoinRequests: Map<string, PartyJoinRequest> = new Map();

    constructor(
        private readonly players: Map<number, PlayerRuntime>,
        private readonly sendRaw: SendRawFn,
        private readonly broadcastRaw: BroadcastRawFn,
        private readonly persistPlayer: PersistPlayerFn,
        private readonly getAreaIdForPlayer: GetAreaIdFn
    ) {}

    hasParty(partyId: string | null | undefined) {
        return Boolean(partyId && this.parties.has(partyId));
    }

    arePlayersInSameParty(a: PlayerRuntime, b: PlayerRuntime) {
        if (!a.partyId || !b.partyId) return false;
        if (a.partyId !== b.partyId) return false;
        return this.parties.has(a.partyId);
    }

    handlePartyCreate(player: PlayerRuntime) {
        if (player.partyId && this.parties.has(player.partyId)) {
            this.sendPartyError(player, 'Voce ja esta em um grupo.');
            return;
        }

        const partyId = randomUUID();
        const party: Party = {
            id: partyId,
            leaderId: player.id,
            memberIds: [player.id],
            createdAt: Date.now(),
            areaId: this.getAreaIdForPlayer(player),
            maxMembers: PARTY_MAX_MEMBERS
        };
        this.parties.set(partyId, party);
        player.partyId = partyId;
        this.syncPartyStateForMembers(party, true);
        this.sendPartyAreaList(player);
    }

    handlePartyInvite(player: PlayerRuntime, msg: any) {
        const targetName = String(msg.targetName || '').trim().toLowerCase();
        if (!targetName) return;
        const party = player.partyId ? this.parties.get(player.partyId) : null;
        if (!party) {
            this.sendPartyError(player, 'Crie um grupo antes de convidar.');
            return;
        }
        if (party.leaderId !== player.id) {
            this.sendPartyError(player, 'Somente o lider pode convidar.');
            return;
        }
        if (party.memberIds.length >= party.maxMembers) {
            this.sendPartyError(player, 'Grupo cheio.');
            return;
        }

        const target = this.findOnlinePlayerByName(targetName);
        if (!target) {
            this.sendPartyError(player, 'Jogador alvo nao encontrado pelo nome.');
            return;
        }
        if (target.id === player.id) {
            this.sendPartyError(player, 'Voce nao pode convidar a si mesmo.');
            return;
        }
        if (target.partyId && this.parties.has(target.partyId)) {
            this.sendPartyError(player, 'Jogador alvo ja esta em grupo.');
            return;
        }
        if (this.getAreaIdForPlayer(target) !== this.getAreaIdForPlayer(player)) {
            this.sendPartyError(player, 'Jogador alvo esta em outra area.');
            return;
        }
        const now = Date.now();
        this.pruneExpiredPartyInvites(now);
        for (const invite of this.partyInvites.values()) {
            if (invite.fromPlayerId === player.id && invite.toPlayerId === target.id) {
                this.sendPartyError(player, 'Convite para esse jogador ja esta pendente.');
                return;
            }
        }

        const invite: PartyInvite = {
            id: randomUUID(),
            partyId: party.id,
            fromPlayerId: player.id,
            toPlayerId: target.id,
            expiresAt: now + PARTY_INVITE_TTL_MS
        };
        this.partyInvites.set(invite.id, invite);
        this.sendRaw(target.ws, {
            type: 'party.inviteReceived',
            inviteId: invite.id,
            fromPlayerId: player.id,
            fromName: player.name,
            partyId: party.id,
            expiresIn: PARTY_INVITE_TTL_MS
        });
        this.sendRaw(player.ws, { type: 'system_message', text: `Convite enviado para ${target.name}.` });
    }

    handlePartyAcceptInvite(player: PlayerRuntime, msg: any) {
        const partyId = String(msg.partyId || '');
        const inviteId = String(msg.inviteId || '');
        const now = Date.now();
        this.pruneExpiredPartyInvites(now);
        const invite = inviteId
            ? this.partyInvites.get(inviteId) || null
            : [...this.partyInvites.values()].find((it) => it.partyId === partyId && it.toPlayerId === player.id) || null;
        if (!invite) {
            this.sendPartyError(player, 'Convite invalido ou expirado.');
            return;
        }
        if (invite.toPlayerId !== player.id) {
            this.sendPartyError(player, 'Convite invalido para este jogador.');
            return;
        }
        const resolvedPartyId = partyId || invite.partyId;
        const party = this.parties.get(resolvedPartyId);
        if (!party) {
            this.partyInvites.delete(invite.id);
            this.sendPartyError(player, 'Grupo nao existe mais.');
            return;
        }
        if (party.memberIds.length >= party.maxMembers) {
            this.partyInvites.delete(invite.id);
            this.sendPartyError(player, 'Grupo cheio.');
            return;
        }
        if (player.partyId && this.parties.has(player.partyId)) {
            this.partyInvites.delete(invite.id);
            this.sendPartyError(player, 'Voce ja esta em outro grupo.');
            return;
        }

        party.memberIds.push(player.id);
        player.partyId = party.id;
        this.partyInvites.delete(invite.id);
        this.syncPartyStateForMembers(party, true);
        this.sendPartyAreaList(player);
        const inviter = this.players.get(invite.fromPlayerId);
        if (inviter) {
            this.sendRaw(inviter.ws, { type: 'system_message', text: `${player.name} aceitou seu convite de grupo.` });
        }
    }

    handlePartyDeclineInvite(player: PlayerRuntime, msg: any) {
        const partyId = String(msg.partyId || '');
        const inviteId = String(msg.inviteId || '');
        if (inviteId) {
            const invite = this.partyInvites.get(inviteId);
            if (!invite || invite.toPlayerId !== player.id) return;
            this.partyInvites.delete(inviteId);
            const inviter = this.players.get(invite.fromPlayerId);
            if (inviter) {
                this.sendRaw(inviter.ws, { type: 'system_message', text: `${player.name} recusou seu convite de grupo.` });
            }
            return;
        }
        for (const [storedInviteId, invite] of this.partyInvites.entries()) {
            if (invite.partyId === partyId && invite.toPlayerId === player.id) {
                this.partyInvites.delete(storedInviteId);
                const inviter = this.players.get(invite.fromPlayerId);
                if (inviter) {
                    this.sendRaw(inviter.ws, { type: 'system_message', text: `${player.name} recusou seu convite de grupo.` });
                }
                return;
            }
        }
    }

    handlePartyLeave(player: PlayerRuntime) {
        this.removePlayerFromParty(player);
    }

    handlePartyKick(player: PlayerRuntime, msg: any) {
        const targetPlayerId = Number(msg.targetPlayerId);
        if (!Number.isInteger(targetPlayerId)) return;
        const party = player.partyId ? this.parties.get(player.partyId) : null;
        if (!party) return;
        if (party.leaderId !== player.id) {
            this.sendPartyError(player, 'Somente o lider pode expulsar.');
            return;
        }
        if (targetPlayerId === player.id) {
            this.sendPartyError(player, 'Use sair para deixar o grupo.');
            return;
        }
        if (!party.memberIds.includes(targetPlayerId)) return;
        const target = this.players.get(targetPlayerId);
        if (target) {
            target.partyId = null;
            if (target.pvpMode === 'group') {
                target.pvpMode = 'peace';
                this.broadcastRaw({
                    type: 'player.pvpModeUpdated',
                    playerId: target.id,
                    mode: 'peace'
                });
                void this.persistPlayer(target);
            }
            this.sendPartyStateToPlayer(target, null);
        }
        party.memberIds = party.memberIds.filter((id) => id !== targetPlayerId);
        if (party.memberIds.length === 0) {
            this.clearJoinRequestsForParty(party.id);
            this.parties.delete(party.id);
            return;
        }
        this.syncPartyStateForMembers(party, true);
    }

    handlePartyPromote(player: PlayerRuntime, msg: any) {
        const targetPlayerId = Number(msg.targetPlayerId);
        if (!Number.isInteger(targetPlayerId)) return;
        const party = player.partyId ? this.parties.get(player.partyId) : null;
        if (!party) return;
        if (party.leaderId !== player.id) {
            this.sendPartyError(player, 'Somente o lider pode promover.');
            return;
        }
        if (!party.memberIds.includes(targetPlayerId)) return;
        party.leaderId = targetPlayerId;
        this.clearJoinRequestsForParty(party.id);
        this.syncPartyStateForMembers(party, true);
    }

    handlePartyRequestAreaParties(player: PlayerRuntime) {
        this.sendPartyAreaList(player);
    }

    handlePartyRequestJoin(player: PlayerRuntime, msg: any) {
        const partyId = String(msg.partyId || '');
        const party = this.parties.get(partyId);
        if (!party) {
            this.sendPartyError(player, 'Grupo nao encontrado.');
            return;
        }
        if (player.partyId && this.parties.has(player.partyId)) {
            this.sendPartyError(player, 'Voce ja esta em um grupo.');
            return;
        }
        if (party.memberIds.length >= party.maxMembers) {
            this.sendPartyError(player, 'Grupo cheio.');
            return;
        }
        if (this.getAreaIdForPlayer(player) !== party.areaId) {
            this.sendPartyError(player, 'Voce precisa estar na mesma area do grupo.');
            return;
        }

        const now = Date.now();
        this.pruneExpiredPartyJoinRequests(now);
        for (const req of this.partyJoinRequests.values()) {
            if (req.partyId === party.id && req.fromPlayerId === player.id) {
                this.sendPartyError(player, 'Solicitacao de entrada ja enviada.');
                return;
            }
        }

        const request: PartyJoinRequest = {
            id: randomUUID(),
            partyId: party.id,
            fromPlayerId: player.id,
            toLeaderId: party.leaderId,
            expiresAt: now + PARTY_JOIN_REQUEST_TTL_MS
        };
        this.partyJoinRequests.set(request.id, request);
        const leader = this.players.get(party.leaderId);
        if (leader) {
            this.sendRaw(leader.ws, {
                type: 'party.joinRequestReceived',
                requestId: request.id,
                partyId: party.id,
                fromPlayerId: player.id,
                fromName: player.name,
                expiresIn: PARTY_JOIN_REQUEST_TTL_MS
            });
        }
        this.sendRaw(player.ws, { type: 'system_message', text: 'Solicitacao enviada ao lider do grupo.' });
    }

    handlePartyApproveJoin(player: PlayerRuntime, msg: any) {
        const requestId = String(msg.requestId || '');
        const accept = Boolean(msg.accept);
        const now = Date.now();
        this.pruneExpiredPartyJoinRequests(now);

        const request = this.partyJoinRequests.get(requestId);
        if (!request) {
            this.sendPartyError(player, 'Solicitacao invalida ou expirada.');
            return;
        }

        const party = this.parties.get(request.partyId);
        if (!party) {
            this.partyJoinRequests.delete(requestId);
            this.sendPartyError(player, 'Grupo nao existe mais.');
            return;
        }
        if (party.leaderId !== player.id || request.toLeaderId !== player.id) {
            this.sendPartyError(player, 'Somente o lider pode aprovar.');
            return;
        }

        const requester = this.players.get(request.fromPlayerId);
        this.partyJoinRequests.delete(requestId);

        if (!accept) {
            if (requester) {
                this.sendRaw(requester.ws, { type: 'party.joinRequestResult', ok: false, message: 'Solicitacao recusada.' });
            }
            this.sendRaw(player.ws, { type: 'system_message', text: 'Solicitacao de entrada recusada.' });
            return;
        }

        if (!requester) {
            this.sendPartyError(player, 'Jogador solicitante nao esta online.');
            return;
        }
        if (requester.partyId && this.parties.has(requester.partyId)) {
            this.sendPartyError(player, 'Jogador solicitante ja entrou em outro grupo.');
            return;
        }
        if (party.memberIds.length >= party.maxMembers) {
            this.sendPartyError(player, 'Grupo cheio.');
            return;
        }

        party.memberIds.push(requester.id);
        requester.partyId = party.id;
        this.clearJoinRequestsForPlayer(requester.id);
        this.syncPartyStateForMembers(party, true);
        this.sendRaw(requester.ws, { type: 'party.joinRequestResult', ok: true, message: 'Entrada no grupo aprovada.' });
        this.sendRaw(player.ws, { type: 'system_message', text: `${requester.name} entrou no grupo.` });
    }

    handlePartyWaypointPing(player: PlayerRuntime, msg: any) {
        const party = player.partyId ? this.parties.get(player.partyId) : null;
        if (!party) {
            this.sendPartyError(player, 'Voce precisa estar em grupo para marcar waypoint.');
            return;
        }
        if (!party.memberIds.includes(player.id)) return;

        const x = Number(msg?.x);
        const y = Number(msg?.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) return;

        const waypointX = clamp(x, 0, WORLD.width);
        const waypointY = clamp(y, 0, WORLD.height);
        const createdAt = Date.now();
        const payload = {
            type: 'party.waypointPing',
            waypointId: randomUUID(),
            partyId: party.id,
            fromPlayerId: player.id,
            fromName: player.name,
            mapKey: player.mapKey,
            mapId: player.mapId,
            x: waypointX,
            y: waypointY,
            createdAt,
            expiresIn: PARTY_WAYPOINT_TTL_MS
        };
        for (const memberId of party.memberIds) {
            const member = this.players.get(memberId);
            if (!member) continue;
            this.sendRaw(member.ws, payload);
        }
    }

    sendPartyStateToPlayer(player: PlayerRuntime, party: Party | null) {
        this.sendRaw(player.ws, {
            type: 'party.state',
            party: party ? this.buildPartySnapshot(party) : null
        });
    }

    syncAllPartyStates() {
        for (const party of this.parties.values()) {
            this.syncPartyStateForMembers(party);
        }
    }

    sendPartyAreaList(player: PlayerRuntime) {
        const areaId = this.getAreaIdForPlayer(player);
        const parties = [...this.parties.values()]
            .filter((party) => party.areaId === areaId)
            .map((party) => {
                const leader = this.players.get(party.leaderId);
                const levels = party.memberIds
                    .map((id) => this.players.get(id))
                    .filter((p): p is PlayerRuntime => Boolean(p))
                    .map((p) => p.level);
                const avgLevel = levels.length > 0 ? Math.round(levels.reduce((sum, lv) => sum + lv, 0) / levels.length) : 1;
                return {
                    partyId: party.id,
                    leaderId: party.leaderId,
                    leaderName: leader?.name || `#${party.leaderId}`,
                    members: party.memberIds.length,
                    maxMembers: party.maxMembers,
                    avgLevel
                };
            });

        this.sendRaw(player.ws, { type: 'party.areaList', parties });
    }

    pruneExpiredPartyInvites(now: number) {
        for (const [inviteId, invite] of this.partyInvites.entries()) {
            if (invite.expiresAt > now) continue;
            this.partyInvites.delete(inviteId);
        }
    }

    pruneExpiredPartyJoinRequests(now: number) {
        for (const [requestId, request] of this.partyJoinRequests.entries()) {
            if (request.expiresAt > now) continue;
            this.partyJoinRequests.delete(requestId);
        }
    }

    clearPendingInvitesForPlayer(playerId: number) {
        for (const [inviteId, invite] of this.partyInvites.entries()) {
            if (invite.fromPlayerId === playerId || invite.toPlayerId === playerId) {
                this.partyInvites.delete(inviteId);
            }
        }
    }

    clearJoinRequestsForPlayer(playerId: number) {
        for (const [requestId, request] of this.partyJoinRequests.entries()) {
            if (request.fromPlayerId === playerId || request.toLeaderId === playerId) {
                this.partyJoinRequests.delete(requestId);
            }
        }
    }

    clearJoinRequestsForParty(partyId: string) {
        for (const [requestId, request] of this.partyJoinRequests.entries()) {
            if (request.partyId === partyId) this.partyJoinRequests.delete(requestId);
        }
    }

    removePlayerFromParty(player: PlayerRuntime) {
        const party = player.partyId ? this.parties.get(player.partyId) : null;
        player.partyId = null;
        if (player.pvpMode === 'group') {
            player.pvpMode = 'peace';
            this.broadcastRaw({
                type: 'player.pvpModeUpdated',
                playerId: player.id,
                mode: 'peace'
            });
            void this.persistPlayer(player);
        }
        if (!party) {
            this.sendPartyStateToPlayer(player, null);
            return;
        }

        party.memberIds = party.memberIds.filter((id) => id !== player.id);
        this.sendPartyStateToPlayer(player, null);
        this.clearPendingInvitesForPlayer(player.id);

        if (party.memberIds.length === 0) {
            this.clearJoinRequestsForParty(party.id);
            this.parties.delete(party.id);
            return;
        }

        if (party.leaderId === player.id) {
            party.leaderId = party.memberIds[0];
            this.clearJoinRequestsForParty(party.id);
        }
        this.syncPartyStateForMembers(party, true);
    }

    private sendPartyError(player: PlayerRuntime, message: string) {
        this.sendRaw(player.ws, { type: 'party.error', message });
    }

    private buildPartySnapshot(party: Party) {
        const members = party.memberIds
            .map((id) => this.players.get(id))
            .filter((p): p is PlayerRuntime => Boolean(p))
            .map((member) => ({
                playerId: member.id,
                name: member.name,
                class: member.class,
                level: member.level,
                hp: member.hp,
                maxHp: member.maxHp,
                role: member.id === party.leaderId ? 'leader' : 'member',
                online: true
            }));

        return {
            id: party.id,
            leaderId: party.leaderId,
            areaId: party.areaId,
            maxMembers: party.maxMembers,
            members
        };
    }

    private syncPartyStateForMembers(party: Party, includeAreaList: boolean = false) {
        party.areaId = this.players.get(party.leaderId) ? this.getAreaIdForPlayer(this.players.get(party.leaderId)!) : party.areaId;
        for (const memberId of party.memberIds) {
            const member = this.players.get(memberId);
            if (!member) continue;
            member.partyId = party.id;
            this.sendPartyStateToPlayer(member, party);
            if (includeAreaList) this.sendPartyAreaList(member);
        }
    }

    private findOnlinePlayerByName(rawName: string) {
        const needle = String(rawName || '').trim().toLowerCase();
        if (!needle) return null;
        return [...this.players.values()].find((candidate) => {
            const byName = String(candidate.name || '').toLowerCase() === needle;
            const byUsername = String(candidate.username || '').toLowerCase() === needle;
            return byName || byUsername;
        }) || null;
    }
}
