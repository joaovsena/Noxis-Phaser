<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import Window from './components/Window.svelte';
  import Slot from './components/Slot.svelte';
  import { allocateStats, beginDrag, dragStore, equipInventoryItem, equippedSlots, hideTooltip, playerStats, showTooltip, unequipItem } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();

  const slotLabels: Record<string, string> = {
    helmet: 'Capacete',
    chest: 'Peitoral',
    pants: 'Calcas',
    gloves: 'Luvas',
    boots: 'Botas',
    ring: 'Anel',
    weapon: 'Arma',
    necklace: 'Colar'
  };

  const orderedSlots = ['helmet', 'chest', 'pants', 'gloves', 'boots', 'ring', 'weapon', 'necklace'];
  let pending = { str: 0, int: 0, dex: 0, vit: 0 };
  let lastSnapshot = '';

  function handleEquipDrop(slotKey: string, event: DragEvent) {
    event.preventDefault();
    const payload = $dragStore;
    if (!payload) return;
    if (payload.source === 'inventory') equipInventoryItem(payload.itemId);
  }

  function inspectEquipped(item: any, x: number, y: number) {
    if (!item) return;
    showTooltip({ kind: 'item', item, equipped: null, showSell: false }, x, y);
  }

  function pendingCost() {
    return Number(pending.str || 0) + Number(pending.int || 0) + Number(pending.dex || 0) + Number(pending.vit || 0);
  }

  function remainingPoints() {
    return Math.max(0, Number($playerStats.unspentPoints || 0) - pendingCost());
  }

  function allocateOne(key: keyof typeof pending) {
    if (remainingPoints() <= 0) return;
    pending = { ...pending, [key]: Number(pending[key] || 0) + 1 };
  }

  function removeOne(key: keyof typeof pending) {
    pending = { ...pending, [key]: Math.max(0, Number(pending[key] || 0) - 1) };
  }

  function maxOut(key: keyof typeof pending) {
    while (remainingPoints() > 0) {
      const before = Number(pending[key] || 0);
      allocateOne(key);
      if (Number(pending[key] || 0) === before) break;
    }
  }

  function clearPending() {
    pending = { str: 0, int: 0, dex: 0, vit: 0 };
  }

  function applyPending() {
    if (pendingCost() <= 0) return;
    allocateStats(pending);
    clearPending();
  }

  $: snapshot = JSON.stringify({ base: $playerStats.base, unspent: $playerStats.unspentPoints, level: $playerStats.level });
  $: if (snapshot !== lastSnapshot) {
    lastSnapshot = snapshot;
    clearPending();
  }

  $: previewCombat = {
    physicalAttack: Number($playerStats.combat.physicalAttack || 0) + Number(pending.str || 0) * 2,
    magicAttack: Number($playerStats.combat.magicAttack || 0) + Number(pending.int || 0) * 3,
    physicalDefense: Number($playerStats.combat.physicalDefense || 0) + Number(pending.str || 0) * 0.5 + Number(pending.vit || 0) * 1.2,
    magicDefense: Number($playerStats.combat.magicDefense || 0) + Number(pending.int || 0) * 0.8 + Number(pending.vit || 0) * 0.5,
    accuracy: Number($playerStats.combat.accuracy || 0) + Number(pending.dex || 0) * 1.5,
    evasion: Number($playerStats.combat.evasion || 0) + Number(pending.dex || 0) * 0.8,
    moveSpeed: Number($playerStats.combat.moveSpeed || 0),
    attackSpeed: Number($playerStats.combat.attackSpeed || 0)
  };

  onDestroy(() => clearPending());
</script>

<Window title="Personagem" subtitle="Equipamentos e atributos" width="420px" on:close={() => dispatch('close')}>
  <div class="hero-strip">
    <div class="hero-core">{$playerStats.className}</div>
    <div class="hero-meta">
      <div class="hero-level">Nivel {$playerStats.level}</div>
      <div class="hero-xp">XP {$playerStats.xp} / {$playerStats.xpToNext}</div>
    </div>
  </div>

  <div class="points-bar">
    <span>Pontos disponiveis {$playerStats.unspentPoints}</span>
    {#if pendingCost() > 0}
      <span class="pending-cost">Em preparo: {pendingCost()}</span>
    {/if}
  </div>

  <div class="equipment-grid">
    {#each orderedSlots as slotKey}
      <div class="equip-shell" role="group" aria-label={slotLabels[slotKey]} on:dragover|preventDefault on:drop={(event) => handleEquipDrop(slotKey, event)}>
        <div class="equip-label">{slotLabels[slotKey]}</div>
        <Slot
          item={$equippedSlots[slotKey]}
          size={56}
          on:dragstart={(event) => event.detail && beginDrag({ source: 'equipment', itemId: String(event.detail.id), slot: slotKey })}
          on:dblactivate={(event) => event.detail && unequipItem(event.detail)}
          on:inspect={(event) => inspectEquipped(event.detail.item, event.detail.x, event.detail.y)}
          on:inspectend={hideTooltip}
        />
      </div>
    {/each}
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-head">Base</div>
      {#each [
        ['str', 'FOR', $playerStats.base.str || 0],
        ['int', 'INT', $playerStats.base.int || 0],
        ['dex', 'DES', $playerStats.base.dex || 0],
        ['vit', 'VIT', $playerStats.base.vit || 0]
      ] as [key, label, value]}
        <div class="stat-row">
          <span>{label} {value + Number(pending[key] || 0)}{#if Number(pending[key] || 0) > 0} <strong class="bonus">+{pending[key]}</strong>{/if}</span>
          <div class="stat-actions">
            <button type="button" class="ghost mini" on:click={() => maxOut(key as keyof typeof pending)}>^</button>
            <button type="button" class="mini" on:click={() => allocateOne(key as keyof typeof pending)}>+</button>
            <button type="button" class="ghost mini" on:click={() => removeOne(key as keyof typeof pending)}>-</button>
          </div>
        </div>
      {/each}
    </div>
    <div class="stat-card">
      <div class="stat-head">Combate</div>
      <div>PATK {Math.floor(previewCombat.physicalAttack)}</div>
      <div>MATK {Math.floor(previewCombat.magicAttack)}</div>
      <div>PDEF {previewCombat.physicalDefense.toFixed(1)}</div>
      <div>MDEF {previewCombat.magicDefense.toFixed(1)}</div>
      <div>ACC {previewCombat.accuracy.toFixed(1)}</div>
      <div>EVA {previewCombat.evasion.toFixed(1)}</div>
      <div>MSPD {previewCombat.moveSpeed}</div>
      <div>ASPD {previewCombat.attackSpeed}%</div>
    </div>
  </div>

  <div class="footer-actions">
    <button type="button" disabled={pendingCost() <= 0} on:click={applyPending}>Aplicar</button>
    <button type="button" class="ghost" disabled={pendingCost() <= 0} on:click={clearPending}>Limpar</button>
  </div>
</Window>

<style>
  .hero-strip {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 14px;
  }

  .hero-core,
  .stat-card {
    clip-path: polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px);
    border: 1px solid rgba(201, 168, 106, 0.24);
    background: linear-gradient(180deg, rgba(15, 12, 10, 0.96), rgba(8, 8, 8, 0.98));
  }

  .hero-core {
    min-width: 82px;
    min-height: 82px;
    display: grid;
    place-items: center;
    padding: 8px;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    color: #f2dfb7;
  }

  .hero-meta {
    display: grid;
    gap: 6px;
    color: rgba(228, 218, 194, 0.8);
    font-size: 0.82rem;
  }

  .hero-level {
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    color: #efdcb3;
  }

  .points-bar,
  .stat-row,
  .stat-actions,
  .footer-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .points-bar,
  .footer-actions {
    justify-content: space-between;
    margin-bottom: 14px;
    color: rgba(228, 218, 194, 0.8);
    font-size: 0.8rem;
  }

  .pending-cost,
  .bonus {
    color: #f0dfbc;
  }

  .equipment-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 10px;
    margin-bottom: 14px;
  }

  .equip-shell {
    display: grid;
    gap: 6px;
    justify-items: center;
  }

  .equip-label,
  .stat-head {
    font-family: 'Cinzel', serif;
    font-size: 0.64rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(201, 168, 106, 0.76);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .stat-card {
    padding: 12px;
    display: grid;
    gap: 6px;
    color: rgba(233, 223, 200, 0.78);
    font-size: 0.78rem;
  }

  .stat-row {
    justify-content: space-between;
  }

  .stat-actions {
    margin-left: auto;
  }

  .mini,
  .footer-actions button {
    min-height: 32px;
    border: 1px solid rgba(201, 168, 106, 0.28);
    background: linear-gradient(180deg, rgba(33, 24, 14, 0.96), rgba(12, 10, 8, 0.98));
    color: #ecdcb8;
    padding: 0 10px;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
  }

  .ghost {
    background: rgba(16, 20, 24, 0.95) !important;
  }

  @media (max-width: 560px) {
    .equipment-grid,
    .stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
