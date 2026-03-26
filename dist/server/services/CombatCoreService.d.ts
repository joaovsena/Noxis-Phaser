import { PlayerRuntime } from '../models/types';
type PermissionFn = (player: PlayerRuntime, target: PlayerRuntime) => {
    ok: boolean;
    reason?: string;
};
type SendRawFn = (ws: any, payload: any) => void;
type SkillAggregateFn = (player: PlayerRuntime, now: number) => any;
type HitChanceFn = (attackerAccuracy: number, defenderEvasion: number) => number;
type LuckyStrikeFn = (attacker: any, defender: any) => boolean;
type DamageAfterMitigationFn = (rawDamage: number, defense: number, targetLevel: number) => number;
type OnHitSkillFn = (player: PlayerRuntime, dealtDamage: number, now: number) => number;
type SendStatsFn = (player: PlayerRuntime) => void;
type PersistPlayerFn = (player: PlayerRuntime) => void;
type SyncPartyFn = () => void;
type GrantXpFn = (player: PlayerRuntime, amount: number, context?: {
    mapKey?: string;
    mapId?: string;
}) => void;
type GrantMobCurrencyFn = (player: PlayerRuntime, mob: any) => void;
type MapInstanceIdFn = (mapKey: string, mapId: string) => string;
type DropPosFn = (originX: number, originY: number, dropIndex: number, dropTotal: number, mapKey: string, mapInstanceId: string) => {
    x: number;
    y: number;
};
type PickWeaponTemplateFn = (mapKey: string, mobKind: string) => any;
type DropWeaponFn = (x: number, y: number, mapId: string, template?: any, ownerId?: number | null, ownerPartyId?: string | null, reservedMs?: number) => void;
type DropPotionFn = (x: number, y: number, mapId: string, ownerId?: number | null, ownerPartyId?: string | null, reservedMs?: number) => void;
type DropHourglassFn = (x: number, y: number, mapId: string, ownerId?: number | null, ownerPartyId?: string | null, reservedMs?: number) => void;
type HasLineOfSightFn = (mapKey: string, fromX: number, fromY: number, toX: number, toY: number) => boolean;
export declare class CombatCoreService {
    private readonly players;
    private readonly mobService;
    private readonly getPvpAttackPermission;
    private readonly sendRaw;
    private readonly getActiveSkillEffectAggregate;
    private readonly computeHitChance;
    private readonly shouldLuckyStrike;
    private readonly computeDamageAfterMitigation;
    private readonly applyOnHitSkillEffects;
    private readonly sendStatsUpdated;
    private readonly persistPlayer;
    private readonly syncAllPartyStates;
    private readonly grantXp;
    private readonly grantMobCurrency;
    private readonly mapInstanceId;
    private readonly computeLootDropPosition;
    private readonly pickRandomWeaponTemplate;
    private readonly dropWeaponAt;
    private readonly dropHpPotionAt;
    private readonly dropSkillResetHourglassAt;
    private readonly hasLineOfSight;
    constructor(players: Map<number, PlayerRuntime>, mobService: any, getPvpAttackPermission: PermissionFn, sendRaw: SendRawFn, getActiveSkillEffectAggregate: SkillAggregateFn, computeHitChance: HitChanceFn, shouldLuckyStrike: LuckyStrikeFn, computeDamageAfterMitigation: DamageAfterMitigationFn, applyOnHitSkillEffects: OnHitSkillFn, sendStatsUpdated: SendStatsFn, persistPlayer: PersistPlayerFn, syncAllPartyStates: SyncPartyFn, grantXp: GrantXpFn, grantMobCurrency: GrantMobCurrencyFn, mapInstanceId: MapInstanceIdFn, computeLootDropPosition: DropPosFn, pickRandomWeaponTemplate: PickWeaponTemplateFn, dropWeaponAt: DropWeaponFn, dropHpPotionAt: DropPotionFn, dropSkillResetHourglassAt: DropHourglassFn, hasLineOfSight: HasLineOfSightFn);
    computeMobDamage(player: PlayerRuntime, mob: any, multiplier: number, forceMagic?: boolean, now?: number): number;
    applyDamageToMobAndHandleDeath(player: PlayerRuntime, mob: any, damage: number, now: number): boolean;
    tryPlayerAttack(player: PlayerRuntime, targetPlayerId: number, now: number, silent: boolean): void;
}
export {};
//# sourceMappingURL=CombatCoreService.d.ts.map