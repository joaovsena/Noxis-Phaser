import { PlayerRuntime } from '../models/types';
type MapInstanceIdFn = (mapKey: string, mapId: string) => string;
type SendRawFn = (ws: any, payload: any) => void;
type HasPartyFn = (partyId: string | null | undefined) => boolean;
type SamePartyFn = (a: PlayerRuntime, b: PlayerRuntime) => boolean;
type TryPlayerAttackFn = (player: PlayerRuntime, targetPlayerId: number, now: number, silent: boolean) => void;
export declare class CombatService {
    private readonly players;
    private readonly mapInstanceId;
    private readonly sendRaw;
    private readonly hasParty;
    private readonly sameParty;
    private readonly tryPlayerAttack;
    constructor(players: Map<number, PlayerRuntime>, mapInstanceId: MapInstanceIdFn, sendRaw: SendRawFn, hasParty: HasPartyFn, sameParty: SamePartyFn, tryPlayerAttack: TryPlayerAttackFn);
    handleCombatTargetPlayer(player: PlayerRuntime, msg: any): void;
    handleCombatClearTarget(player: PlayerRuntime): void;
    handleCombatAttack(player: PlayerRuntime, msg: any): void;
    getPvpAttackPermission(player: PlayerRuntime, target: PlayerRuntime): {
        ok: boolean;
        reason?: string;
    };
}
export {};
//# sourceMappingURL=CombatService.d.ts.map