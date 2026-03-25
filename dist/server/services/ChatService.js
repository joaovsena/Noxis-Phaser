"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const crypto_1 = require("crypto");
const config_1 = require("../config");
const math_1 = require("../utils/math");
class ChatService {
    constructor(players, sendRaw, broadcastRaw) {
        this.players = players;
        this.sendRaw = sendRaw;
        this.broadcastRaw = broadcastRaw;
    }
    handleChat(player, msg) {
        const requestedScope = String(msg.scope || 'local').trim().toLowerCase();
        const text = String(msg.text || '').trim().slice(0, 180);
        const targetName = String(msg.targetName || '').trim();
        if (!text)
            return;
        const channel = this.normalizeChannel(requestedScope);
        const payload = {
            type: 'chat_message',
            id: (0, crypto_1.randomUUID)(),
            fromId: player.id,
            scope: requestedScope,
            channel,
            from: player.name,
            mapId: player.mapId,
            mapKey: player.mapKey,
            text,
            at: Date.now(),
            ...(channel === 'whisper' && targetName ? { targetName } : {})
        };
        if (channel === 'world' || channel === 'trade') {
            this.broadcastRaw(payload);
            return;
        }
        if (channel === 'group') {
            const partyId = String(player.partyId || '');
            if (!partyId) {
                this.sendRaw(player.ws, { type: 'system_message', text: 'Voce precisa estar em um grupo para usar esse canal.' });
                return;
            }
            for (const receiver of this.players.values()) {
                if (String(receiver.partyId || '') !== partyId)
                    continue;
                this.sendRaw(receiver.ws, payload);
            }
            return;
        }
        if (channel === 'guild') {
            const guildId = String(player.guildId || '');
            if (!guildId) {
                this.sendRaw(player.ws, { type: 'system_message', text: 'Voce precisa estar em uma guilda para usar esse canal.' });
                return;
            }
            for (const receiver of this.players.values()) {
                if (String(receiver.guildId || '') !== guildId)
                    continue;
                this.sendRaw(receiver.ws, payload);
            }
            return;
        }
        if (channel === 'whisper') {
            if (!targetName) {
                this.sendRaw(player.ws, { type: 'system_message', text: 'Informe o nome do jogador para enviar o whisper.' });
                return;
            }
            const target = this.findPlayerByName(targetName);
            if (!target) {
                this.sendRaw(player.ws, { type: 'system_message', text: `Jogador ${targetName} nao encontrado para whisper.` });
                return;
            }
            this.sendRaw(player.ws, payload);
            if (target.id !== player.id)
                this.sendRaw(target.ws, payload);
            return;
        }
        if (channel === 'map') {
            this.sendRaw(player.ws, payload);
            for (const receiver of this.players.values()) {
                if (receiver.id === player.id)
                    continue;
                if (receiver.mapId !== player.mapId || receiver.mapKey !== player.mapKey)
                    continue;
                this.sendRaw(receiver.ws, payload);
            }
            return;
        }
        this.sendRaw(player.ws, payload);
        for (const receiver of this.players.values()) {
            if (receiver.id === player.id)
                continue;
            if (receiver.mapId !== player.mapId || receiver.mapKey !== player.mapKey)
                continue;
            if ((0, math_1.distance)(receiver, player) > config_1.LOCAL_CHAT_RADIUS)
                continue;
            this.sendRaw(receiver.ws, payload);
        }
    }
    normalizeChannel(scope) {
        if (scope === 'global' || scope === 'world')
            return 'world';
        if (scope === 'trade')
            return 'trade';
        if (scope === 'group' || scope === 'party')
            return 'group';
        if (scope === 'guild')
            return 'guild';
        if (scope === 'whisper')
            return 'whisper';
        if (scope === 'map')
            return 'map';
        return 'local';
    }
    findPlayerByName(name) {
        const targetName = String(name || '').trim().toLowerCase();
        if (!targetName)
            return null;
        for (const candidate of this.players.values()) {
            if (String(candidate.name || '').trim().toLowerCase() === targetName)
                return candidate;
        }
        return null;
    }
}
exports.ChatService = ChatService;
//# sourceMappingURL=ChatService.js.map