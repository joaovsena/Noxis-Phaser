import { PlayerRuntime } from '../models/types';
type SendRawFn = (ws: any, payload: any) => void;
type BroadcastRawFn = (payload: any) => void;
export declare class ChatService {
    private readonly players;
    private readonly sendRaw;
    private readonly broadcastRaw;
    constructor(players: Map<number, PlayerRuntime>, sendRaw: SendRawFn, broadcastRaw: BroadcastRawFn);
    handleChat(player: PlayerRuntime, msg: any): void;
    private normalizeChannel;
    private findPlayerByName;
}
export {};
//# sourceMappingURL=ChatService.d.ts.map