export type SkillBuff = {
  id: string;
  durationMs: number;
  attackMul?: number;
  defenseMul?: number;
  magicDefenseMul?: number;
  moveMul?: number;
  attackSpeedMul?: number;
  critAdd?: number;
  evasionAdd?: number;
  damageReduction?: number;
  lifesteal?: number;
  reflect?: number;
  stealth?: boolean;
};

export type SkillDef = {
  id: string;
  classId: 'knight' | 'archer' | 'druid' | 'assassin';
  name: string;
  cooldownMs: number;
  target: 'mob' | 'self';
  range?: number;
  rangeStep?: number;
  power?: number;
  powerStep?: number;
  magic?: boolean;
  aoeRadius?: number;
  aoeRadiusStep?: number;
  hpCostPct?: number;
  lostHpScale?: number;
  lostHpScaleStep?: number;
  healVitScale?: number;
  healVitScaleStep?: number;
  buff?: SkillBuff;
  buffStep?: Partial<Omit<SkillBuff, 'id' | 'durationMs' | 'stealth'>>;
  effectKey?: string;
};

export const SKILL_DEFS: Record<string, SkillDef> = {
  war_bastion_escudo_fe: { id: 'war_bastion_escudo_fe', classId: 'knight', name: 'Investida de Escudo', cooldownMs: 7000, target: 'mob', range: 130, power: 1.12, powerStep: 0.11, effectKey: 'knight_shield_rush' },
  war_bastion_muralha: { id: 'war_bastion_muralha', classId: 'knight', name: 'Juramento de Ferro', cooldownMs: 13000, target: 'self', buff: { id: 'iron_oath', durationMs: 10000, defenseMul: 1.14, magicDefenseMul: 1.14, damageReduction: 0.05 }, buffStep: { defenseMul: 0.04, magicDefenseMul: 0.04, damageReduction: 0.02 }, effectKey: 'knight_iron_oath' },
  war_bastion_renovacao: { id: 'war_bastion_renovacao', classId: 'knight', name: 'Travar Terreno', cooldownMs: 10000, target: 'mob', range: 112, power: 1.0, powerStep: 0.08, aoeRadius: 140, aoeRadiusStep: 10, effectKey: 'knight_ground_lock' },
  war_bastion_inabalavel: { id: 'war_bastion_inabalavel', classId: 'knight', name: 'Guarda Reunida', cooldownMs: 16000, target: 'self', buff: { id: 'rallying_guard', durationMs: 9000, defenseMul: 1.08, magicDefenseMul: 1.08, reflect: 0.08, damageReduction: 0.08 }, buffStep: { defenseMul: 0.03, magicDefenseMul: 0.03, reflect: 0.02, damageReduction: 0.02 }, effectKey: 'knight_rally' },
  war_bastion_impacto_sismico: { id: 'war_bastion_impacto_sismico', classId: 'knight', name: 'Ultimo Bastiao', cooldownMs: 22000, target: 'self', buff: { id: 'last_bastion', durationMs: 8000, defenseMul: 1.18, magicDefenseMul: 1.18, damageReduction: 0.18, moveMul: 0.9 }, buffStep: { defenseMul: 0.05, magicDefenseMul: 0.05, damageReduction: 0.03 }, effectKey: 'knight_last_bastion' },

  war_carrasco_frenesi: { id: 'war_carrasco_frenesi', classId: 'knight', name: 'Arco Dilacerante', cooldownMs: 9000, target: 'mob', range: 110, power: 1.0, powerStep: 0.09, aoeRadius: 120, aoeRadiusStep: 10, effectKey: 'knight_cleave' },
  war_carrasco_lacerar: { id: 'war_carrasco_lacerar', classId: 'knight', name: 'Quebra-Ossos', cooldownMs: 7800, target: 'mob', range: 100, power: 1.34, powerStep: 0.12, effectKey: 'knight_bonebreaker' },
  war_carrasco_ira: { id: 'war_carrasco_ira', classId: 'knight', name: 'Rugido de Sangue', cooldownMs: 14000, target: 'self', buff: { id: 'blood_roar', durationMs: 10000, attackMul: 1.18, attackSpeedMul: 1.08, lifesteal: 0.08, defenseMul: 0.92, magicDefenseMul: 0.92 }, buffStep: { attackMul: 0.05, attackSpeedMul: 0.03, lifesteal: 0.03 }, effectKey: 'knight_blood_roar' },
  war_carrasco_golpe_sacrificio: { id: 'war_carrasco_golpe_sacrificio', classId: 'knight', name: 'Corrente de Aco', cooldownMs: 9800, target: 'mob', range: 115, power: 1.62, powerStep: 0.15, hpCostPct: 0.05, effectKey: 'knight_chain_rend' },
  war_carrasco_aniquilacao: { id: 'war_carrasco_aniquilacao', classId: 'knight', name: 'Ceifador', cooldownMs: 13500, target: 'mob', range: 120, power: 1.16, powerStep: 0.08, lostHpScale: 1.4, lostHpScaleStep: 0.12, effectKey: 'knight_headsman' },

  arc_patrulheiro_tiro_ofuscante: { id: 'arc_patrulheiro_tiro_ofuscante', classId: 'archer', name: 'Disparo Lento', cooldownMs: 6500, target: 'mob', range: 420, rangeStep: 6, power: 1.18, powerStep: 0.08, effectKey: 'archer_crippling_shot' },
  arc_patrulheiro_foco_distante: { id: 'arc_patrulheiro_foco_distante', classId: 'archer', name: 'Abrolhos', cooldownMs: 9000, target: 'mob', range: 360, power: 0.96, powerStep: 0.07, aoeRadius: 120, aoeRadiusStep: 12, effectKey: 'archer_snare' },
  arc_patrulheiro_abrolhos: { id: 'arc_patrulheiro_abrolhos', classId: 'archer', name: 'Passo do Vento', cooldownMs: 12000, target: 'self', buff: { id: 'windstep', durationMs: 9000, moveMul: 1.16, attackSpeedMul: 1.06 }, buffStep: { moveMul: 0.03, attackSpeedMul: 0.02 }, effectKey: 'archer_windstep' },
  arc_patrulheiro_salva_flechas: { id: 'arc_patrulheiro_salva_flechas', classId: 'archer', name: 'Chuva de Flechas', cooldownMs: 11000, target: 'mob', range: 430, rangeStep: 10, power: 0.98, powerStep: 0.07, aoeRadius: 185, aoeRadiusStep: 14, effectKey: 'archer_arrow_rain' },
  arc_patrulheiro_passo_vento: { id: 'arc_patrulheiro_passo_vento', classId: 'archer', name: 'Marca do Batedor', cooldownMs: 14500, target: 'self', buff: { id: 'scout_mark', durationMs: 12000, attackMul: 1.12, critAdd: 0.08 }, buffStep: { attackMul: 0.03, critAdd: 0.025 }, effectKey: 'archer_scout_mark' },

  arc_franco_flecha_debilitante: { id: 'arc_franco_flecha_debilitante', classId: 'archer', name: 'Postura de Tiro', cooldownMs: 12000, target: 'self', buff: { id: 'steady_aim', durationMs: 11000, attackMul: 1.14, critAdd: 0.1 }, buffStep: { attackMul: 0.03, critAdd: 0.03 }, effectKey: 'archer_steady_aim' },
  arc_franco_ponteira_envenenada: { id: 'arc_franco_ponteira_envenenada', classId: 'archer', name: 'Virote Corrosivo', cooldownMs: 7800, target: 'mob', range: 430, rangeStep: 8, power: 1.16, powerStep: 0.08, effectKey: 'archer_corrosive_bolt' },
  arc_franco_olho_aguia: { id: 'arc_franco_olho_aguia', classId: 'archer', name: 'Olho de Aguia', cooldownMs: 14000, target: 'self', buff: { id: 'eagle_sight', durationMs: 12000, attackMul: 1.08, critAdd: 0.16 }, buffStep: { attackMul: 0.03, critAdd: 0.03 }, effectKey: 'archer_eagle_sight' },
  arc_franco_disparo_perfurante: { id: 'arc_franco_disparo_perfurante', classId: 'archer', name: 'Flecha Perfurante', cooldownMs: 9200, target: 'mob', range: 470, rangeStep: 10, power: 1.6, powerStep: 0.13, effectKey: 'archer_piercing_arrow' },
  arc_franco_tiro_misericordia: { id: 'arc_franco_tiro_misericordia', classId: 'archer', name: 'Tiro de Misericordia', cooldownMs: 13000, target: 'mob', range: 470, rangeStep: 10, power: 1.05, powerStep: 0.06, lostHpScale: 1.5, lostHpScaleStep: 0.12, effectKey: 'archer_mercy_shot' },

  dru_preservador_florescer: { id: 'dru_preservador_florescer', classId: 'druid', name: 'Florescer', cooldownMs: 8500, target: 'self', healVitScale: 1.18, healVitScaleStep: 0.2, effectKey: 'druid_bloom' },
  dru_preservador_casca_ferro: { id: 'dru_preservador_casca_ferro', classId: 'druid', name: 'Casca Viva', cooldownMs: 12000, target: 'self', buff: { id: 'barkskin', durationMs: 10000, defenseMul: 1.12, magicDefenseMul: 1.16, damageReduction: 0.05 }, buffStep: { defenseMul: 0.03, magicDefenseMul: 0.04, damageReduction: 0.02 }, effectKey: 'druid_barkskin' },
  dru_preservador_emaranhado: { id: 'dru_preservador_emaranhado', classId: 'druid', name: 'Raizes Prendentes', cooldownMs: 9600, target: 'mob', range: 360, power: 1.02, powerStep: 0.08, magic: true, aoeRadius: 145, aoeRadiusStep: 12, effectKey: 'druid_roots' },
  dru_preservador_prece_natureza: { id: 'dru_preservador_prece_natureza', classId: 'druid', name: 'Corrente Vital', cooldownMs: 13500, target: 'self', healVitScale: 1.68, healVitScaleStep: 0.28, buff: { id: 'spirit_current', durationMs: 9000, attackSpeedMul: 1.04, moveMul: 1.04 }, buffStep: { attackSpeedMul: 0.02, moveMul: 0.02 }, effectKey: 'druid_spirit_current' },
  dru_preservador_avatar_espiritual: { id: 'dru_preservador_avatar_espiritual', classId: 'druid', name: 'Bosque Sagrado', cooldownMs: 18500, target: 'self', buff: { id: 'sanctuary_grove', durationMs: 10000, defenseMul: 1.12, magicDefenseMul: 1.12, damageReduction: 0.1 }, buffStep: { defenseMul: 0.03, magicDefenseMul: 0.03, damageReduction: 0.02 }, effectKey: 'druid_sanctuary' },

  dru_primal_espinhos: { id: 'dru_primal_espinhos', classId: 'druid', name: 'Acoite de Espinhos', cooldownMs: 7600, target: 'mob', range: 350, power: 1.28, powerStep: 0.1, magic: true, effectKey: 'druid_thorn_lash' },
  dru_primal_enxame: { id: 'dru_primal_enxame', classId: 'druid', name: 'Nuvem de Enxame', cooldownMs: 9000, target: 'mob', range: 370, power: 1.1, powerStep: 0.09, magic: true, effectKey: 'druid_swarm_cloud' },
  dru_primal_patada_sombria: { id: 'dru_primal_patada_sombria', classId: 'druid', name: 'Semente Podre', cooldownMs: 10000, target: 'mob', range: 345, power: 1.4, powerStep: 0.12, magic: true, effectKey: 'druid_rot_seed' },
  dru_primal_nevoa_obscura: { id: 'dru_primal_nevoa_obscura', classId: 'druid', name: 'Brejo Sombrio', cooldownMs: 11800, target: 'mob', range: 365, power: 1.08, powerStep: 0.08, aoeRadius: 170, aoeRadiusStep: 12, magic: true, effectKey: 'druid_mire_veil' },
  dru_primal_invocacao_primal: { id: 'dru_primal_invocacao_primal', classId: 'druid', name: 'Flor do Eclipse', cooldownMs: 16500, target: 'mob', range: 385, power: 1.86, powerStep: 0.15, magic: true, effectKey: 'druid_eclipse_bloom' },

  ass_agil_reflexos: { id: 'ass_agil_reflexos', classId: 'assassin', name: 'Estocada', cooldownMs: 6200, target: 'mob', range: 118, power: 1.18, powerStep: 0.09, effectKey: 'assassin_lunge' },
  ass_agil_contra_ataque: { id: 'ass_agil_contra_ataque', classId: 'assassin', name: 'Ripostar', cooldownMs: 9800, target: 'self', buff: { id: 'riposte', durationMs: 7000, evasionAdd: 14, reflect: 0.08 }, buffStep: { evasionAdd: 4, reflect: 0.02 }, effectKey: 'assassin_riposte' },
  ass_agil_passo_fantasma: { id: 'ass_agil_passo_fantasma', classId: 'assassin', name: 'Passo Sombrio', cooldownMs: 8000, target: 'mob', range: 230, rangeStep: 8, power: 1.32, powerStep: 0.1, effectKey: 'assassin_shadowstep' },
  ass_agil_golpe_nervos: { id: 'ass_agil_golpe_nervos', classId: 'assassin', name: 'Corte de Tendao', cooldownMs: 8600, target: 'mob', range: 125, power: 1.36, powerStep: 0.1, effectKey: 'assassin_nerve_cut' },
  ass_agil_miragem: { id: 'ass_agil_miragem', classId: 'assassin', name: 'Danca de Laminas', cooldownMs: 12500, target: 'mob', range: 135, power: 1.02, powerStep: 0.08, aoeRadius: 125, aoeRadiusStep: 10, effectKey: 'assassin_blade_dance' },

  ass_letal_expor_fraqueza: { id: 'ass_letal_expor_fraqueza', classId: 'assassin', name: 'Marca do Cacador', cooldownMs: 12000, target: 'self', buff: { id: 'hunter_mark', durationMs: 9000, critAdd: 0.14, attackMul: 1.08 }, buffStep: { critAdd: 0.03, attackMul: 0.03 }, effectKey: 'assassin_hunter_mark' },
  ass_letal_ocultar: { id: 'ass_letal_ocultar', classId: 'assassin', name: 'Veu', cooldownMs: 18000, target: 'self', buff: { id: 'ocultar', durationMs: 24000, stealth: true, moveMul: 1.08 }, buffStep: { moveMul: 0.02 }, effectKey: 'assassin_veil' },
  ass_letal_emboscada: { id: 'ass_letal_emboscada', classId: 'assassin', name: 'Emboscada', cooldownMs: 9800, target: 'mob', range: 150, power: 2.15, powerStep: 0.16, effectKey: 'assassin_ambush' },
  ass_letal_bomba_fumaca: { id: 'ass_letal_bomba_fumaca', classId: 'assassin', name: 'Cortina de Fumaca', cooldownMs: 12800, target: 'mob', range: 250, power: 1.04, powerStep: 0.08, aoeRadius: 150, aoeRadiusStep: 10, effectKey: 'assassin_smoke_screen' },
  ass_letal_sentenca: { id: 'ass_letal_sentenca', classId: 'assassin', name: 'Queda da Noite', cooldownMs: 14800, target: 'mob', range: 320, power: 1.75, powerStep: 0.14, lostHpScale: 0.85, lostHpScaleStep: 0.1, effectKey: 'assassin_nightfall' },

  mod_fire_wing: { id: 'mod_fire_wing', classId: 'druid', name: 'Asa de Fogo', cooldownMs: 8000, target: 'mob', range: 360, power: 1.8, powerStep: 0.12, magic: true, aoeRadius: 110, aoeRadiusStep: 10, effectKey: 'mod_fire_wing' },
  class_primary: { id: 'class_primary', classId: 'knight', name: 'Ataque Primario', cooldownMs: 2200, target: 'mob', range: 100, power: 1.2, powerStep: 0, effectKey: 'class_primary' }
};

export const SKILL_CHAINS: Record<string, string[]> = {
  war_bastion: ['war_bastion_escudo_fe', 'war_bastion_muralha', 'war_bastion_renovacao', 'war_bastion_inabalavel', 'war_bastion_impacto_sismico'],
  war_carrasco: ['war_carrasco_frenesi', 'war_carrasco_lacerar', 'war_carrasco_ira', 'war_carrasco_golpe_sacrificio', 'war_carrasco_aniquilacao'],
  arc_patrulheiro: ['arc_patrulheiro_tiro_ofuscante', 'arc_patrulheiro_foco_distante', 'arc_patrulheiro_abrolhos', 'arc_patrulheiro_salva_flechas', 'arc_patrulheiro_passo_vento'],
  arc_franco: ['arc_franco_flecha_debilitante', 'arc_franco_ponteira_envenenada', 'arc_franco_olho_aguia', 'arc_franco_disparo_perfurante', 'arc_franco_tiro_misericordia'],
  dru_preservador: ['dru_preservador_florescer', 'dru_preservador_casca_ferro', 'dru_preservador_emaranhado', 'dru_preservador_prece_natureza', 'dru_preservador_avatar_espiritual'],
  dru_primal: ['dru_primal_espinhos', 'dru_primal_enxame', 'dru_primal_patada_sombria', 'dru_primal_nevoa_obscura', 'dru_primal_invocacao_primal'],
  ass_agil: ['ass_agil_reflexos', 'ass_agil_contra_ataque', 'ass_agil_passo_fantasma', 'ass_agil_golpe_nervos', 'ass_agil_miragem'],
  ass_letal: ['ass_letal_expor_fraqueza', 'ass_letal_ocultar', 'ass_letal_emboscada', 'ass_letal_bomba_fumaca', 'ass_letal_sentenca']
};

export const SKILL_UNLOCK_LEVELS = [1, 10, 20, 30, 40];
