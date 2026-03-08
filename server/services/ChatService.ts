import { randomUUID } from 'crypto';
import { LOCAL_CHAT_RADIUS } from '../config';
import { PlayerRuntime } from '../models/types';
import { distance } from '../utils/math';

type SendRawFn = (ws: any, payload: any) => void;
type BroadcastRawFn = (payload: any) => void;

export class ChatService {
    constructor(
        private readonly players: Map<number, PlayerRuntime>,
        private readonly sendRaw: SendRawFn,
        private readonly broadcastRaw: BroadcastRawFn
    ) {}

    handleChat(player: PlayerRuntime, msg: any) {
        const scope = msg.scope === 'global' || msg.scope === 'map' ? msg.scope : 'local';
        const text = String(msg.text || '').trim();
        if (!text) return;

        const payload = {
            type: 'chat_message',
            id: randomUUID(),
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
            if (receiver.id === player.id) continue;
            if (receiver.mapId !== player.mapId || receiver.mapKey !== player.mapKey) continue;
            if (scope === 'local' && distance(receiver, player) > LOCAL_CHAT_RADIUS) continue;
            this.sendRaw(receiver.ws, payload);
        }
    }
}

