import { PersistenceService } from './PersistenceService';
import { PlayerRuntime } from '../models/types';
type SendRawFn = (ws: any, payload: any) => void;
export declare class FriendService {
    private readonly players;
    private readonly persistence;
    private readonly sendRaw;
    private readonly friendLinks;
    private readonly friendRequests;
    private readonly friendRequestWindow;
    private lastFriendDbPruneAt;
    constructor(players: Map<number, PlayerRuntime>, persistence: PersistenceService, sendRaw: SendRawFn);
    handleFriendRequest(player: PlayerRuntime, msg: any): Promise<void>;
    handleFriendAccept(player: PlayerRuntime, msg: any): Promise<void>;
    handleFriendDecline(player: PlayerRuntime, msg: any): Promise<void>;
    handleFriendRemove(player: PlayerRuntime, msg: any): Promise<void>;
    handleFriendList(player: PlayerRuntime): void;
    hydrateFriendStateForPlayer(player: PlayerRuntime): Promise<void>;
    sendFriendState(player: PlayerRuntime): void;
    pruneExpiredFriendRequests(now: number): Promise<void>;
    clearFriendRequestsForPlayer(playerId: number): void;
    private sendFriendError;
    private getFriendSet;
    private areFriends;
    private linkFriends;
    private unlinkFriends;
    private consumeFriendRequestRate;
}
export {};
//# sourceMappingURL=FriendService.d.ts.map