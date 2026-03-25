import { Buffer } from 'buffer';

export type ItemRarityId = 'branco' | 'verde' | 'azul' | 'roxo' | 'laranja';
export type ItemQualityId = 'pobre' | 'normal' | 'bom' | 'otimo' | 'excelente';
export type ClassId = 'knight' | 'archer' | 'druid' | 'assassin';
export type EquipmentSlot = 'weapon' | 'helmet' | 'chest' | 'pants' | 'gloves' | 'boots' | 'ring' | 'necklace';

type WalletLike = {
  copper?: number;
  silver?: number;
  gold?: number;
  diamond?: number;
};

export type BuiltinItemTemplate = {
  id: string;
  type: string;
  name: string;
  rarity: ItemRarityId;
  quality: ItemQualityId;
  spriteId: string;
  iconUrl: string;
  slot: string;
  requiredClass?: ClassId;
  requiredLevel?: number;
  bindingType?: 'unbound' | 'bind_on_equip' | 'bind_on_pickup';
  price?: WalletLike;
  sellPrice?: WalletLike;
  bonuses?: Record<string, number>;
  bonusPercents?: Record<string, number>;
  stackable?: boolean;
  maxStack?: number;
  healPercent?: number;
  tags?: string[];
  noSell?: boolean;
  noTrade?: boolean;
};

type ItemTierDef = {
  tier: number;
  requiredLevel: number;
  label: string;
  priceScale: number;
  dropMaps: string[];
};

type AffixScales = {
  flat: number;
  percent: number;
  price: number;
  color: string;
  label: string;
};

const RARITY_ORDER: ItemRarityId[] = ['branco', 'verde', 'azul', 'roxo', 'laranja'];
const QUALITY_ORDER: ItemQualityId[] = ['pobre', 'normal', 'bom', 'otimo', 'excelente'];

export const ITEM_RARITY_DEFS: Record<ItemRarityId, AffixScales> = {
  branco: { flat: 1, percent: 0.0, price: 1, color: '#e8e1d3', label: 'Branco' },
  verde: { flat: 1.12, percent: 0.025, price: 1.18, color: '#7cd96a', label: 'Verde' },
  azul: { flat: 1.28, percent: 0.055, price: 1.42, color: '#69a8ff', label: 'Azul' },
  roxo: { flat: 1.46, percent: 0.095, price: 1.84, color: '#ba78ff', label: 'Roxo' },
  laranja: { flat: 1.72, percent: 0.145, price: 2.4, color: '#ff9e4b', label: 'Laranja' }
};

export const ITEM_QUALITY_DEFS: Record<ItemQualityId, AffixScales> = {
  pobre: { flat: 0.88, percent: -0.01, price: 0.72, color: '#7b6d5d', label: 'Pobre' },
  normal: { flat: 1, percent: 0, price: 1, color: '#c3b9a1', label: 'Normal' },
  bom: { flat: 1.1, percent: 0.018, price: 1.16, color: '#d9c987', label: 'Bom' },
  otimo: { flat: 1.21, percent: 0.032, price: 1.34, color: '#f0d49e', label: 'Otimo' },
  excelente: { flat: 1.34, percent: 0.05, price: 1.62, color: '#fff2c9', label: 'Excelente' }
};

const ITEM_TIERS: ItemTierDef[] = [
  { tier: 1, requiredLevel: 1, label: 'Aprendiz', priceScale: 1, dropMaps: ['city', 'forest'] },
  { tier: 2, requiredLevel: 5, label: 'Explorador', priceScale: 1.8, dropMaps: ['forest', 'lava'] },
  { tier: 3, requiredLevel: 10, label: 'Veterano', priceScale: 3.2, dropMaps: ['lava', 'undead'] },
  { tier: 4, requiredLevel: 15, label: 'Ascendente', priceScale: 5.3, dropMaps: ['undead'] }
];

const CLASS_THEME: Record<ClassId, {
  title: string;
  accent: string;
  weaponTitle: string;
  weaponShape: 'sword' | 'bow' | 'staff' | 'dagger';
  relevantStats: string[];
  weaponFlat: Record<string, number>;
  armorFlat: Record<Exclude<EquipmentSlot, 'weapon'>, Record<string, number>>;
  percentStats: string[];
}> = {
  knight: {
    title: 'Cavaleiro',
    accent: '#d5aa69',
    weaponTitle: 'Lamina do Bastiao',
    weaponShape: 'sword',
    relevantStats: ['physicalAttack', 'physicalDefense', 'maxHp', 'accuracy'],
    weaponFlat: { physicalAttack: 8, physicalDefense: 3, accuracy: 2 },
    armorFlat: {
      helmet: { physicalDefense: 5, maxHp: 16 },
      chest: { physicalDefense: 9, maxHp: 34 },
      pants: { physicalDefense: 7, maxHp: 26 },
      gloves: { physicalDefense: 3, accuracy: 4 },
      boots: { physicalDefense: 3, moveSpeed: 8 },
      ring: { physicalAttack: 4, maxHp: 18 },
      necklace: { physicalDefense: 3, maxHp: 28 }
    },
    percentStats: ['physicalDefense', 'maxHp', 'physicalAttack']
  },
  archer: {
    title: 'Arqueiro',
    accent: '#9fcb72',
    weaponTitle: 'Arco do Vigia',
    weaponShape: 'bow',
    relevantStats: ['physicalAttack', 'accuracy', 'attackSpeed', 'evasion'],
    weaponFlat: { physicalAttack: 7, accuracy: 6, attackSpeed: 7 },
    armorFlat: {
      helmet: { evasion: 5, accuracy: 4 },
      chest: { physicalDefense: 4, evasion: 7, maxHp: 18 },
      pants: { physicalDefense: 4, evasion: 6, attackSpeed: 4 },
      gloves: { physicalAttack: 3, accuracy: 5, attackSpeed: 6 },
      boots: { evasion: 5, moveSpeed: 10 },
      ring: { physicalAttack: 4, accuracy: 4 },
      necklace: { attackSpeed: 5, maxHp: 16, accuracy: 4 }
    },
    percentStats: ['physicalAttack', 'accuracy', 'attackSpeed']
  },
  druid: {
    title: 'Druida',
    accent: '#6bc8bb',
    weaponTitle: 'Cajado do Crescente',
    weaponShape: 'staff',
    relevantStats: ['magicAttack', 'magicDefense', 'maxHp', 'attackSpeed'],
    weaponFlat: { magicAttack: 9, magicDefense: 3, attackSpeed: 4 },
    armorFlat: {
      helmet: { magicDefense: 5, maxHp: 14 },
      chest: { magicDefense: 8, maxHp: 30 },
      pants: { magicDefense: 6, maxHp: 24 },
      gloves: { magicAttack: 3, attackSpeed: 4 },
      boots: { magicDefense: 3, moveSpeed: 8 },
      ring: { magicAttack: 4, magicDefense: 2 },
      necklace: { magicAttack: 3, maxHp: 24, magicDefense: 3 }
    },
    percentStats: ['magicAttack', 'magicDefense', 'maxHp']
  },
  assassin: {
    title: 'Assassino',
    accent: '#cf6a8c',
    weaponTitle: 'Adagas do Eclipse',
    weaponShape: 'dagger',
    relevantStats: ['physicalAttack', 'attackSpeed', 'evasion', 'accuracy'],
    weaponFlat: { physicalAttack: 7, attackSpeed: 9, accuracy: 4 },
    armorFlat: {
      helmet: { evasion: 4, accuracy: 4 },
      chest: { physicalDefense: 3, evasion: 7, maxHp: 16 },
      pants: { physicalDefense: 3, evasion: 6, attackSpeed: 4 },
      gloves: { physicalAttack: 4, attackSpeed: 6 },
      boots: { moveSpeed: 10, evasion: 5 },
      ring: { physicalAttack: 4, attackSpeed: 4 },
      necklace: { accuracy: 5, evasion: 4, maxHp: 14 }
    },
    percentStats: ['physicalAttack', 'attackSpeed', 'evasion']
  }
};

const SLOT_LABELS: Record<EquipmentSlot, string> = {
  weapon: 'Arma',
  helmet: 'Capacete',
  chest: 'Peitoral',
  pants: 'Calcas',
  gloves: 'Luvas',
  boots: 'Botas',
  ring: 'Anel',
  necklace: 'Colar'
};

function svgDataUrl(svg: string) {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

function toWallet(copper: number): WalletLike {
  const safe = Math.max(0, Math.floor(Number(copper || 0)));
  const gold = Math.floor(safe / 10000);
  const silver = Math.floor((safe % 10000) / 100);
  const restCopper = safe % 100;
  return { copper: restCopper, silver, gold, diamond: 0 };
}

function clampPercent(value: number) {
  return Math.max(-0.05, Math.min(0.4, Number(value || 0)));
}

function roundStat(value: number) {
  return Math.max(1, Math.round(Number(value || 0)));
}

function formatQualityLabel(quality: ItemQualityId) {
  return ITEM_QUALITY_DEFS[quality].label;
}

function formatRarityLabel(rarity: ItemRarityId) {
  return ITEM_RARITY_DEFS[rarity].label;
}

function scaleFlatBonuses(base: Record<string, number>, rarity: ItemRarityId, quality: ItemQualityId, tier: ItemTierDef) {
  const rarityMul = ITEM_RARITY_DEFS[rarity].flat;
  const qualityMul = ITEM_QUALITY_DEFS[quality].flat;
  const tierMul = 0.82 + tier.tier * 0.58;
  return Object.fromEntries(
    Object.entries(base).map(([key, value]) => [
      key,
      roundStat(Number(value || 0) * rarityMul * qualityMul * tierMul)
    ])
  );
}

function buildPercentBonuses(classId: ClassId, slot: EquipmentSlot, rarity: ItemRarityId, quality: ItemQualityId) {
  const percent = clampPercent((ITEM_RARITY_DEFS[rarity].percent * 0.9) + (ITEM_QUALITY_DEFS[quality].percent * 0.8));
  if (percent <= 0) return {};
  const profile = CLASS_THEME[classId];
  const targets = slot === 'weapon'
    ? profile.percentStats.slice(0, 2)
    : profile.percentStats.slice(slot === 'ring' || slot === 'necklace' ? 0 : 1, slot === 'ring' || slot === 'necklace' ? 2 : 3);
  return Object.fromEntries(targets.map((key, index) => [key, Number((percent * (index === 0 ? 1 : 0.62)).toFixed(3))]));
}

function buildPrice(baseCopper: number, rarity: ItemRarityId, quality: ItemQualityId, tier: ItemTierDef) {
  const copper = Math.round(baseCopper * tier.priceScale * ITEM_RARITY_DEFS[rarity].price * ITEM_QUALITY_DEFS[quality].price);
  const sellCopper = Math.max(1, Math.round(copper * 0.34));
  return {
    price: toWallet(copper),
    sellPrice: toWallet(sellCopper)
  };
}

function itemFrame(rarity: ItemRarityId, quality: ItemQualityId) {
  const rarityColor = ITEM_RARITY_DEFS[rarity].color;
  const qualityColor = ITEM_QUALITY_DEFS[quality].color;
  return `
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1b1713"/>
        <stop offset="100%" stop-color="#090909"/>
      </linearGradient>
      <linearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="${qualityColor}"/>
        <stop offset="100%" stop-color="${rarityColor}"/>
      </linearGradient>
    </defs>
    <rect x="3" y="3" width="58" height="58" rx="11" fill="url(#bg)" stroke="url(#rim)" stroke-width="3"/>
    <rect x="9" y="9" width="46" height="46" rx="8" fill="rgba(255,255,255,0.02)" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
  `;
}

function createItemIcon(shape: string, rarity: ItemRarityId, quality: ItemQualityId, accent: string, detail = '#f4ddab') {
  const glyph = (() => {
    if (shape === 'sword') return `
      <path d="M33 14 L39 20 L32 27 L36 31 L31 36 L25 30 L16 39 L13 36 L22 27 L16 21 Z" fill="${detail}" stroke="${accent}" stroke-width="2"/>
      <rect x="28" y="36" width="6" height="9" rx="2" fill="${accent}"/>
    `;
    if (shape === 'bow') return `
      <path d="M19 16 C39 22,39 42,19 48" fill="none" stroke="${detail}" stroke-width="4" stroke-linecap="round"/>
      <path d="M22 18 C35 24,35 40,22 46" fill="none" stroke="${accent}" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="18" y1="16" x2="18" y2="48" stroke="${detail}" stroke-width="2"/>
      <line x1="18" y1="20" x2="41" y2="32" stroke="${accent}" stroke-width="2.5"/>
      <polygon points="42,32 35,28 36,35" fill="${accent}"/>
    `;
    if (shape === 'staff') return `
      <circle cx="33" cy="18" r="8" fill="${accent}" stroke="${detail}" stroke-width="2"/>
      <path d="M33 26 L33 48" stroke="${detail}" stroke-width="4" stroke-linecap="round"/>
      <path d="M25 23 C26 28,40 28,41 23" fill="none" stroke="${accent}" stroke-width="2"/>
      <circle cx="33" cy="18" r="3" fill="${detail}"/>
    `;
    if (shape === 'dagger') return `
      <path d="M32 14 L40 24 L34 28 L38 32 L31 39 L25 33 L27 28 L21 24 Z" fill="${detail}" stroke="${accent}" stroke-width="2"/>
      <rect x="28" y="38" width="6" height="8" rx="2" fill="${accent}"/>
    `;
    if (shape === 'helmet') return `
      <path d="M19 39 C19 25,24 18,32 18 C40 18,45 25,45 39 Z" fill="${detail}" stroke="${accent}" stroke-width="2.5"/>
      <rect x="26" y="28" width="12" height="10" rx="2" fill="${accent}" opacity="0.85"/>
    `;
    if (shape === 'chest') return `
      <path d="M20 18 L44 18 L48 28 L44 48 L20 48 L16 28 Z" fill="${detail}" stroke="${accent}" stroke-width="2.5"/>
      <path d="M20 27 L44 27" stroke="${accent}" stroke-width="2"/>
    `;
    if (shape === 'pants') return `
      <path d="M20 18 L44 18 L40 48 L32 48 L30 34 L28 48 L20 48 Z" fill="${detail}" stroke="${accent}" stroke-width="2.5"/>
    `;
    if (shape === 'gloves') return `
      <path d="M22 24 L29 18 L34 25 L39 20 L44 28 L36 44 L23 40 Z" fill="${detail}" stroke="${accent}" stroke-width="2.5"/>
    `;
    if (shape === 'boots') return `
      <path d="M22 22 L31 22 L32 37 L43 39 L43 45 L20 45 L20 39 L24 36 Z" fill="${detail}" stroke="${accent}" stroke-width="2.5"/>
    `;
    if (shape === 'ring') return `
      <circle cx="32" cy="32" r="11" fill="none" stroke="${detail}" stroke-width="6"/>
      <circle cx="32" cy="20" r="5" fill="${accent}" stroke="${detail}" stroke-width="1.5"/>
    `;
    if (shape === 'necklace') return `
      <path d="M20 21 C22 31,42 31,44 21" fill="none" stroke="${detail}" stroke-width="4" stroke-linecap="round"/>
      <path d="M28 26 L36 26 L32 40 Z" fill="${accent}" stroke="${detail}" stroke-width="2"/>
    `;
    if (shape === 'potion') return `
      <path d="M25 16 H39 V22 L43 27 V44 A4 4 0 0 1 39 48 H25 A4 4 0 0 1 21 44 V27 L25 22 Z" fill="${accent}" stroke="${detail}" stroke-width="2.5"/>
      <path d="M25 18 H39" stroke="${detail}" stroke-width="2"/>
      <path d="M24 34 H40" stroke="${detail}" stroke-width="2" opacity="0.8"/>
    `;
    if (shape === 'hourglass') return `
      <path d="M22 16 H42 M24 18 C24 26,31 27,32 32 C31 37,24 38,24 46 M40 18 C40 26,33 27,32 32 C33 37,40 38,40 46 M22 48 H42" fill="none" stroke="${detail}" stroke-width="3" stroke-linecap="round"/>
      <path d="M28 22 H36 L33 28 L31 28 Z" fill="${accent}"/>
      <path d="M28 42 H36 L33 36 L31 36 Z" fill="${accent}"/>
    `;
    return `
      <path d="M18 40 L28 17 H37 L47 40 L33 47 Z" fill="${accent}" stroke="${detail}" stroke-width="2.5"/>
      <circle cx="32" cy="29" r="5" fill="${detail}" opacity="0.85"/>
    `;
  })();
  return svgDataUrl(`
    <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      ${itemFrame(rarity, quality)}
      ${glyph}
    </svg>
  `);
}

function createWeaponTemplate(classId: ClassId, tier: ItemTierDef, rarity: ItemRarityId, quality: ItemQualityId): BuiltinItemTemplate {
  const profile = CLASS_THEME[classId];
  const bonuses = scaleFlatBonuses(profile.weaponFlat, rarity, quality, tier);
  const bonusPercents = buildPercentBonuses(classId, 'weapon', rarity, quality);
  const pricing = buildPrice(420 + tier.tier * 210, rarity, quality, tier);
  return {
    id: `weapon_${classId}_t${tier.tier}_${rarity}_${quality}`,
    type: 'weapon',
    name: `${profile.weaponTitle} ${tier.label} ${formatRarityLabel(rarity)}/${formatQualityLabel(quality)}`,
    rarity,
    quality,
    spriteId: `weapon_${classId}_${tier.tier}`,
    iconUrl: createItemIcon(profile.weaponShape, rarity, quality, profile.accent),
    slot: 'weapon',
    requiredClass: classId,
    requiredLevel: tier.requiredLevel,
    bindingType: 'unbound',
    ...pricing,
    bonuses,
    bonusPercents,
    tags: ['gear', 'weapon', classId, `tier-${tier.tier}`]
  };
}

function createArmorTemplate(classId: ClassId, slot: Exclude<EquipmentSlot, 'weapon'>, tier: ItemTierDef, rarity: ItemRarityId, quality: ItemQualityId): BuiltinItemTemplate {
  const profile = CLASS_THEME[classId];
  const bonuses = scaleFlatBonuses(profile.armorFlat[slot], rarity, quality, tier);
  const bonusPercents = buildPercentBonuses(classId, slot, rarity, quality);
  const baseCopperBySlot: Record<Exclude<EquipmentSlot, 'weapon'>, number> = {
    helmet: 210,
    chest: 320,
    pants: 280,
    gloves: 170,
    boots: 170,
    ring: 240,
    necklace: 260
  };
  const pricing = buildPrice(baseCopperBySlot[slot] + tier.tier * 95, rarity, quality, tier);
  const shape = slot === 'ring' ? 'ring' : slot === 'necklace' ? 'necklace' : slot;
  return {
    id: `equip_${classId}_${slot}_t${tier.tier}_${rarity}_${quality}`,
    type: 'equipment',
    name: `${SLOT_LABELS[slot]} ${profile.title} ${tier.label} ${formatRarityLabel(rarity)}/${formatQualityLabel(quality)}`,
    rarity,
    quality,
    spriteId: `${slot}_${classId}_${tier.tier}`,
    iconUrl: createItemIcon(shape, rarity, quality, profile.accent),
    slot,
    requiredClass: classId,
    requiredLevel: tier.requiredLevel,
    bindingType: 'unbound',
    ...pricing,
    bonuses,
    bonusPercents,
    tags: ['gear', slot, classId, `tier-${tier.tier}`]
  };
}

function createMaterialTemplate(id: string, name: string, shape: string, rarity: ItemRarityId, accent: string, priceCopper: number, mapTag: string): BuiltinItemTemplate {
  return {
    id,
    type: 'material',
    name,
    rarity,
    quality: 'normal',
    spriteId: id,
    iconUrl: createItemIcon(shape, rarity, 'normal', accent),
    slot: 'material',
    bindingType: 'unbound',
    price: toWallet(priceCopper),
    sellPrice: toWallet(Math.max(1, Math.round(priceCopper * 0.5))),
    bonuses: {},
    stackable: true,
    maxStack: 250,
    tags: ['material', mapTag]
  };
}

const GENERATED_WEAPON_TEMPLATES = ITEM_TIERS.flatMap((tier) =>
  (Object.keys(CLASS_THEME) as ClassId[]).flatMap((classId) =>
    RARITY_ORDER.flatMap((rarity) => QUALITY_ORDER.map((quality) => createWeaponTemplate(classId, tier, rarity, quality)))
  )
);

const GENERATED_ARMOR_TEMPLATES = ITEM_TIERS.flatMap((tier) =>
  (Object.keys(CLASS_THEME) as ClassId[]).flatMap((classId) =>
    (['helmet', 'chest', 'pants', 'gloves', 'boots', 'ring', 'necklace'] as Array<Exclude<EquipmentSlot, 'weapon'>>)
      .flatMap((slot) => RARITY_ORDER.flatMap((rarity) => QUALITY_ORDER.map((quality) => createArmorTemplate(classId, slot, tier, rarity, quality))))
  )
);

export const HP_POTION_TEMPLATE: BuiltinItemTemplate = {
  id: 'potion_hp',
  type: 'potion_hp',
  name: 'Pocao Rubra Menor',
  rarity: 'branco',
  quality: 'normal',
  spriteId: 'potion_hp_minor',
  iconUrl: createItemIcon('potion', 'branco', 'normal', '#d35a4f'),
  slot: 'consumable',
  bindingType: 'unbound',
  price: toWallet(48),
  sellPrice: toWallet(18),
  bonuses: {},
  stackable: true,
  maxStack: 250,
  healPercent: 0.32,
  tags: ['consumable', 'potion']
};

export const HP_POTION_MAJOR_TEMPLATE: BuiltinItemTemplate = {
  id: 'potion_hp_major',
  type: 'potion_hp',
  name: 'Pocao Rubra Maior',
  rarity: 'verde',
  quality: 'bom',
  spriteId: 'potion_hp_major',
  iconUrl: createItemIcon('potion', 'verde', 'bom', '#d35a4f'),
  slot: 'consumable',
  bindingType: 'unbound',
  price: toWallet(210),
  sellPrice: toWallet(84),
  bonuses: {},
  stackable: true,
  maxStack: 250,
  healPercent: 0.56,
  tags: ['consumable', 'potion']
};

export const SKILL_RESET_HOURGLASS_TEMPLATE: BuiltinItemTemplate = {
  id: 'skill_reset_hourglass',
  type: 'skill_reset_hourglass',
  name: 'Ampulheta de Habilidades',
  rarity: 'roxo',
  quality: 'normal',
  spriteId: 'hourglass',
  iconUrl: createItemIcon('hourglass', 'roxo', 'normal', '#c694ff'),
  slot: 'consumable',
  bindingType: 'unbound',
  price: toWallet(3800),
  sellPrice: toWallet(1200),
  bonuses: {},
  stackable: true,
  maxStack: 50,
  noSell: true,
  tags: ['consumable', 'utility']
};

const MATERIAL_TEMPLATES: BuiltinItemTemplate[] = [
  createMaterialTemplate('material_forest_hide', 'Couro da Fronteira', 'boots', 'branco', '#8b5c34', 35, 'forest'),
  createMaterialTemplate('material_forest_sap', 'Seiva Serena', 'staff', 'verde', '#5cab73', 62, 'forest'),
  createMaterialTemplate('material_lava_ember', 'Brasa Condensada', 'gem', 'azul', '#ff7a4e', 145, 'lava'),
  createMaterialTemplate('material_lava_ore', 'Minerio Vulcanico', 'chest', 'verde', '#b57554', 120, 'lava'),
  createMaterialTemplate('material_undead_bone', 'Osso Consagrado', 'dagger', 'azul', '#d7d7e3', 168, 'undead'),
  createMaterialTemplate('material_undead_ectoplasm', 'Ectoplasma Denso', 'ring', 'roxo', '#8fb7ff', 240, 'undead')
];

const STARTER_ALIAS_IDS: Array<{ alias: string; target: string }> = [
  { alias: 'equip_knight_helmet', target: 'equip_knight_helmet_t1_branco_normal' },
  { alias: 'equip_knight_chest', target: 'equip_knight_chest_t1_verde_normal' },
  { alias: 'equip_knight_pants', target: 'equip_knight_pants_t1_branco_normal' },
  { alias: 'equip_knight_gloves', target: 'equip_knight_gloves_t1_branco_normal' },
  { alias: 'equip_knight_boots', target: 'equip_knight_boots_t1_branco_normal' },
  { alias: 'equip_knight_ring', target: 'equip_knight_ring_t1_verde_bom' },
  { alias: 'equip_knight_necklace', target: 'equip_knight_necklace_t1_verde_normal' },
  { alias: 'equip_archer_helmet', target: 'equip_archer_helmet_t1_branco_normal' },
  { alias: 'equip_archer_chest', target: 'equip_archer_chest_t1_verde_normal' },
  { alias: 'equip_archer_pants', target: 'equip_archer_pants_t1_branco_normal' },
  { alias: 'equip_archer_gloves', target: 'equip_archer_gloves_t1_verde_normal' },
  { alias: 'equip_archer_boots', target: 'equip_archer_boots_t1_branco_bom' },
  { alias: 'equip_archer_ring', target: 'equip_archer_ring_t1_verde_bom' },
  { alias: 'equip_archer_necklace', target: 'equip_archer_necklace_t1_verde_normal' },
  { alias: 'equip_druid_helmet', target: 'equip_druid_helmet_t1_branco_normal' },
  { alias: 'equip_druid_chest', target: 'equip_druid_chest_t1_verde_normal' },
  { alias: 'equip_druid_pants', target: 'equip_druid_pants_t1_branco_normal' },
  { alias: 'equip_druid_gloves', target: 'equip_druid_gloves_t1_verde_normal' },
  { alias: 'equip_druid_boots', target: 'equip_druid_boots_t1_branco_normal' },
  { alias: 'equip_druid_ring', target: 'equip_druid_ring_t1_verde_bom' },
  { alias: 'equip_druid_necklace', target: 'equip_druid_necklace_t1_verde_normal' },
  { alias: 'equip_assassin_helmet', target: 'equip_assassin_helmet_t1_branco_normal' },
  { alias: 'equip_assassin_chest', target: 'equip_assassin_chest_t1_verde_normal' },
  { alias: 'equip_assassin_pants', target: 'equip_assassin_pants_t1_branco_normal' },
  { alias: 'equip_assassin_gloves', target: 'equip_assassin_gloves_t1_verde_normal' },
  { alias: 'equip_assassin_boots', target: 'equip_assassin_boots_t1_branco_bom' },
  { alias: 'equip_assassin_ring', target: 'equip_assassin_ring_t1_verde_bom' },
  { alias: 'equip_assassin_necklace', target: 'equip_assassin_necklace_t1_verde_normal' }
];

export const WEAPON_TEMPLATE: BuiltinItemTemplate = GENERATED_WEAPON_TEMPLATES.find((entry) => entry.id === 'weapon_knight_t1_branco_normal') || GENERATED_WEAPON_TEMPLATES[0];
export const WEAPON_TEMPLATE_RUBI: BuiltinItemTemplate = GENERATED_WEAPON_TEMPLATES.find((entry) => entry.id === 'weapon_knight_t2_roxo_bom') || GENERATED_WEAPON_TEMPLATES[0];
export const WEAPON_TEMPLATES = GENERATED_WEAPON_TEMPLATES;
export const CLASS_EQUIPMENT_TEMPLATES = GENERATED_ARMOR_TEMPLATES.filter((entry) => entry.id.includes('_t1_'));

export const BUILTIN_ITEM_TEMPLATES: BuiltinItemTemplate[] = [
  ...GENERATED_WEAPON_TEMPLATES,
  ...GENERATED_ARMOR_TEMPLATES,
  HP_POTION_TEMPLATE,
  HP_POTION_MAJOR_TEMPLATE,
  SKILL_RESET_HOURGLASS_TEMPLATE,
  ...MATERIAL_TEMPLATES
];

export const BUILTIN_ITEM_TEMPLATE_BY_ID: Record<string, BuiltinItemTemplate> = BUILTIN_ITEM_TEMPLATES.reduce((acc: Record<string, BuiltinItemTemplate>, template) => {
  acc[String(template.id)] = template;
  if (template.type === 'potion_hp' || template.type === 'skill_reset_hourglass') {
    acc[String(template.type)] = template;
  }
  return acc;
}, {});

for (const { alias, target } of STARTER_ALIAS_IDS) {
  const template = BUILTIN_ITEM_TEMPLATE_BY_ID[target];
  if (template) BUILTIN_ITEM_TEMPLATE_BY_ID[alias] = { ...template, id: alias, tags: [...(template.tags || []), 'legacy-alias'] };
}

BUILTIN_ITEM_TEMPLATE_BY_ID.weapon_teste = {
  ...BUILTIN_ITEM_TEMPLATE_BY_ID.weapon_knight_t1_branco_normal,
  id: 'weapon_teste',
  name: 'Lamina de Treino',
  requiredClass: 'knight'
};

export function resolveClassEquipmentTemplateId(classId: string, slot: string, tier: number = 1, rarity: ItemRarityId = 'verde', quality: ItemQualityId = 'normal') {
  const safeClass = (Object.keys(CLASS_THEME) as ClassId[]).includes(classId as ClassId) ? classId as ClassId : 'knight';
  const safeSlot = (['helmet', 'chest', 'pants', 'gloves', 'boots', 'ring', 'necklace'] as string[]).includes(slot) ? slot : 'chest';
  return `equip_${safeClass}_${safeSlot}_t${Math.max(1, Math.min(4, Number(tier || 1)))}_${rarity}_${quality}`;
}

export function resolveClassWeaponTemplateId(classId: string, tier: number = 1, rarity: ItemRarityId = 'verde', quality: ItemQualityId = 'normal') {
  const safeClass = (Object.keys(CLASS_THEME) as ClassId[]).includes(classId as ClassId) ? classId as ClassId : 'knight';
  return `weapon_${safeClass}_t${Math.max(1, Math.min(4, Number(tier || 1)))}_${rarity}_${quality}`;
}

function pickWeighted<T>(entries: Array<{ value: T; weight: number }>) {
  const total = entries.reduce((sum, entry) => sum + Math.max(0, Number(entry.weight || 0)), 0);
  if (total <= 0) return entries[0]?.value;
  let roll = Math.random() * total;
  for (const entry of entries) {
    roll -= Math.max(0, Number(entry.weight || 0));
    if (roll <= 0) return entry.value;
  }
  return entries[entries.length - 1]?.value;
}

function pickRarityForMobKind(kind: string): ItemRarityId {
  const safe = String(kind || 'normal');
  if (safe === 'boss') return pickWeighted<ItemRarityId>([{ value: 'azul', weight: 32 }, { value: 'roxo', weight: 42 }, { value: 'laranja', weight: 26 }]) || 'roxo';
  if (safe === 'subboss') return pickWeighted<ItemRarityId>([{ value: 'verde', weight: 28 }, { value: 'azul', weight: 42 }, { value: 'roxo', weight: 24 }, { value: 'laranja', weight: 6 }]) || 'azul';
  if (safe === 'elite') return pickWeighted<ItemRarityId>([{ value: 'branco', weight: 12 }, { value: 'verde', weight: 42 }, { value: 'azul', weight: 32 }, { value: 'roxo', weight: 14 }]) || 'verde';
  return pickWeighted<ItemRarityId>([{ value: 'branco', weight: 48 }, { value: 'verde', weight: 34 }, { value: 'azul', weight: 14 }, { value: 'roxo', weight: 4 }]) || 'branco';
}

function pickQualityForMobKind(kind: string): ItemQualityId {
  const safe = String(kind || 'normal');
  if (safe === 'boss') return pickWeighted<ItemQualityId>([{ value: 'bom', weight: 34 }, { value: 'otimo', weight: 42 }, { value: 'excelente', weight: 24 }]) || 'otimo';
  if (safe === 'subboss') return pickWeighted<ItemQualityId>([{ value: 'normal', weight: 18 }, { value: 'bom', weight: 42 }, { value: 'otimo', weight: 28 }, { value: 'excelente', weight: 12 }]) || 'bom';
  if (safe === 'elite') return pickWeighted<ItemQualityId>([{ value: 'normal', weight: 28 }, { value: 'bom', weight: 38 }, { value: 'otimo', weight: 24 }, { value: 'excelente', weight: 10 }]) || 'bom';
  return pickWeighted<ItemQualityId>([{ value: 'pobre', weight: 18 }, { value: 'normal', weight: 42 }, { value: 'bom', weight: 28 }, { value: 'otimo', weight: 12 }]) || 'normal';
}

function pickTierForMap(mapKey: string, mobKind: string) {
  const safeMap = String(mapKey || 'forest');
  const cap = safeMap === 'city' ? 1 : safeMap === 'forest' ? 2 : safeMap === 'lava' ? 3 : 4;
  const min = safeMap === 'city' ? 1 : safeMap === 'forest' ? 1 : safeMap === 'lava' ? 2 : 3;
  const safeKind = String(mobKind || 'normal');
  const highBias = safeKind === 'boss' ? cap : safeKind === 'subboss' ? Math.max(min, cap) : safeKind === 'elite' ? Math.max(min, cap - 1) : min;
  const roll = safeKind === 'normal' ? (Math.random() < 0.7 ? min : Math.min(cap, min + 1)) : highBias;
  return ITEM_TIERS.find((entry) => entry.tier === roll) || ITEM_TIERS[0];
}

export function pickProgressionLootTemplate(mapKey: string, mobKind: string): BuiltinItemTemplate {
  const tier = pickTierForMap(mapKey, mobKind);
  const rarity = pickRarityForMobKind(mobKind);
  const quality = pickQualityForMobKind(mobKind);
  const classId = pickWeighted<ClassId>([{ value: 'knight', weight: 1 }, { value: 'archer', weight: 1 }, { value: 'druid', weight: 1 }, { value: 'assassin', weight: 1 }]) || 'knight';
  const slot = pickWeighted<EquipmentSlot>([
    { value: 'weapon', weight: 22 },
    { value: 'helmet', weight: 10 },
    { value: 'chest', weight: 12 },
    { value: 'pants', weight: 10 },
    { value: 'gloves', weight: 10 },
    { value: 'boots', weight: 10 },
    { value: 'ring', weight: 13 },
    { value: 'necklace', weight: 13 }
  ]) || 'weapon';
  const templateId = slot === 'weapon'
    ? resolveClassWeaponTemplateId(classId, tier.tier, rarity, quality)
    : resolveClassEquipmentTemplateId(classId, slot, tier.tier, rarity, quality);
  return BUILTIN_ITEM_TEMPLATE_BY_ID[templateId] || WEAPON_TEMPLATE;
}

export function pickMapMaterialTemplateId(mapKey: string) {
  const safeMap = String(mapKey || 'forest');
  if (safeMap === 'lava') return pickWeighted<string>([{ value: 'material_lava_ember', weight: 46 }, { value: 'material_lava_ore', weight: 54 }]) || 'material_lava_ore';
  if (safeMap === 'undead') return pickWeighted<string>([{ value: 'material_undead_bone', weight: 58 }, { value: 'material_undead_ectoplasm', weight: 42 }]) || 'material_undead_bone';
  return pickWeighted<string>([{ value: 'material_forest_hide', weight: 58 }, { value: 'material_forest_sap', weight: 42 }]) || 'material_forest_hide';
}

export const NPC_SHOPS: Record<string, Array<{ offerId: string; templateId: string; quantity?: number }>> = {
  npc_ferreiro_borin: [
    { offerId: 'borin_weapon_knight_1', templateId: resolveClassWeaponTemplateId('knight', 1, 'branco', 'normal') },
    { offerId: 'borin_weapon_knight_2', templateId: resolveClassWeaponTemplateId('knight', 2, 'verde', 'bom') },
    { offerId: 'borin_weapon_assassin_1', templateId: resolveClassWeaponTemplateId('assassin', 1, 'branco', 'normal') },
    { offerId: 'borin_weapon_assassin_2', templateId: resolveClassWeaponTemplateId('assassin', 2, 'verde', 'bom') },
    { offerId: 'borin_helmet_knight', templateId: resolveClassEquipmentTemplateId('knight', 'helmet', 1, 'branco', 'normal') },
    { offerId: 'borin_chest_knight', templateId: resolveClassEquipmentTemplateId('knight', 'chest', 1, 'verde', 'normal') },
    { offerId: 'borin_gloves_assassin', templateId: resolveClassEquipmentTemplateId('assassin', 'gloves', 1, 'verde', 'normal') },
    { offerId: 'borin_boots_assassin', templateId: resolveClassEquipmentTemplateId('assassin', 'boots', 1, 'branco', 'bom') }
  ],
  npc_armeira_maeve: [
    { offerId: 'maeve_archer_chest', templateId: resolveClassEquipmentTemplateId('archer', 'chest', 1, 'verde', 'normal') },
    { offerId: 'maeve_archer_gloves', templateId: resolveClassEquipmentTemplateId('archer', 'gloves', 1, 'verde', 'normal') },
    { offerId: 'maeve_druid_chest', templateId: resolveClassEquipmentTemplateId('druid', 'chest', 1, 'verde', 'normal') },
    { offerId: 'maeve_druid_gloves', templateId: resolveClassEquipmentTemplateId('druid', 'gloves', 1, 'verde', 'normal') },
    { offerId: 'maeve_knight_pants', templateId: resolveClassEquipmentTemplateId('knight', 'pants', 1, 'branco', 'normal') },
    { offerId: 'maeve_assassin_pants', templateId: resolveClassEquipmentTemplateId('assassin', 'pants', 1, 'branco', 'normal') }
  ],
  npc_joalheiro_orin: [
    { offerId: 'orin_knight_ring', templateId: resolveClassEquipmentTemplateId('knight', 'ring', 1, 'verde', 'bom') },
    { offerId: 'orin_archer_ring', templateId: resolveClassEquipmentTemplateId('archer', 'ring', 1, 'verde', 'bom') },
    { offerId: 'orin_druid_ring', templateId: resolveClassEquipmentTemplateId('druid', 'ring', 1, 'verde', 'bom') },
    { offerId: 'orin_assassin_ring', templateId: resolveClassEquipmentTemplateId('assassin', 'ring', 1, 'verde', 'bom') },
    { offerId: 'orin_knight_necklace', templateId: resolveClassEquipmentTemplateId('knight', 'necklace', 1, 'verde', 'normal') },
    { offerId: 'orin_archer_necklace', templateId: resolveClassEquipmentTemplateId('archer', 'necklace', 1, 'verde', 'normal') },
    { offerId: 'orin_druid_necklace', templateId: resolveClassEquipmentTemplateId('druid', 'necklace', 1, 'verde', 'normal') },
    { offerId: 'orin_assassin_necklace', templateId: resolveClassEquipmentTemplateId('assassin', 'necklace', 1, 'verde', 'normal') }
  ],
  npc_mercadora_tessa: [
    { offerId: 'tessa_potion_minor', templateId: 'potion_hp', quantity: 1 },
    { offerId: 'tessa_potion_major', templateId: 'potion_hp_major', quantity: 1 },
    { offerId: 'tessa_material_hide', templateId: 'material_forest_hide', quantity: 2 },
    { offerId: 'tessa_material_sap', templateId: 'material_forest_sap', quantity: 1 },
    { offerId: 'tessa_hourglass', templateId: 'skill_reset_hourglass', quantity: 1 }
  ],
  npc_guard_alden: [
    { offerId: 'alden_potion_minor', templateId: 'potion_hp', quantity: 1 }
  ],
  npc_scout_lina: [
    { offerId: 'lina_potion_minor', templateId: 'potion_hp', quantity: 1 },
    { offerId: 'lina_material_hide', templateId: 'material_forest_hide', quantity: 1 }
  ]
};
