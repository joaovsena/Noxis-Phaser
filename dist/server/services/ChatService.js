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
        const scope = msg.scope === 'global' || msg.scope === 'map' ? msg.scope : 'local';
        const text = String(msg.text || '').trim();
        if (!text)
            return;
        const payload = {
            type: 'chat_message',
            id: (0, crypto_1.randomUUID)(),
            fromId: player.id,
            scope,
            from: player.name,
            mapId: player.mapId,
            mapKey: player.mapKey,
            text: text.slice(0, 180),
            at: Date.now()
        };
        if (scope === 'global') {
            this.broadcastRaw(payload);
            return;
        }
        this.sendRaw(player.ws, payload);
        for (const receiver of this.players.values()) {
            if (receiver.id === player.id)
                continue;
            if (receiver.mapId !== player.mapId || receiver.mapKey !== player.mapKey)
                continue;
            if (scope === 'local' && (0, math_1.distance)(receiver, player) > config_1.LOCAL_CHAT_RADIUS)
                continue;
            this.sendRaw(receiver.ws, payload);
        }
    }
}
exports.ChatService = ChatService;
//# sourceMappingURL=ChatService.js.map