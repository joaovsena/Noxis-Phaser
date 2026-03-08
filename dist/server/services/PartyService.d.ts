import { PlayerRuntime } from '../models/types';
export interface Party {
    id: string;
    leaderId: number;
    memberIds: number[];
    createdAt: number;
    areaId: string;
    maxMembers: number;
}
type SendRawFn = (ws: any, payload: any) => void;
type BroadcastRawFn = (payload: any) => void;
type PersistPlayerFn = (player: PlayerRuntime) => void | Promise<void>;
type GetAreaIdFn = (player: PlayerRuntime) => string;
export declare class PartyService {
    private readonly players;
    private readonly sendRaw;
    private readonly broadcastRaw;
    private readonly persistPlayer;
    private readonly getAreaIdForPlayer;
    private readonly parties;
    private readonly partyInvites;
    private readonly partyJoinRequests;
    constructor(players: Map<number, PlayerRuntime>, sendRaw: SendRawFn, broadcastRaw: BroadcastRawFn, persistPlayer: PersistPlayerFn, getAreaIdForPlayer: GetAreaIdFn);
    hasParty(partyId: string | null | undefined): boolean;
    arePlayersInSameParty(a: PlayerRuntime, b: PlayerRuntime): boolean;
    handlePartyCreate(player: PlayerRuntime): void;
    handlePartyInvite(player: PlayerRuntime, msg: any): void;
    handlePartyAcceptInvite(player: PlayerRuntime, msg: any): void;
    handlePartyDeclineInvite(player: PlayerRuntime, msg: any): void;
    handlePartyLeave(player: PlayerRuntime): void;
    handlePartyKick(player: PlayerRuntime, msg: any): void;
    handlePartyPromote(player: PlayerRuntime, msg: any): void;
    handlePartyRequestAreaParties(player: PlayerRuntime): void;
    handlePartyRequestJoin(player: PlayerRuntime, msg: any): void;
    handlePartyApproveJoin(player: PlayerRuntime, msg: any): void;
    handlePartyWaypointPing(player: PlayerRuntime, msg: any): void;
    sendPartyStateToPlayer(player: PlayerRuntime, party: Party | null): void;
    syncAllPartyStates(): void;
    sendPartyAreaList(player: PlayerRuntime): void;
    pruneExpiredPartyInvites(now: number): void;
    pruneExpiredPartyJoinRequests(now: number): void;
    clearPendingInvitesForPlayer(playerId: number): void;
    clearJoinRequestsForPlayer(playerId: number): void;
    clearJoinRequestsForParty(partyId: string): void;
    removePlayerFromParty(player: PlayerRuntime): void;
    private sendPartyError;
    private buildPartySnapshot;
    private syncPartyStateForMembers;
    private findOnlinePlayerByName;
}
export {};
//# sourceMappingURL=PartyService.d.ts.map