import { PersistenceService } from './PersistenceService';
import { PlayerRuntime } from '../models/types';

type SendRawFn = (ws: any, payload: any) => void;

const GUILD_INVITE_TTL_MS = 60_000;

type GuildRank = 'leader' | 'officer' | 'member';

export class GuildService {
    private readonly guildLogs = new Map<string, Array<{ at: number; text: string }>>();

    constructor(
        private readonly players: Map<number, PlayerRuntime>,
        private readonly persistence: PersistenceService,
        private readonly sendRaw: SendRawFn
    ) {}

    async hydrateGuildStateForPlayer(player: PlayerRuntime) {
        const membership = await this.persistence.getGuildMembershipForPlayer(player.id);
        if (!membership?.guild) {
            player.guildId = null;
            player.guildName = null;
            player.guildRank = null;
            return;
        }
        player.guildId = String(membership.guild.id || '');
        player.guildName = String(membership.guild.name || '');
        player.guildRank = this.normalizeRank(membership.rank);
    }

    async sendGuildState(player: PlayerRuntime) {
        await this.hydrateGuildStateForPlayer(player);
        const guild = player.guildId ? await this.persistence.getGuildById(String(player.guildId || '')) : null;
        const invites = await this.persistence.getPendingGuildInvitesForPlayer(player.id);
        this.sendRaw(player.ws, {
            type: 'guild.state',
            guild: guild ? this.serializeGuild(guild) : null,
            invites: invites.map((invite: any) => ({
                inviteId: String(invite.id || ''),
                guildId: String(invite.guildId || ''),
                guildName: String(invite.guild?.name || 'Guilda'),
                fromPlayerId: Number(invite.fromPlayerId || 0),
                fromName: String(invite.fromPlayer?.name || `#${invite.fromPlayerId}`),
                expiresAt: invite.expiresAt ? new Date(invite.expiresAt).getTime() : Date.now()
            }))
        });
    }

    async handleGuildCreate(player: PlayerRuntime, msg: any) {
        const name = String(msg?.name || '').trim().replace(/\s+/g, ' ');
        if (!/^[a-zA-Z0-9_ -]{3,20}$/.test(name)) {
            this.sendSystem(player, 'Nome de guilda invalido. Use 3-20 caracteres.');
            return;
        }
        await this.hydrateGuildStateForPlayer(player);
        if (player.guildId) {
            this.sendSystem(player, 'Voce ja faz parte de uma guilda.');
            return;
        }
        const existing = await this.persistence.getGuildByName(name);
        if (existing) {
            this.sendSystem(player, 'Ja existe uma guilda com esse nome.');
            return;
        }
        const guild = await this.persistence.createGuild(name, player.id);
        player.guildId = String(guild.id || '');
        player.guildName = String(guild.name || '');
        player.guildRank = 'leader';
        this.appendLog(player.guildId, `${player.name} fundou a guilda.`);
        this.sendSystem(player, `Guilda criada: ${name}.`);
        await this.sendGuildState(player);
    }

    async handleGuildInvite(player: PlayerRuntime, msg: any) {
        const targetName = String(msg?.targetName || '').trim().toLowerCase();
        if (!targetName) return;
        await this.hydrateGuildStateForPlayer(player);
        if (!player.guildId || !player.guildRank) {
            this.sendSystem(player, 'Voce precisa estar em uma guilda para convidar.');
            return;
        }
        if (!this.canInvite(player.guildRank)) {
            this.sendSystem(player, 'Seu rank nao permite convidar jogadores.');
            return;
        }
        const target = [...this.players.values()].find((candidate) => String(candidate.name || '').trim().toLowerCase() === targetName) || null;
        if (!target) {
            this.sendSystem(player, 'Jogador nao encontrado para convite de guilda.');
            return;
        }
        if (target.id === player.id) {
            this.sendSystem(player, 'Voce nao pode convidar a si mesmo.');
            return;
        }
        await this.hydrateGuildStateForPlayer(target);
        if (target.guildId) {
            this.sendSystem(player, 'Esse jogador ja participa de uma guilda.');
            return;
        }
        const existing = await this.persistence.findPendingGuildInviteBetween(String(player.guildId || ''), player.id, target.id);
        if (existing) {
            this.sendSystem(player, 'Ja existe um convite pendente para esse jogador.');
            return;
        }
        await this.persistence.createGuildInvite(String(player.guildId || ''), player.id, target.id, new Date(Date.now() + GUILD_INVITE_TTL_MS));
        this.sendSystem(player, `Convite de guilda enviado para ${target.name}.`);
        this.sendSystem(target, `${player.name} convidou voce para a guilda ${player.guildName || 'Guilda'}.`);
        await this.sendGuildState(player);
        await this.sendGuildState(target);
    }

    async handleGuildRespondInvite(player: PlayerRuntime, msg: any) {
        const inviteId = String(msg?.inviteId || '');
        const accept = Boolean(msg?.accept);
        const invite = await this.persistence.getPendingGuildInviteById(inviteId);
        if (!invite || Number(invite.toPlayerId || 0) !== player.id) return;
        await this.hydrateGuildStateForPlayer(player);
        if (!accept) {
            await this.persistence.completeGuildInvite(inviteId, 'declined');
            const inviter = this.players.get(Number(invite.fromPlayerId || 0)) || null;
            this.sendSystem(player, 'Convite de guilda recusado.');
            if (inviter) {
                this.sendSystem(inviter, `${player.name} recusou o convite de guilda.`);
                await this.sendGuildState(inviter);
            }
            await this.sendGuildState(player);
            return;
        }
        if (player.guildId) {
            this.sendSystem(player, 'Voce ja faz parte de uma guilda.');
            await this.persistence.completeGuildInvite(inviteId, 'cancelled');
            await this.sendGuildState(player);
            return;
        }
        await this.persistence.addGuildMember(String(invite.guildId || ''), player.id, 'member');
        await this.persistence.completeGuildInvite(inviteId, 'accepted');
        await this.hydrateGuildStateForPlayer(player);
        this.appendLog(String(invite.guildId || ''), `${player.name} entrou na guilda.`);
        this.sendSystem(player, `Voce entrou na guilda ${player.guildName || 'Guilda'}.`);
        await this.broadcastGuildStateForGuild(String(invite.guildId || ''));
        await this.sendGuildState(player);
    }

    async handleGuildLeave(player: PlayerRuntime) {
        await this.hydrateGuildStateForPlayer(player);
        if (!player.guildId || !player.guildRank) {
            this.sendSystem(player, 'Voce nao esta em uma guilda.');
            return;
        }
        const guild = await this.persistence.getGuildById(String(player.guildId || ''));
        const members = Array.isArray(guild?.members) ? guild.members : [];
        if (player.guildRank === 'leader' && members.length > 1) {
            this.sendSystem(player, 'Transfira a lideranca antes de sair da guilda.');
            return;
        }
        const guildId = String(player.guildId || '');
        const guildName = String(player.guildName || 'Guilda');
        if (members.length <= 1) {
            await this.persistence.deleteGuild(guildId);
            this.appendLog(guildId, `${player.name} encerrou a guilda.`);
        } else {
            await this.persistence.removeGuildMember(guildId, player.id);
            this.appendLog(guildId, `${player.name} saiu da guilda.`);
        }
        player.guildId = null;
        player.guildName = null;
        player.guildRank = null;
        this.sendSystem(player, `Voce saiu da guilda ${guildName}.`);
        await this.broadcastGuildStateForGuild(guildId);
        await this.sendGuildState(player);
    }

    async handleGuildKick(player: PlayerRuntime, msg: any) {
        const targetPlayerId = Number(msg?.targetPlayerId || 0);
        if (!Number.isInteger(targetPlayerId) || targetPlayerId <= 0) return;
        await this.hydrateGuildStateForPlayer(player);
        if (!player.guildId || !player.guildRank) return;
        const guild = await this.persistence.getGuildById(String(player.guildId || ''));
        const target = guild?.members?.find((entry: any) => Number(entry?.playerId || 0) === targetPlayerId) || null;
        if (!target || !target.player) return;
        const targetRank = this.normalizeRank(target.rank);
        if (!this.canKick(player.guildRank, targetRank, player.id === targetPlayerId)) {
            this.sendSystem(player, 'Voce nao pode expulsar esse membro.');
            return;
        }
        await this.persistence.removeGuildMember(String(player.guildId || ''), targetPlayerId);
        const onlineTarget = this.players.get(targetPlayerId) || null;
        if (onlineTarget) {
            onlineTarget.guildId = null;
            onlineTarget.guildName = null;
            onlineTarget.guildRank = null;
            this.sendSystem(onlineTarget, `Voce foi removido da guilda ${player.guildName || 'Guilda'}.`);
            await this.sendGuildState(onlineTarget);
        }
        this.appendLog(String(player.guildId || ''), `${target.player.name} foi removido da guilda.`);
        await this.broadcastGuildStateForGuild(String(player.guildId || ''));
    }

    async handleGuildSetRank(player: PlayerRuntime, msg: any) {
        const targetPlayerId = Number(msg?.targetPlayerId || 0);
        const requestedRank = this.normalizeRank(String(msg?.rank || 'member'));
        if (!Number.isInteger(targetPlayerId) || targetPlayerId <= 0) return;
        await this.hydrateGuildStateForPlayer(player);
        if (!player.guildId || player.guildRank !== 'leader') {
            this.sendSystem(player, 'Apenas o lider pode alterar ranks da guilda.');
            return;
        }
        const guild = await this.persistence.getGuildById(String(player.guildId || ''));
        const target = guild?.members?.find((entry: any) => Number(entry?.playerId || 0) === targetPlayerId) || null;
        if (!target?.player) return;
        const guildId = String(player.guildId || '');

        if (requestedRank === 'leader') {
            if (targetPlayerId === player.id) return;
            await this.persistence.updateGuildMemberRank(guildId, player.id, 'officer');
            await this.persistence.updateGuildMemberRank(guildId, targetPlayerId, 'leader');
            player.guildRank = 'officer';
            const onlineTarget = this.players.get(targetPlayerId) || null;
            if (onlineTarget) onlineTarget.guildRank = 'leader';
            this.appendLog(guildId, `${target.player.name} assumiu a lideranca da guilda.`);
        } else {
            await this.persistence.updateGuildMemberRank(guildId, targetPlayerId, requestedRank);
            if (targetPlayerId === player.id) player.guildRank = requestedRank;
            const onlineTarget = this.players.get(targetPlayerId) || null;
            if (onlineTarget) onlineTarget.guildRank = requestedRank;
            this.appendLog(guildId, `${target.player.name} agora possui rank ${this.rankLabel(requestedRank)}.`);
        }

        await this.broadcastGuildStateForGuild(guildId);
        await this.sendGuildState(player);
    }

    async pruneExpiredInvites(now: number) {
        await this.persistence.pruneExpiredGuildInvites(new Date(now));
    }

    async clearInvitesForPlayer(playerId: number) {
        await this.persistence.clearGuildInvitesForPlayer(playerId);
    }

    async broadcastGuildStateForGuild(guildId: string) {
        for (const player of this.players.values()) {
            if (String(player.guildId || '') !== String(guildId || '')) continue;
            await this.sendGuildState(player);
        }
    }

    private serializeGuild(guild: any) {
        const guildId = String(guild?.id || '');
        return {
            id: guildId,
            name: String(guild?.name || 'Guilda'),
            motd: String(guild?.motd || ''),
            memberCount: Array.isArray(guild?.members) ? guild.members.length : 0,
            members: Array.isArray(guild?.members)
                ? guild.members.map((entry: any) => ({
                    playerId: Number(entry?.playerId || 0),
                    name: String(entry?.player?.name || `#${entry?.playerId}`),
                    class: String(entry?.player?.class || 'knight'),
                    level: Number(entry?.player?.level || 1),
                    rank: this.normalizeRank(entry?.rank),
                    online: this.players.has(Number(entry?.playerId || 0))
                }))
                : [],
            activity: this.getLogs(guildId)
        };
    }

    private appendLog(guildId: string, text: string) {
        const safeGuildId = String(guildId || '');
        if (!safeGuildId) return;
        const next = [
            { at: Date.now(), text: String(text || '') },
            ...(this.guildLogs.get(safeGuildId) || [])
        ].slice(0, 20);
        this.guildLogs.set(safeGuildId, next);
    }

    private getLogs(guildId: string) {
        return (this.guildLogs.get(String(guildId || '')) || []).map((entry) => ({
            at: entry.at,
            text: entry.text
        }));
    }

    private canInvite(rank: GuildRank) {
        return rank === 'leader' || rank === 'officer';
    }

    private canKick(actorRank: GuildRank, targetRank: GuildRank, selfKick: boolean) {
        if (selfKick) return false;
        if (actorRank === 'leader') return targetRank !== 'leader';
        if (actorRank === 'officer') return targetRank === 'member';
        return false;
    }

    private normalizeRank(rank: any): GuildRank {
        const safe = String(rank || 'member').toLowerCase();
        if (safe === 'leader') return 'leader';
        if (safe === 'officer') return 'officer';
        return 'member';
    }

    private rankLabel(rank: GuildRank) {
        if (rank === 'leader') return 'Mestre';
        if (rank === 'officer') return 'Oficial';
        return 'Membro';
    }

    private sendSystem(player: PlayerRuntime, text: string) {
        this.sendRaw(player.ws, { type: 'system_message', text: String(text || '') });
    }
}
