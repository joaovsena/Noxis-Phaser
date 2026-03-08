import { PlayerRuntime } from '../models/types';
type SendRawFn = (ws: any, payload: any) => void;
export declare class SkillEffectsService {
    private readonly players;
    private readonly sendRaw;
    constructor(players: Map<number, PlayerRuntime>, sendRaw: SendRawFn);
    pruneExpiredSkillEffects(player: PlayerRuntime, now?: number): void;
    hasActiveSkillEffect(player: PlayerRuntime, effectId: string, now?: number): boolean;
    removeSkillEffectById(player: PlayerRuntime, effectId: string): void;
    getActiveSkillEffectAggregate(player: PlayerRuntime, now?: number): {
        attackMul: number;
        defenseMul: number;
        magicDefenseMul: number;
        moveMul: number;
        attackSpeedMul: number;
        critAdd: number;
        evasionAdd: number;
        damageReduction: number;
        lifesteal: number;
        reflect: number;
        stealth: boolean;
    };
    applyTimedSkillEffect(player: PlayerRuntime, buff: any, now?: number): void;
    applyOnHitSkillEffects(player: PlayerRuntime, dealtDamage: number, now?: number): number;
    sendSkillEffect(mapKey: string, mapId: string, payload: any): void;
    broadcastMobHit(player: PlayerRuntime, mob: any): void;
}
export {};
//# sourceMappingURL=SkillEffectsService.d.ts.map