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

  const orderedSlots = ['helmet', 'weapon', 'chest', 'necklace', 'gloves', 'ring', 'pants', 'boots'];
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

<Window title="Personagem" subtitle="Equipamentos e atributos" width="clamp(640px, 62vw, 760px)" maxWidth="760px" maxBodyHeight="min(82vh, 860px)" on:close={() => dispatch('close')}>
  <div class="character-shell">
    <div class="hero-strip">
      <div class="hero-core">{$playerStats.className.slice(0, 2).toUpperCase()}</div>
      <div class="hero-meta">
        <div class="hud-kicker">Classe</div>
        <div class="hero-level">{$playerStats.className}</div>
        <div class="hero-xp">Nivel {$playerStats.level} | XP {$playerStats.xp} / {$playerStats.xpToNext}</div>
      </div>
      <div class="points-card">
        <div class="hud-kicker">Pontos</div>
        <div class="points-value">{$playerStats.unspentPoints}</div>
        {#if pendingCost() > 0}
          <div class="points-pending">Preparado: {pendingCost()}</div>
        {/if}
      </div>
    </div>

    <div class="equipment-layout">
      <section class="equipment-panel">
        <div class="panel-title">Equipamento</div>
        <div class="equipment-grid">
          {#each orderedSlots as slotKey}
            <div class="equip-shell" role="group" aria-label={slotLabels[slotKey]} on:dragover|preventDefault on:drop={(event) => handleEquipDrop(slotKey, event)}>
              <div class="equip-label">{slotLabels[slotKey]}</div>
              <Slot
                item={$equippedSlots[slotKey]}
                size={62}
                on:dragstart={(event) => event.detail && beginDrag({ source: 'equipment', itemId: String(event.detail.id), slot: slotKey })}
                on:dblactivate={(event) => event.detail && unequipItem(event.detail)}
                on:inspect={(event) => inspectEquipped(event.detail.item, event.detail.x, event.detail.y)}
                on:inspectend={hideTooltip}
              />
            </div>
          {/each}
        </div>
      </section>

      <section class="stats-panel">
        <div class="panel-title">Atributos</div>
        <div class="stats-grid">
          {#each [
            ['str', 'FOR', $playerStats.base.str || 0],
            ['int', 'INT', $playerStats.base.int || 0],
            ['dex', 'DES', $playerStats.base.dex || 0],
            ['vit', 'VIT', $playerStats.base.vit || 0]
          ] as [key, label, value]}
            <div class="stat-card">
              <div class="stat-top">
                <span>{label}</span>
                <strong>{value + Number(pending[key] || 0)}</strong>
              </div>
              {#if Number(pending[key] || 0) > 0}
                <div class="pending-bonus">+{pending[key]} pendente</div>
              {/if}
              <div class="stat-actions">
                <button class="hud-btn mini ghost" type="button" on:click={() => maxOut(key as keyof typeof pending)}>Max</button>
                <button class="hud-btn mini" type="button" on:click={() => allocateOne(key as keyof typeof pending)}>+</button>
                <button class="hud-btn mini ghost" type="button" on:click={() => removeOne(key as keyof typeof pending)}>-</button>
              </div>
            </div>
          {/each}
        </div>
      </section>
    </div>

    <section class="combat-panel">
      <div class="panel-title">Resumo de combate</div>
      <div class="combat-grid">
        <div class="combat-line"><span>PATK</span><strong>{Math.floor(previewCombat.physicalAttack)}</strong></div>
        <div class="combat-line"><span>MATK</span><strong>{Math.floor(previewCombat.magicAttack)}</strong></div>
        <div class="combat-line"><span>PDEF</span><strong>{previewCombat.physicalDefense.toFixed(1)}</strong></div>
        <div class="combat-line"><span>MDEF</span><strong>{previewCombat.magicDefense.toFixed(1)}</strong></div>
        <div class="combat-line"><span>ACC</span><strong>{previewCombat.accuracy.toFixed(1)}</strong></div>
        <div class="combat-line"><span>EVA</span><strong>{previewCombat.evasion.toFixed(1)}</strong></div>
        <div class="combat-line"><span>MSPD</span><strong>{previewCombat.moveSpeed}</strong></div>
        <div class="combat-line"><span>ASPD</span><strong>{previewCombat.attackSpeed}%</strong></div>
      </div>
    </section>
  </div>

  <svelte:fragment slot="footer">
    <div class="footer-actions">
      <button class="hud-btn" type="button" disabled={pendingCost() <= 0} on:click={applyPending}>Aplicar pontos</button>
      <button class="hud-btn ghost" type="button" disabled={pendingCost() <= 0} on:click={clearPending}>Limpar</button>
      <span class="footer-hint">Restantes apos preparo: {remainingPoints()}</span>
    </div>
  </svelte:fragment>
</Window>

<style>
  .character-shell,
  .hero-strip,
  .equipment-layout,
  .stats-grid,
  .equipment-grid,
  .combat-grid {
    display: grid;
    gap: 12px;
  }

  .hero-strip {
    grid-template-columns: 88px minmax(0, 1fr) minmax(132px, 156px);
    align-items: center;
  }

  .hero-core,
  .points-card,
  .equipment-panel,
  .stats-panel,
  .combat-panel,
  .stat-card {
    border-radius: 16px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(7, 9, 12, 0.62);
  }

  .hero-core {
    min-width: 88px;
    min-height: 88px;
    display: grid;
    place-items: center;
    font-family: var(--hud-font-display);
    text-transform: uppercase;
    color: var(--hud-gold);
    font-size: 1.4rem;
  }

  .hero-meta {
    display: grid;
    gap: 6px;
  }

  .hero-level {
    color: var(--hud-gold);
    font-family: var(--hud-font-display);
    text-transform: uppercase;
  }

  .hero-xp,
  .points-pending,
  .footer-hint {
    color: var(--hud-text-soft);
    font-size: 0.8rem;
  }

  .points-card {
    padding: 12px;
    text-align: center;
  }

  .points-value {
    margin-top: 6px;
    color: var(--hud-warning);
    font-family: var(--hud-font-display);
    font-size: 1.2rem;
  }

  .equipment-layout {
    grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
    align-items: start;
  }

  .equipment-panel,
  .stats-panel,
  .combat-panel {
    padding: 14px;
  }

  .panel-title {
    margin-bottom: 12px;
    color: var(--hud-gold);
    font-family: var(--hud-font-display);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .equipment-grid {
    grid-template-columns: repeat(2, minmax(92px, 1fr));
    gap: 14px 18px;
  }

  .equip-shell {
    display: grid;
    justify-items: center;
    gap: 8px;
  }

  .equip-label {
    color: var(--hud-text-soft);
    font-size: 0.72rem;
    text-transform: uppercase;
  }

  .stats-grid {
    grid-template-columns: repeat(auto-fit, minmax(158px, 1fr));
  }

  .stat-card {
    padding: 12px;
  }

  .stat-top,
  .stat-actions,
  .combat-line,
  .footer-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .stat-top {
    color: var(--hud-gold);
    font-family: var(--hud-font-display);
  }

  .pending-bonus {
    margin-top: 4px;
    color: var(--hud-warning);
    font-size: 0.72rem;
  }

  .stat-actions {
    margin-top: 10px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) 38px 38px;
    justify-content: stretch;
  }

  .stat-actions :global(.hud-btn) {
    min-width: 0;
  }

  .combat-grid {
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  }

  .combat-line {
    padding: 10px 12px;
    border-radius: 12px;
    background: rgba(11, 13, 18, 0.62);
    color: var(--hud-text-soft);
  }

  .combat-line strong {
    color: var(--hud-gold);
  }

  .footer-actions {
    flex-wrap: wrap;
  }

  @media (max-width: 980px) {
    .equipment-layout {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 760px) {
    .hero-strip,
    .combat-grid,
    .stats-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .hero-strip {
      grid-template-columns: 74px minmax(0, 1fr);
    }

    .points-card {
      grid-column: 1 / -1;
    }
  }
</style>
