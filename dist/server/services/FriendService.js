"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FriendService = void 0;
class FriendService {
    constructor(players, persistence, sendRaw) {
        this.players = players;
        this.persistence = persistence;
        this.sendRaw = sendRaw;
        this.friendLinks = new Map();
        this.friendRequests = new Map();
        this.friendRequestWindow = new Map();
        this.lastFriendDbPruneAt = 0;
    }
    async handleFriendRequest(player, msg) {
        const byId = Number(msg?.targetPlayerId);
        const byName = String(msg?.targetName || '').trim().toLowerCase();
        let target;
        if (Number.isInteger(byId)) {
            target = this.players.get(byId);
        }
        else if (byName) {
            target = [...this.players.values()].find((candidate) => {
                const name = String(candidate.name || '').toLowerCase();
                const username = String(candidate.username || '').toLowerCase();
                return name === byName || username === byName;
            });
        }
        else {
            return;
        }
        if (!target) {
            this.sendFriendError(player, 'Jogador alvo nao esta online.');
            return;
        }
        if (target.id === player.id) {
            this.sendFriendError(player, 'Voce nao pode adicionar a si mesmo.');
            return;
        }
        if (this.areFriends(player.id, target.id)) {
            this.sendFriendError(player, 'Esse jogador ja esta na sua lista de amigos.');
            return;
        }
        if (!this.consumeFriendRequestRate(player.id)) {
            this.sendFriendError(player, 'Muitas solicitacoes de amizade. Aguarde um pouco.');
            return;
        }
        const alreadyPending = [...this.friendRequests.values()].some((req) => {
            const pairA = req.fromPlayerId === player.id && req.toPlayerId === target.id;
            const pairB = req.fromPlayerId === target.id && req.toPlayerId === player.id;
            return pairA || pairB;
        });
        const dbPending = await this.persistence.findPendingFriendRequestBetween(player.id, target.id);
        if (alreadyPending || dbPending) {
            this.sendFriendError(player, 'Ja existe solicitacao pendente entre voces.');
            return;
        }
        const now = Date.now();
        const request = {
            id: '',
            fromPlayerId: player.id,
            toPlayerId: target.id,
            createdAt: now,
            expiresAt: now + 30000
        };
        const created = await this.persistence.createFriendRequest(player.id, target.id, new Date(request.expiresAt));
        request.id = String(created.id);
        this.friendRequests.set(request.id, request);
        this.sendRaw(target.ws, {
            type: 'friend.requestReceived',
            requestId: request.id,
            fromPlayerId: player.id,
            fromName: player.name,
            expiresIn: 30000
        });
        this.sendRaw(player.ws, { type: 'system_message', text: `Solicitacao de amizade enviada para ${target.name}.` });
        this.sendFriendState(player);
        this.sendFriendState(target);
    }
    async handleFriendAccept(player, msg) {
        const requestId = String(msg.requestId || '');
        if (!requestId)
            return;
        await this.pruneExpiredFriendRequests(Date.now());
        const request = this.friendRequests.get(requestId);
        let safeRequest = request || null;
        if (!safeRequest) {
            const dbReq = await this.persistence.getPendingFriendRequestById(Number(requestId));
            if (dbReq) {
                safeRequest = {
                    id: String(dbReq.id),
                    fromPlayerId: dbReq.fromPlayerId,
                    toPlayerId: dbReq.toPlayerId,
                    createdAt: dbReq.createdAt.getTime(),
                    expiresAt: dbReq.expiresAt.getTime()
                };
                this.friendRequests.set(safeRequest.id, safeRequest);
            }
        }
        if (!safeRequest || safeRequest.toPlayerId !== player.id) {
            this.sendFriendError(player, 'Solicitacao de amizade invalida.');
            return;
        }
        const from = this.players.get(safeRequest.fromPlayerId);
        this.linkFriends(safeRequest.fromPlayerId, safeRequest.toPlayerId);
        await this.persistence.createFriendship(safeRequest.fromPlayerId, safeRequest.toPlayerId);
        await this.persistence.completeFriendRequest(Number(safeRequest.id), 'accepted');
        this.friendRequests.delete(safeRequest.id);
        if (from) {
            this.sendRaw(from.ws, { type: 'system_message', text: `${player.name} aceitou seu pedido de amizade.` });
            this.sendFriendState(from);
        }
        this.sendFriendState(player);
    }
    async handleFriendDecline(player, msg) {
        const requestId = String(msg.requestId || '');
        if (!requestId)
            return;
        let request = this.friendRequests.get(requestId) || null;
        if (!request) {
            const dbReq = await this.persistence.getPendingFriendRequestById(Number(requestId));
            if (dbReq) {
                request = {
                    id: String(dbReq.id),
                    fromPlayerId: dbReq.fromPlayerId,
                    toPlayerId: dbReq.toPlayerId,
                    createdAt: dbReq.createdAt.getTime(),
                    expiresAt: dbReq.expiresAt.getTime()
                };
                this.friendRequests.set(request.id, request);
            }
        }
        if (!request || request.toPlayerId !== player.id) {
            this.sendFriendError(player, 'Solicitacao de amizade invalida.');
            return;
        }
        const from = this.players.get(request.fromPlayerId);
        await this.persistence.completeFriendRequest(Number(request.id), 'declined');
        this.friendRequests.delete(request.id);
        if (from) {
            this.sendRaw(from.ws, { type: 'system_message', text: `${player.name} recusou seu pedido de amizade.` });
            this.sendFriendState(from);
        }
        this.sendFriendState(player);
    }
    async handleFriendRemove(player, msg) {
        const friendPlayerId = Number(msg.friendPlayerId);
        if (!Number.isInteger(friendPlayerId))
            return;
        this.unlinkFriends(player.id, friendPlayerId);
        await this.persistence.deleteFriendship(player.id, friendPlayerId);
        this.sendFriendState(player);
        const other = this.players.get(friendPlayerId);
        if (other)
            this.sendFriendState(other);
    }
    handleFriendList(player) {
        this.sendFriendState(player);
    }
    async hydrateFriendStateForPlayer(player) {
        const friendships = await this.persistence.getFriendshipsForPlayer(player.id);
        for (const fs of friendships) {
            const a = Number(fs.playerAId);
            const b = Number(fs.playerBId);
            this.linkFriends(a, b);
        }
        const pending = await this.persistence.getPendingFriendRequestsForPlayer(player.id);
        for (const req of [...pending.incoming, ...pending.outgoing]) {
            this.friendRequests.set(String(req.id), {
                id: String(req.id),
                fromPlayerId: Number(req.fromPlayerId),
                toPlayerId: Number(req.toPlayerId),
                createdAt: req.createdAt.getTime(),
                expiresAt: req.expiresAt.getTime()
            });
        }
    }
    sendFriendState(player) {
        const friends = [...this.getFriendSet(player.id)].map((friendId) => {
            const friend = this.players.get(friendId);
            return {
                playerId: friendId,
                name: friend?.name || `#${friendId}`,
                online: Boolean(friend)
            };
        });
        const incoming = [...this.friendRequests.values()]
            .filter((req) => req.toPlayerId === player.id)
            .map((req) => {
            const from = this.players.get(req.fromPlayerId);
            return {
                requestId: req.id,
                fromPlayerId: req.fromPlayerId,
                fromName: from?.name || `#${req.fromPlayerId}`,
                expiresAt: req.expiresAt
            };
        });
        const outgoing = [...this.friendRequests.values()]
            .filter((req) => req.fromPlayerId === player.id)
            .map((req) => {
            const to = this.players.get(req.toPlayerId);
            return {
                requestId: req.id,
                toPlayerId: req.toPlayerId,
                toName: to?.name || `#${req.toPlayerId}`,
                expiresAt: req.expiresAt
            };
        });
        this.sendRaw(player.ws, { type: 'friend.state', friends, incoming, outgoing });
    }
    async pruneExpiredFriendRequests(now) {
        for (const [requestId, request] of this.friendRequests.entries()) {
            if (request.expiresAt > now)
                continue;
            this.friendRequests.delete(requestId);
            const from = this.players.get(request.fromPlayerId);
            const to = this.players.get(request.toPlayerId);
            if (from)
                this.sendFriendState(from);
            if (to)
                this.sendFriendState(to);
        }
        if (now - this.lastFriendDbPruneAt >= 10000) {
            this.lastFriendDbPruneAt = now;
            await this.persistence.pruneExpiredFriendRequests(new Date(now));
        }
    }
    clearFriendRequestsForPlayer(playerId) {
        for (const [requestId, request] of this.friendRequests.entries()) {
            if (request.fromPlayerId === playerId || request.toPlayerId === playerId) {
                this.friendRequests.delete(requestId);
            }
        }
        this.friendRequestWindow.delete(playerId);
        void this.persistence.clearFriendRequestsForPlayer(playerId);
    }
    sendFriendError(player, message) {
        this.sendRaw(player.ws, { type: 'friend.error', message });
    }
    getFriendSet(playerId) {
        if (!this.friendLinks.has(playerId))
            this.friendLinks.set(playerId, new Set());
        return this.friendLinks.get(playerId);
    }
    areFriends(a, b) {
        return this.getFriendSet(a).has(b) && this.getFriendSet(b).has(a);
    }
    linkFriends(a, b) {
        this.getFriendSet(a).add(b);
        this.getFriendSet(b).add(a);
    }
    unlinkFriends(a, b) {
        this.getFriendSet(a).delete(b);
        this.getFriendSet(b).delete(a);
    }
    consumeFriendRequestRate(playerId) {
        const now = Date.now();
        const windowMs = 60000;
        const maxPerWindow = 10;
        const timestamps = (this.friendRequestWindow.get(playerId) || []).filter((ts) => now - ts <= windowMs);
        if (timestamps.length >= maxPerWindow) {
            this.friendRequestWindow.set(playerId, timestamps);
            return false;
        }
        timestamps.push(now);
        this.friendRequestWindow.set(playerId, timestamps);
        return true;
    }
}
exports.FriendService = FriendService;
//# sourceMappingURL=FriendService.js.map