import { randomUUID } from 'crypto';
import { LOCAL_CHAT_RADIUS } from '../config';
import { PlayerRuntime } from '../models/types';
import { distance } from '../utils/math';

type SendRawFn = (ws: any, payload: any) => void;
type BroadcastRawFn = (payload: any) => void;

type ChatChannel = 'local' | 'map' | 'world' | 'trade' | 'group' | 'guild' | 'whisper';

export class ChatService {
    constructor(
        private readonly players: Map<number, PlayerRuntime>,
        private readonly sendRaw: SendRawFn,
        private readonly broadcastRaw: BroadcastRawFn
    ) {}

    handleChat(player: PlayerRuntime, msg: any) {
        const requestedScope = String(msg.scope || 'local').trim().toLowerCase();
        const text = String(msg.text || '').trim().slice(0, 180);
        const targetName = String(msg.targetName || '').trim();
        if (!text) return;

        const channel = this.normalizeChannel(requestedScope);
        const payload = {
            type: 'chat_message',
            id: randomUUID(),
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
                if (String(receiver.partyId || '') !== partyId) continue;
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
                if (String(receiver.guildId || '') !== guildId) continue;
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
            if (target.id !== player.id) this.sendRaw(target.ws, payload);
            return;
        }

        if (channel === 'map') {
            this.sendRaw(player.ws, payload);
            for (const receiver of this.players.values()) {
                if (receiver.id === player.id) continue;
                if (receiver.mapId !== player.mapId || receiver.mapKey !== player.mapKey) continue;
                this.sendRaw(receiver.ws, payload);
            }
            return;
        }

        this.sendRaw(player.ws, payload);
        for (const receiver of this.players.values()) {
            if (receiver.id === player.id) continue;
            if (receiver.mapId !== player.mapId || receiver.mapKey !== player.mapKey) continue;
            if (distance(receiver, player) > LOCAL_CHAT_RADIUS) continue;
            this.sendRaw(receiver.ws, payload);
        }
    }

    private normalizeChannel(scope: string): ChatChannel {
        if (scope === 'global' || scope === 'world') return 'world';
        if (scope === 'trade') return 'trade';
        if (scope === 'group' || scope === 'party') return 'group';
        if (scope === 'guild') return 'guild';
        if (scope === 'whisper') return 'whisper';
        if (scope === 'map') return 'map';
        return 'local';
    }

    private findPlayerByName(name: string) {
        const targetName = String(name || '').trim().toLowerCase();
        if (!targetName) return null;
        for (const candidate of this.players.values()) {
            if (String(candidate.name || '').trim().toLowerCase() === targetName) return candidate;
        }
        return null;
    }
}
