import { PlayerRuntime, SummonRuntime } from '../models/types';
type MapInstanceIdFn = (mapKey: string, mapId: string) => string;
type GetMapWorldFn = (mapKey: string) => {
    width: number;
    height: number;
};
type ProjectToWalkableFn = (mapKey: string, x: number, y: number) => {
    x: number;
    y: number;
};
type RecalcPathFn = (player: PlayerRuntime, destinationX: number, destinationY: number, now: number) => void;
type SkillAggregateFn = (player: PlayerRuntime, now: number) => any;
type ComputeHitChanceFn = (attackerAccuracy: number, defenderEvasion: number) => number;
type GetMobEvasionFn = (mob: any) => number;
type ComputeMobDamageFn = (player: PlayerRuntime, mob: any, multiplier: number, forceMagic: boolean, now: number) => number;
type ApplyDamageMobFn = (player: PlayerRuntime, mob: any, damage: number, now: number) => boolean;
type ApplyOnHitFn = (player: PlayerRuntime, dealtDamage: number, now: number) => number;
type SendStatsUpdatedFn = (player: PlayerRuntime) => void;
type BroadcastMobHitFn = (player: PlayerRuntime, mob: any) => void;
type SendRawFn = (ws: any, payload: any) => void;
type PersistPlayerFn = (player: PlayerRuntime) => void;
type SyncPartyFn = () => void;
type TryPlayerAttackFn = (player: PlayerRuntime, targetPlayerId: number, now: number, silent: boolean) => void;
type GetPvpPermissionFn = (player: PlayerRuntime, target: PlayerRuntime) => {
    ok: boolean;
    reason?: string;
};
type IsBlockedAtFn = (mapKey: string, x: number, y: number) => boolean;
type HasLineOfSightFn = (mapKey: string, fromX: number, fromY: number, toX: number, toY: number) => boolean;
type ComputeDamageAfterMitigationFn = (rawDamage: number, defense: number, targetLevel: number) => number;
type GetSummonsByMapFn = (mapKey: string, mapId: string) => SummonRuntime[];
type ApplyDamageToSummonFn = (summonId: string, damage: number) => {
    summon: SummonRuntime;
    died: boolean;
} | null;
export declare class CombatRuntimeService {
    private readonly players;
    private readonly mobService;
    private readonly mobsPeacefulMode;
    private readonly mapInstanceId;
    private readonly getMapWorld;
    private readonly projectToWalkable;
    private readonly recalculatePathToward;
    private readonly getActiveSkillEffectAggregate;
    private readonly computeHitChance;
    private readonly getMobEvasion;
    private readonly computeMobDamage;
    private readonly applyDamageToMobAndHandleDeath;
    private readonly applyOnHitSkillEffects;
    private readonly sendStatsUpdated;
    private readonly broadcastMobHit;
    private readonly sendRaw;
    private readonly persistPlayer;
    private readonly syncAllPartyStates;
    private readonly tryPlayerAttack;
    private readonly getPvpAttackPermission;
    private readonly isBlockedAt;
    private readonly hasLineOfSightFn;
    private readonly computeDamageAfterMitigation;
    private readonly getSummonsByMap;
    private readonly applyDamageToSummon;
    constructor(players: Map<number, PlayerRuntime>, mobService: any, mobsPeacefulMode: () => boolean, mapInstanceId: MapInstanceIdFn, getMapWorld: GetMapWorldFn, projectToWalkable: ProjectToWalkableFn, recalculatePathToward: RecalcPathFn, getActiveSkillEffectAggregate: SkillAggregateFn, computeHitChance: ComputeHitChanceFn, getMobEvasion: GetMobEvasionFn, computeMobDamage: ComputeMobDamageFn, applyDamageToMobAndHandleDeath: ApplyDamageMobFn, applyOnHitSkillEffects: ApplyOnHitFn, sendStatsUpdated: SendStatsUpdatedFn, broadcastMobHit: BroadcastMobHitFn, sendRaw: SendRawFn, persistPlayer: PersistPlayerFn, syncAllPartyStates: SyncPartyFn, tryPlayerAttack: TryPlayerAttackFn, getPvpAttackPermission: GetPvpPermissionFn, isBlockedAt: IsBlockedAtFn, hasLineOfSightFn: HasLineOfSightFn, computeDamageAfterMitigation: ComputeDamageAfterMitigationFn, getSummonsByMap: GetSummonsByMapFn, applyDamageToSummon: ApplyDamageToSummonFn);
    private hasLineOfSight;
    processAutoAttack(player: PlayerRuntime, now: number): void;
    processAutoAttackPlayer(player: PlayerRuntime, now: number): void;
    processMobAggroAndCombat(deltaSeconds: number, now: number): void;
    private clearPvpTarget;
    private cellKey;
    private buildPlayerSpatialIndex;
    private getPlayersNearCell;
    private randomInt;
    private pickWanderTarget;
    private moveMobToward;
}
export {};
//# sourceMappingURL=CombatRuntimeService.d.ts.map