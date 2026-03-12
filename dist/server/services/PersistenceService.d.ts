import { PlayerRuntime } from '../models/types';
type SavePlayerOptions = {
    expectedVersion?: number;
    useOptimisticLock?: boolean;
};
type SavePlayerResult = {
    ok: boolean;
    version: number;
    conflict?: boolean;
};
export declare class PersistenceService {
    getUser(username: string): Promise<any>;
    getUserById(userId: string): Promise<any>;
    getPlayerByName(name: string): Promise<any>;
    createUser(username: string, password: string, profile?: any): Promise<any>;
    createPlayerForUser(userId: string, slot: number, profile: any): Promise<any>;
    savePlayer(player: PlayerRuntime, options?: SavePlayerOptions): Promise<SavePlayerResult>;
    enqueuePlayerSave(player: PlayerRuntime, reason: string, maxAttempts?: number): Promise<void>;
    processPendingPlayerSaveJobs(limit?: number): Promise<{
        processed: number;
        fetched: any;
    }>;
    getItems(): Promise<any>;
    getMobTemplates(): Promise<any>;
    getItemById(id: string): Promise<any>;
    createItem(item: any): Promise<any>;
    getFriendshipsForPlayer(playerId: number): Promise<any>;
    createFriendship(playerAId: number, playerBId: number): Promise<any>;
    deleteFriendship(playerAId: number, playerBId: number): Promise<void>;
    findPendingFriendRequestBetween(playerAId: number, playerBId: number): Promise<any>;
    createFriendRequest(fromPlayerId: number, toPlayerId: number, expiresAt: Date): Promise<any>;
    getPendingFriendRequestById(requestId: number): Promise<any>;
    getPendingFriendRequestsForPlayer(playerId: number): Promise<{
        incoming: any;
        outgoing: any;
    }>;
    completeFriendRequest(requestId: number, status: 'accepted' | 'declined'): Promise<void>;
    pruneExpiredFriendRequests(now: Date): Promise<void>;
    clearFriendRequestsForPlayer(playerId: number): Promise<void>;
    getPlayerBasicByIds(ids: number[]): Promise<any>;
    private savePlayerFromSnapshot;
}
export {};
//# sourceMappingURL=PersistenceService.d.ts.map