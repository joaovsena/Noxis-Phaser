const CLASS_LABELS: Record<string, string> = {
  knight: 'Cavaleiro',
  archer: 'Arqueiro',
  druid: 'Druida',
  assassin: 'Assassino',
  necromancer: 'Necromante'
};

const RARITY_LABELS: Record<string, string> = {
  branco: 'Branco',
  verde: 'Verde',
  azul: 'Azul',
  roxo: 'Roxo',
  laranja: 'Laranja'
};

const QUALITY_LABELS: Record<string, string> = {
  pobre: 'Pobre',
  normal: 'Normal',
  bom: 'Bom',
  otimo: 'Otimo',
  excelente: 'Excelente'
};

const SLOT_LABELS: Record<string, string> = {
  weapon: 'Arma',
  helmet: 'Capacete',
  chest: 'Peitoral',
  pants: 'Calcas',
  gloves: 'Luvas',
  boots: 'Botas',
  ring: 'Anel',
  necklace: 'Colar'
};

const CATEGORY_LABELS: Record<string, string> = {
  equipment: 'Equipamento',
  consumables: 'Consumivel',
  quest: 'Missao',
  materials: 'Material',
  misc: 'Item'
};

const STAT_LABELS: Record<string, string> = {
  physicalAttack: 'Ataque Fisico',
  magicAttack: 'Ataque Magico',
  physicalDefense: 'Defesa Fisica',
  magicDefense: 'Defesa Magica',
  maxHp: 'Vida Maxima',
  accuracy: 'Precisao',
  evasion: 'Evasao',
  attackSpeed: 'Velocidade de Ataque',
  moveSpeed: 'Velocidade de Movimento',
  attackRange: 'Alcance',
  criticalChance: 'Chance Critica',
  luck: 'Sorte'
};

export function resolveItemRarity(item: any) {
  const rarity = String(item?.rarity || 'branco').toLowerCase();
  return ['branco', 'verde', 'azul', 'roxo', 'laranja'].includes(rarity) ? rarity : 'branco';
}

export function rarityLabel(item: any) {
  const rarity = resolveItemRarity(item);
  return RARITY_LABELS[rarity] || 'Branco';
}

export function resolveItemQuality(item: any) {
  const quality = String(item?.quality || 'normal').toLowerCase();
  return ['pobre', 'normal', 'bom', 'otimo', 'excelente'].includes(quality) ? quality : 'normal';
}

export function qualityLabel(item: any) {
  return QUALITY_LABELS[resolveItemQuality(item)] || 'Normal';
}

export function normalizeWallet(source: any) {
  const toInt = (value: unknown) => {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.floor(parsed));
  };
  const carryFromCopper = Math.floor(toInt(source?.copper) / 100);
  const copper = toInt(source?.copper) % 100;
  const silverRaw = toInt(source?.silver) + carryFromCopper;
  const carryFromSilver = Math.floor(silverRaw / 100);
  const silver = silverRaw % 100;
  const goldRaw = toInt(source?.gold) + carryFromSilver;
  const carryFromGold = Math.floor(goldRaw / 100);
  const gold = goldRaw % 100;
  const diamond = toInt(source?.diamond) + carryFromGold;
  return { diamond, gold, silver, copper };
}

export function inferEquipSlot(item: any) {
  const explicit = String(item?.slot || '').toLowerCase();
  if (explicit) return explicit;
  const type = String(item?.type || '').toLowerCase();
  if (type === 'weapon') return 'weapon';
  if (type === 'ring') return 'ring';
  if (type === 'necklace' || type === 'amulet') return 'necklace';
  if (['helmet', 'chest', 'pants', 'gloves', 'boots'].includes(type)) return type;
  return '';
}

export function classLabel(classId: string) {
  return CLASS_LABELS[String(classId || '').toLowerCase()] || String(classId || 'Livre');
}

export function slotLabel(slot: string) {
  const key = String(slot || '').toLowerCase();
  return SLOT_LABELS[key] || String(slot || 'Item');
}

export function statLabel(key: string) {
  return STAT_LABELS[String(key || '')] || String(key || '');
}

export function stripItemAffixSuffix(name: string) {
  return String(name || '')
    .replace(/\s+(branco|verde|azul|roxo|laranja)\s*\/\s*(pobre|normal|bom|otimo|excelente)\s*$/i, '')
    .trim();
}

export function displayItemName(item: any) {
  const fallback = String(item?.name || item?.templateId || 'Item');
  return stripItemAffixSuffix(fallback) || fallback;
}

export function computeSellCopper(item: any) {
  if (item?.sellPrice && typeof item.sellPrice === 'object') {
    const safe = item.sellPrice;
    return (Number(safe.diamond || 0) * 1000000) + (Number(safe.gold || 0) * 10000) + (Number(safe.silver || 0) * 100) + Number(safe.copper || 0);
  }
  return Math.max(0, Math.floor(Number(item?.price || item?.value || 0) * 0.35));
}

export function goldValueFromCopper(copper: number) {
  return (Math.max(0, Number(copper || 0)) / 10000).toFixed(2);
}

export function bonusEntries(item: any) {
  const flat = item?.bonuses && typeof item.bonuses === 'object'
    ? Object.entries(item.bonuses)
      .filter(([, value]) => Number(value || 0) !== 0)
      .map(([key, value]) => ({ key: String(key), value: Number(value || 0), kind: 'flat' as const }))
    : [];
  const percent = item?.bonusPercents && typeof item.bonusPercents === 'object'
    ? Object.entries(item.bonusPercents)
      .filter(([, value]) => Number(value || 0) !== 0)
      .map(([key, value]) => ({ key: String(key), value: Number(value || 0), kind: 'percent' as const }))
    : [];
  return [...flat, ...percent];
}

export function inventoryCategory(item: any) {
  const type = String(item?.type || '').toLowerCase();
  const name = String(item?.name || item?.templateId || '').toLowerCase();
  if (inferEquipSlot(item)) return 'equipment';
  if (type.includes('potion') || type.includes('consum') || type.includes('food') || type.includes('scroll')) return 'consumables';
  if (type.includes('quest') || name.includes('quest') || name.includes('missao')) return 'quest';
  if (
    type.includes('material')
    || type.includes('ore')
    || type.includes('resource')
    || type.includes('craft')
    || type.includes('gem')
    || type.includes('reagent')
  ) return 'materials';
  return 'misc';
}

export function itemTypeLabel(item: any) {
  const equipSlot = inferEquipSlot(item);
  if (equipSlot && equipSlot !== 'consumable' && equipSlot !== 'material') {
    return `${CATEGORY_LABELS.equipment} - ${slotLabel(equipSlot)}`;
  }
  const category = inventoryCategory(item);
  return CATEGORY_LABELS[category] || CATEGORY_LABELS.misc;
}

export function inferItemTier(item: any) {
  const templateId = String(item?.templateId || '');
  const templateMatch = templateId.match(/_t(\d+)_/i);
  if (templateMatch) {
    const safe = Math.max(0, Math.floor(Number(templateMatch[1] || 0)));
    if (safe > 0) return safe;
  }
  const name = String(item?.name || '');
  if (/aprendiz/i.test(name)) return 1;
  if (/explorador/i.test(name)) return 2;
  if (/veterano/i.test(name)) return 3;
  if (/ascendente/i.test(name)) return 4;
  return 0;
}

export function compareBonusEntries(item: any, equipped: any) {
  const current = new Map(bonusEntries(item).map((entry) => [`${entry.kind}:${entry.key}`, entry]));
  const baseline = new Map(bonusEntries(equipped).map((entry) => [`${entry.kind}:${entry.key}`, entry]));
  const keys = new Set<string>([...current.keys(), ...baseline.keys()]);
  return [...keys]
    .map((key) => {
      const currentEntry = current.get(key) || { key, value: 0, kind: 'flat' as const };
      const equippedEntry = baseline.get(key) || { key, value: 0, kind: currentEntry.kind };
      return {
        key: String(currentEntry.key || equippedEntry.key || '').replace(/^(flat|percent):/, ''),
        kind: currentEntry.kind || equippedEntry.kind || 'flat',
        value: Number(currentEntry.value || 0),
        equipped: Number(equippedEntry.value || 0),
        diff: Number(currentEntry.value || 0) - Number(equippedEntry.value || 0)
      };
    })
    .filter((entry) => entry.value !== 0 || entry.equipped !== 0 || entry.diff !== 0);
}
