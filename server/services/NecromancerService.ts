import { randomUUID } from 'crypto';
import type { Mob, PlayerRuntime, SummonRuntime } from '../models/types';

type SendRawFn = (ws: any, payload: any) => void;
type ResolveMobFn = (owner: PlayerRuntime, mobId: string) => Mob | null;
type ApplyDamageFn = (owner: PlayerRuntime, mob: Mob, damage: number, now: number) => void;
type SendStatsUpdatedFn = (owner: PlayerRuntime) => void;

type SummonScales = {
  damageMul: number;
  hpMul: number;
  durationMs: number;
};

const MAX_GRAVE_CHARGES = 10;
const MAX_ACTIVE_SUMMONS = 10;
const FOLLOW_BLEND_MIN = 0.08;
const FOLLOW_BLEND_MAX = 0.4;
const SUMMON_FOLLOW_DISTANCE = 150;
const SUMMON_ANCHOR_SNAP_DISTANCE = 420;
const SUMMON_ATTACK_RANGES: Record<string, number> = {
  ground: 92,
  heavy: 104,
  flying: 148,
  ranged: 248
};
const SUMMON_NEVER_EXPIRES_AT = Number.MAX_SAFE_INTEGER;

export class NecromancerService {
  private readonly summonsById = new Map<string, SummonRuntime>();

  constructor(
    private readonly players: Map<number, PlayerRuntime>,
    private readonly sendRaw: SendRawFn,
    private readonly resolveMob: ResolveMobFn,
    private readonly applyDamageToMob: ApplyDamageFn,
    private readonly sendStatsUpdated: SendStatsUpdatedFn
  ) {}

  hydratePlayer(player: PlayerRuntime) {
    player.graveCharges = Math.max(0, Math.min(MAX_GRAVE_CHARGES, Number(player.graveCharges || 0)));
    player.graveFamily = player.graveFamily ? String(player.graveFamily) : null;
    player.graveTemplateId = player.graveTemplateId ? String(player.graveTemplateId) : null;
    player.graveMapKey = player.graveMapKey ? String(player.graveMapKey) : null;
    player.activeSummonIds = Array.isArray(player.activeSummonIds) ? player.activeSummonIds.map((entry) => String(entry || '')) : [];
  }

  clearForPlayer(playerId: number) {
    const safePlayerId = Number(playerId || 0);
    for (const [id, summon] of this.summonsById.entries()) {
      if (Number(summon.ownerPlayerId || 0) !== safePlayerId) continue;
      this.summonsById.delete(id);
    }
    const owner = this.players.get(safePlayerId);
    if (owner) owner.activeSummonIds = [];
  }

  getSummonsByMap(mapKey: string, mapId: string) {
    const safeMapKey = String(mapKey || '');
    const safeMapId = String(mapId || '');
    return Array.from(this.summonsById.values()).filter((summon) =>
      String(summon.mapKey || '') === safeMapKey && String(summon.mapId || '') === safeMapId
    );
  }

  applyDamageToSummon(summonId: string, damage: number) {
    const safeId = String(summonId || '');
    const summon = this.summonsById.get(safeId);
    if (!summon) return null;
    summon.hp = Math.max(0, Number(summon.hp || 0) - Math.max(1, Math.floor(Number(damage || 0))));
    if (summon.hp > 0) return { summon, died: false };
    this.summonsById.delete(safeId);
    const owner = this.players.get(Number(summon.ownerPlayerId || 0)) || null;
    if (owner) {
      owner.activeSummonIds = (owner.activeSummonIds || []).filter((entry) => String(entry || '') !== safeId);
      this.sendStatsUpdated(owner);
      this.sendRaw(owner.ws, { type: 'system_message', text: 'Um servo necrotico foi destruido.' });
    }
    return { summon, died: true };
  }

  getActiveSummonCount(player: PlayerRuntime) {
    const ids = Array.isArray(player.activeSummonIds) ? player.activeSummonIds : [];
    return ids.filter((id) => this.summonsById.has(String(id || ''))).length;
  }

  onMobKilled(player: PlayerRuntime, mob: Mob, now: number, bonusCharges = 0) {
    if (String(player.class || '').toLowerCase() !== 'necromancer') return;
    this.hydratePlayer(player);
    const { family, templateId, charges } = this.resolveGraveImprint(player, mob, bonusCharges);
    player.graveFamily = family;
    player.graveTemplateId = templateId;
    player.graveMapKey = String(player.mapKey || '');
    player.graveCharges = charges;
    this.sendStatsUpdated(player);
    if (bonusCharges > 0) {
      this.sendRaw(player.ws, {
        type: 'system_message',
        text: `${mob.kind === 'boss' || mob.kind === 'subboss' ? 'Essencia colhida' : 'Colheita sombria'}: ${charges}/${MAX_GRAVE_CHARGES} cargas.`
      });
    }
  }

  raiseDead(player: PlayerRuntime, skillLevel: number, now: number) {
    this.hydratePlayer(player);
    const charges = Math.max(0, Math.min(MAX_GRAVE_CHARGES, Number(player.graveCharges || 0)));
    if (charges <= 0 || !player.graveFamily) {
      this.sendRaw(player.ws, { type: 'system_message', text: 'Sem cargas necroticas para invocar.' });
      return false;
    }
    const scales = this.getRaiseDeadScales(skillLevel);
    const existingSummons = this.getPlayerSummons(player.id);
    const availableSlots = Math.max(0, MAX_ACTIVE_SUMMONS - existingSummons.length);
    if (availableSlots <= 0) {
      this.sendRaw(player.ws, { type: 'system_message', text: 'Seu limite de mortos ativos ja foi alcancado.' });
      return false;
    }
    const count = Math.max(1, Math.min(availableSlots, charges));
    const sourceKind = this.extractMobKindFromFamily(player.graveFamily);
    for (let index = 0; index < count; index += 1) {
      const formationAnchor = this.getFormationAnchor(player, existingSummons.length + index);
      const summon = this.createSummon(player, {
        x: formationAnchor.x,
        y: formationAnchor.y
      }, sourceKind, scales, now);
      this.summonsById.set(summon.id, summon);
    }
    player.activeSummonIds = Array.from(this.summonsById.values())
      .filter((summon) => Number(summon.ownerPlayerId || 0) === Number(player.id || 0))
      .map((summon) => String(summon.id));
    player.graveCharges = Math.max(0, charges - count);
    if (player.graveCharges <= 0) {
      player.graveCharges = 0;
      player.graveFamily = null;
      player.graveTemplateId = null;
      player.graveMapKey = null;
    }
    this.sendRaw(player.ws, {
      type: 'system_message',
      text: `Levantar Mortos: ${count} carga${count === 1 ? '' : 's'} consumida${count === 1 ? '' : 's'} e ${count} servo${count === 1 ? '' : 's'} erguido${count === 1 ? '' : 's'}.`
    });
    this.sendStatsUpdated(player);
    return true;
  }

  commandDead(player: PlayerRuntime, targetMobId: string | null, skillLevel: number) {
    const targetId = String(targetMobId || '').trim();
    if (!targetId) {
      this.sendRaw(player.ws, { type: 'system_message', text: 'Selecione um alvo para comandar os mortos.' });
      return false;
    }
    const summons = this.getPlayerSummons(player.id);
    if (!summons.length) {
      this.sendRaw(player.ws, { type: 'system_message', text: 'Voce nao possui mortos ativos.' });
      return false;
    }
    const bonus = 1 + Math.max(0, skillLevel - 1) * 0.08;
    for (const summon of summons) {
      summon.targetMobId = targetId;
      summon.nextThinkAt = 0;
      summon.hp = Math.min(summon.maxHp, Math.round(summon.hp + 3 + skillLevel * 2));
      summon.level = Math.max(1, Math.round(summon.level * bonus));
    }
    this.sendStatsUpdated(player);
    return true;
  }

  legionCall(player: PlayerRuntime, skillLevel: number, now: number) {
    this.hydratePlayer(player);
    const addedCharges = Math.min(MAX_GRAVE_CHARGES, 2 + Math.max(0, skillLevel - 1));
    player.graveCharges = Math.min(MAX_GRAVE_CHARGES, Number(player.graveCharges || 0) + addedCharges);
    const summons = this.getPlayerSummons(player.id);
    for (const summon of summons) {
      summon.hp = Math.min(summon.maxHp, Math.round(summon.hp + 8 + skillLevel * 4));
    }
    this.sendStatsUpdated(player);
    return true;
  }

  armyOfShadows(player: PlayerRuntime, skillLevel: number, now: number) {
    const summons = this.getPlayerSummons(player.id);
    if (summons.length) {
      for (const summon of summons) {
        summon.maxHp = Math.round(summon.maxHp * (1.05 + skillLevel * 0.03));
        summon.hp = Math.min(summon.maxHp, Math.round(summon.hp + summon.maxHp * 0.2));
      }
      this.sendStatsUpdated(player);
      return true;
    }

    const fallbackCount = Math.min(3 + Math.max(0, skillLevel - 1), 6);
    const scales = {
      damageMul: 0.46 + Math.max(0, skillLevel - 1) * 0.03,
      hpMul: 0.4 + Math.max(0, skillLevel - 1) * 0.025,
      durationMs: 13000 + Math.max(0, skillLevel - 1) * 1200
    };
    this.clearForPlayer(player.id);
    for (let index = 0; index < fallbackCount; index += 1) {
      const angle = (-Math.PI / 2) + ((Math.PI * 2) / Math.max(1, fallbackCount)) * index;
      const radius = 54 + (index % 2) * 16;
      const summon = this.createSummon(player, {
        x: Number(player.x || 0) + Math.cos(angle) * radius,
        y: Number(player.y || 0) + Math.sin(angle) * radius
      }, 'shade', scales, now);
      summon.family = 'shadow_legion';
      summon.templateId = 'shadow_legion';
      summon.moveStyle = 'flying';
      this.summonsById.set(summon.id, summon);
    }
    player.activeSummonIds = this.getPlayerSummons(player.id).map((summon) => summon.id);
    this.sendStatsUpdated(player);
    return true;
  }

  tick(deltaSeconds: number, now: number) {
    const blend = Math.max(FOLLOW_BLEND_MIN, Math.min(FOLLOW_BLEND_MAX, deltaSeconds * 4.2));
    for (const [id, summon] of this.summonsById.entries()) {
      const owner = this.players.get(Number(summon.ownerPlayerId || 0));
      if (!owner) {
        this.summonsById.delete(id);
        continue;
      }

      summon.mapKey = owner.mapKey;
      summon.mapId = owner.mapId;

      const activeTarget = summon.targetMobId
        ? this.resolveMob(owner, summon.targetMobId)
        : String(owner.attackTargetId || '').trim()
          ? this.resolveMob(owner, String(owner.attackTargetId || ''))
          : null;
      if (!activeTarget || Number(activeTarget.hp || 0) <= 0) {
        summon.targetMobId = null;
      } else {
        summon.targetMobId = String(activeTarget.id || '');
        const attackRange = this.getSummonAttackRange(summon);
        const distanceToTarget = Math.hypot(Number(activeTarget.x || 0) - Number(summon.x || 0), Number(activeTarget.y || 0) - Number(summon.y || 0));
        if (distanceToTarget > attackRange) {
          this.moveSummonToward(summon, { x: Number(activeTarget.x || 0), y: Number(activeTarget.y || 0) }, blend * 1.18);
        } else if (now >= Number(summon.nextAttackAt || 0)) {
          summon.nextAttackAt = now + this.getSummonCadence(summon);
          const damage = this.computeSummonDamage(owner, summon);
          this.applyDamageToMob(owner, activeTarget, damage, now);
        }
        continue;
      }

      const followAnchor = this.getFollowAnchor(owner, summon);
      const distanceToOwner = Math.hypot(Number(owner.x || 0) - Number(summon.x || 0), Number(owner.y || 0) - Number(summon.y || 0));
      const distanceToAnchor = Math.hypot(Number(followAnchor.x || 0) - Number(summon.x || 0), Number(followAnchor.y || 0) - Number(summon.y || 0));

      if (distanceToOwner >= SUMMON_ANCHOR_SNAP_DISTANCE) {
        summon.x = followAnchor.x;
        summon.y = followAnchor.y;
        continue;
      }
      if (distanceToOwner > SUMMON_FOLLOW_DISTANCE || distanceToAnchor > 24) {
        this.moveSummonToward(summon, followAnchor, blend);
      }
    }
  }

  private createSummon(
    owner: PlayerRuntime,
    point: { x: number; y: number },
    sourceKind: string,
    scales: SummonScales,
    now: number
  ): SummonRuntime {
    const baseLevel = Math.max(1, Number(owner.level || 1));
    const kindPower = sourceKind === 'boss' ? 1.28 : sourceKind === 'subboss' ? 1.18 : sourceKind === 'elite' ? 1.08 : 1;
    const maxHp = Math.max(26, Math.round((48 + baseLevel * 11) * scales.hpMul * kindPower));
    return {
      id: `summon:${randomUUID()}`,
      ownerPlayerId: owner.id,
      ownerName: String(owner.name || 'Necromante'),
      mapKey: owner.mapKey,
      mapId: owner.mapId,
      x: Number(point.x || owner.x || 0),
      y: Number(point.y || owner.y || 0),
      hp: maxHp,
      maxHp,
      level: Math.max(1, Math.round(baseLevel * (0.72 + kindPower * 0.08))),
      family: String(owner.graveFamily || `${owner.mapKey}:normal`),
      templateId: String(owner.graveTemplateId || `${owner.mapKey}:normal`),
      sourceMobKind: sourceKind,
      moveStyle: sourceKind === 'shade' ? 'flying' : sourceKind === 'subboss' || sourceKind === 'boss' ? 'heavy' : 'ground',
      summonRole: sourceKind === 'boss' || sourceKind === 'subboss' ? 'defensive' : 'offensive',
      visualSeed: Number(owner.id || 0) * 47 + now % 997,
      summonedAt: now,
      expiresAt: SUMMON_NEVER_EXPIRES_AT,
      targetMobId: String(owner.attackTargetId || '') || null,
      homeX: Number(owner.x || 0),
      homeY: Number(owner.y || 0),
      nextThinkAt: now,
      nextAttackAt: now + 400
    };
  }

  private getFollowAnchor(owner: PlayerRuntime, summon: SummonRuntime) {
    const ownerSummons = this.getPlayerSummons(owner.id);
    const index = Math.max(0, ownerSummons.findIndex((entry) => entry.id === summon.id));
    return this.getFormationAnchor(owner, index);
  }

  private computeSummonDamage(owner: PlayerRuntime, summon: SummonRuntime) {
    const intStat = Number(owner.stats?.int || owner.baseStats?.int || 0);
    const magicAttack = Number(owner.stats?.magicAttack || 0);
    const kindMul = summon.sourceMobKind === 'boss' ? 1.16 : summon.sourceMobKind === 'subboss' ? 1.1 : summon.sourceMobKind === 'elite' ? 1.04 : 1;
    return Math.max(8, Math.round((magicAttack * 0.18 + intStat * 1.4 + summon.level * 2.2) * kindMul));
  }

  private getSummonCadence(summon: SummonRuntime) {
    if (summon.moveStyle === 'flying') return 1100;
    if (summon.moveStyle === 'heavy') return 1450;
    if (summon.moveStyle === 'ranged') return 1200;
    return 980;
  }

  private getSummonAttackRange(summon: SummonRuntime) {
    return SUMMON_ATTACK_RANGES[String(summon.moveStyle || 'ground')] || SUMMON_ATTACK_RANGES.ground;
  }

  private moveSummonToward(summon: SummonRuntime, point: { x: number; y: number }, blend: number) {
    summon.x += (Number(point.x || 0) - Number(summon.x || 0)) * blend;
    summon.y += (Number(point.y || 0) - Number(summon.y || 0)) * blend;
  }

  private getFormationAnchor(owner: PlayerRuntime, index: number) {
    const row = Math.floor(Math.max(0, index) / 3);
    const col = Math.max(0, index) % 3;
    const laneOffset = (col - 1) * 54 + (row % 2 ? 24 : 0);
    const depthOffset = 82 + row * 52;
    return {
      x: Number(owner.x || 0) + laneOffset,
      y: Number(owner.y || 0) + depthOffset
    };
  }

  private resolveGraveImprint(player: PlayerRuntime, mob: Mob, bonusCharges: number) {
    const baseCharges = mob.kind === 'boss' ? 3 : mob.kind === 'subboss' ? 2 : 1;
    const family = `${String(player.mapKey || 'forest')}:${String(mob.kind || 'normal')}`;
    const templateId = family;
    const sameFamily = String(player.graveFamily || '') === family;
    const currentCharges = sameFamily ? Number(player.graveCharges || 0) : 0;
    const charges = Math.min(MAX_GRAVE_CHARGES, currentCharges + baseCharges + Math.max(0, Number(bonusCharges || 0)));
    return { family, templateId, charges };
  }

  private getRaiseDeadScales(skillLevel: number): SummonScales {
    const level = Math.max(1, Math.min(5, Number(skillLevel || 1)));
    return {
      damageMul: 0.42 + (level - 1) * 0.04,
      hpMul: 0.38 + (level - 1) * 0.035,
      durationMs: 22000 + (level - 1) * 1500
    };
  }

  private getPlayerSummons(playerId: number) {
    const safePlayerId = Number(playerId || 0);
    return Array.from(this.summonsById.values()).filter((summon) => Number(summon.ownerPlayerId || 0) === safePlayerId);
  }

  private extractMobKindFromFamily(family: string) {
    const parts = String(family || '').split(':');
    return String(parts[parts.length - 1] || 'normal');
  }
}
