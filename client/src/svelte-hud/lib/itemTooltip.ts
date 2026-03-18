const CLASS_LABELS: Record<string, string> = {
  knight: 'Cavaleiro',
  archer: 'Arqueiro',
  druid: 'Druida',
  assassin: 'Assassino'
};

export function resolveItemRarity(item: any) {
  const rarity = String(item?.rarity || 'common').toLowerCase();
  return ['common', 'rare', 'epic', 'legendary'].includes(rarity) ? rarity : 'common';
}

export function rarityLabel(item: any) {
  const rarity = resolveItemRarity(item);
  return rarity === 'legendary' ? 'Lendario' : rarity === 'epic' ? 'Epico' : rarity === 'rare' ? 'Raro' : 'Comum';
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
  return item?.bonuses && typeof item.bonuses === 'object'
    ? Object.entries(item.bonuses).filter(([, value]) => Number(value || 0) !== 0)
    : [];
}
