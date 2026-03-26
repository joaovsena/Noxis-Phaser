<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import Window from './components/Window.svelte';
  import Slot from './components/Slot.svelte';
  import { allocateStats, attributesStore, beginDrag, dragStore, equipInventoryItem, equippedSlots, hideTooltip, playerStats, showTooltip, unequipItem } from './stores/gameUi';

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

  const leftSlots = ['weapon', 'chest', 'pants', 'boots'];
  const rightSlots = ['helmet', 'necklace', 'gloves', 'ring'];
  let selectedTab: 'character' | 'soul' = 'character';
  let pending = { str: 0, int: 0, dex: 0, vit: 0 };
  let lastServerStatsState = '';

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

  function allocateOne(key: keyof typeof pending) {
    if (remainingPendingPoints <= 0) return;
    pending = { ...pending, [key]: Number(pending[key] || 0) + 1 };
  }

  function removeOne(key: keyof typeof pending) {
    pending = { ...pending, [key]: Math.max(0, Number(pending[key] || 0) - 1) };
  }

  function maxOut(key: keyof typeof pending) {
    if (remainingPendingPoints <= 0) return;
    pending = { ...pending, [key]: Number(pending[key] || 0) + remainingPendingPoints };
  }

  function clearPending() {
    pending = { str: 0, int: 0, dex: 0, vit: 0 };
  }

  function applyPending() {
    if (pendingTotal <= 0) return;
    allocateStats({ ...pending });
  }

  $: pendingTotal = Number(pending.str || 0) + Number(pending.int || 0) + Number(pending.dex || 0) + Number(pending.vit || 0);
  $: remainingPendingPoints = Math.max(0, Number($playerStats.unspentPoints || 0) - pendingTotal);

  $: serverStatsState = [
    Number($playerStats.base.str || 0),
    Number($playerStats.base.dex || 0),
    Number($playerStats.base.int || 0),
    Number($playerStats.base.vit || 0),
    Number($playerStats.unspentPoints || 0),
    Number($playerStats.level || 0)
  ].join('|');
  $: if (serverStatsState !== lastServerStatsState) {
    lastServerStatsState = serverStatsState;
    clearPending();
  }

  $: xpCurrent = Number($playerStats.xp || 0);
  $: xpMax = Math.max(1, Number($playerStats.xpToNext || 1));
  $: xpRatio = Math.max(0, Math.min(1, xpCurrent / xpMax));
  $: manaValue = Number($attributesStore.player?.mp || $attributesStore.player?.mana || $attributesStore.player?.energy || 0);
  $: manaMax = Number($attributesStore.player?.maxMp || $attributesStore.player?.maxMana || $attributesStore.player?.maxEnergy || 0);

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

<Window title={$attributesStore.player?.name || 'Personagem'} subtitle="Personagem" theme="classic" minimizable={false} width="clamp(520px, 46vw, 620px)" maxWidth="620px" maxBodyHeight="min(82vh, 860px)" on:close={() => dispatch('close')}>
  <div class="character-window">
    <div class="top-tabs">
      <button class:active={selectedTab === 'character'} type="button" on:click={() => selectedTab = 'character'}>Personagem</button>
      <button class:active={selectedTab === 'soul'} type="button" on:click={() => selectedTab = 'soul'}>Alma</button>
    </div>

    {#if selectedTab === 'character'}
      <div class="overview-strip">
        <div class="xp-panel">
          <div class="info-label">EXP</div>
          <div class="xp-bar">
            <div class="xp-fill" style={`transform: scaleX(${xpRatio});`}></div>
            <span>{xpCurrent} / {xpMax}</span>
          </div>
        </div>

        <div class="overview-actions">
          <button type="button" disabled>Titulo</button>
          <button type="button" disabled>Conquistas</button>
        </div>
      </div>

      <div class="character-main">
        <section class="paperdoll-panel">
          <div class="paperdoll-layout">
            <div class="slot-column">
              {#each leftSlots as slotKey}
                <div class="equip-slot-card" role="group" aria-label={slotLabels[slotKey]} on:dragover|preventDefault on:drop={(event) => handleEquipDrop(slotKey, event)}>
                  <Slot
                    item={$equippedSlots[slotKey]}
                    size={54}
                    on:dragstart={(event) => event.detail && beginDrag({ source: 'equipment', itemId: String(event.detail.id), slot: slotKey })}
                    on:dblactivate={(event) => event.detail && unequipItem(event.detail)}
                    on:inspect={(event) => inspectEquipped(event.detail.item, event.detail.x, event.detail.y)}
                    on:inspectend={hideTooltip}
                  />
                  <span>{slotLabels[slotKey]}</span>
                </div>
              {/each}
            </div>

            <div class="hero-doll">
              <div class="hero-portrait">{$playerStats.className.slice(0, 1).toUpperCase()}</div>
              <div class="hero-badge">Nv. {$playerStats.level}</div>
              <div class="hero-caption">{$playerStats.className}</div>
            </div>

            <div class="slot-column">
              {#each rightSlots as slotKey}
                <div class="equip-slot-card" role="group" aria-label={slotLabels[slotKey]} on:dragover|preventDefault on:drop={(event) => handleEquipDrop(slotKey, event)}>
                  <Slot
                    item={$equippedSlots[slotKey]}
                    size={54}
                    on:dragstart={(event) => event.detail && beginDrag({ source: 'equipment', itemId: String(event.detail.id), slot: slotKey })}
                    on:dblactivate={(event) => event.detail && unequipItem(event.detail)}
                    on:inspect={(event) => inspectEquipped(event.detail.item, event.detail.x, event.detail.y)}
                    on:inspectend={hideTooltip}
                  />
                  <span>{slotLabels[slotKey]}</span>
                </div>
              {/each}
            </div>
          </div>
        </section>

        <section class="profile-panel">
          <div class="profile-row"><span>Nivel</span><strong>{$playerStats.level}</strong></div>
          <div class="profile-row"><span>Classe</span><strong>{$playerStats.className}</strong></div>
          <div class="profile-row"><span>Pontos</span><strong>{$playerStats.unspentPoints}</strong></div>
          <div class="profile-row"><span>HP</span><strong>{$attributesStore.player?.hp || 0} / {$attributesStore.player?.maxHp || 0}</strong></div>
          <div class="profile-row"><span>MP</span><strong>{manaValue} / {manaMax}</strong></div>
          <div class="profile-row"><span>PATK</span><strong>{Math.floor(previewCombat.physicalAttack)}</strong></div>
          <div class="profile-row"><span>MATK</span><strong>{Math.floor(previewCombat.magicAttack)}</strong></div>
          <div class="profile-row"><span>Prec.</span><strong>{previewCombat.accuracy.toFixed(1)}</strong></div>
          <div class="profile-row"><span>Esq.</span><strong>{previewCombat.evasion.toFixed(1)}</strong></div>
        </section>
      </div>

      <div class="stats-grid">
        <section class="classic-panel attribute-panel">
          <div class="panel-title">Atributos</div>
          <div class="attribute-list">
            {#each [
              ['str', 'Forca', $playerStats.base.str || 0],
              ['dex', 'Agilidade', $playerStats.base.dex || 0],
              ['int', 'Inteligencia', $playerStats.base.int || 0],
              ['vit', 'Resistencia', $playerStats.base.vit || 0]
            ] as [key, label, value]}
              <div class="attribute-row">
                <div class="attribute-copy">
                  <span>{label}</span>
                  <strong>{value + Number(pending[key] || 0)}</strong>
                </div>
                <div class="attribute-actions">
                  <button type="button" on:pointerdown|stopPropagation on:click|stopPropagation={() => maxOut(key as keyof typeof pending)}>Max</button>
                  <button type="button" on:pointerdown|stopPropagation on:click|stopPropagation={() => allocateOne(key as keyof typeof pending)}>+</button>
                  <button type="button" on:pointerdown|stopPropagation on:click|stopPropagation={() => removeOne(key as keyof typeof pending)}>-</button>
                </div>
              </div>
            {/each}
          </div>

          <div class="attribute-footer">
            <div class="attribute-meta">
              <span class="attribute-summary">Distribuir: {pendingTotal} ponto(s)</span>
              <span class="attribute-summary">Restantes: {remainingPendingPoints}</span>
            </div>
            <div class="attribute-apply">
              <button type="button" disabled={pendingTotal <= 0} on:pointerdown|stopPropagation on:click|stopPropagation={applyPending}>Aplicar pontos</button>
              <button type="button" class="ghost" disabled={pendingTotal <= 0} on:pointerdown|stopPropagation on:click|stopPropagation={clearPending}>Limpar</button>
            </div>
          </div>
        </section>

        <section class="classic-panel">
          <div class="panel-title">Combate</div>
          <div class="combat-grid">
            <div class="combat-row"><span>PDEF</span><strong>{previewCombat.physicalDefense.toFixed(1)}</strong></div>
            <div class="combat-row"><span>MDEF</span><strong>{previewCombat.magicDefense.toFixed(1)}</strong></div>
            <div class="combat-row"><span>Vel. atk</span><strong>{previewCombat.attackSpeed}%</strong></div>
            <div class="combat-row"><span>Vel. mov</span><strong>{previewCombat.moveSpeed}</strong></div>
          </div>
        </section>
      </div>
    {:else}
      <section class="classic-panel soul-panel">
        <div class="panel-title">Alma</div>
        <p>O sistema de alma ainda nao esta exposto pelo cliente, mas a aba ja foi preparada no visual classico.</p>
      </section>
    {/if}
  </div>

</Window>

<style>
  .character-window,
  .character-main,
  .paperdoll-layout,
  .slot-column,
  .stats-grid,
  .attribute-list,
  .combat-grid {
    display: grid;
    gap: 10px;
  }

  .top-tabs,
  .overview-strip,
  .overview-actions,
  .attribute-actions,
  .attribute-footer,
  .attribute-apply {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .top-tabs button,
  .overview-actions button,
  .attribute-actions button,
  .attribute-apply button {
    min-height: 28px;
    padding: 0 12px;
    border-radius: 7px;
    border: 1px solid rgba(226, 201, 138, 0.22);
    background: linear-gradient(180deg, rgba(104, 85, 43, 0.92), rgba(60, 50, 26, 0.96));
    color: #fff1cf;
    font-family: var(--hud-font-display);
    pointer-events: auto;
    cursor: pointer;
  }

  .top-tabs {
    padding-bottom: 2px;
  }

  .top-tabs button.active {
    box-shadow: 0 0 0 1px rgba(226, 201, 138, 0.12), 0 0 12px rgba(226, 201, 138, 0.12);
  }

  .top-tabs button:not(.active),
  .attribute-apply .ghost {
    background: linear-gradient(180deg, rgba(74, 69, 49, 0.82), rgba(48, 45, 35, 0.92));
  }

  .overview-strip {
    justify-content: space-between;
    padding: 4px 2px 2px;
  }

  .xp-panel {
    min-width: 0;
    flex: 1;
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
  }

  .info-label,
  .panel-title {
    color: #fff1cf;
    font-family: var(--hud-font-display);
    font-size: 0.72rem;
  }

  .xp-bar {
    position: relative;
    height: 16px;
    overflow: hidden;
    border-radius: 999px;
    border: 1px solid rgba(227, 201, 134, 0.3);
    background: rgba(38, 34, 22, 0.92);
  }

  .xp-fill {
    position: absolute;
    inset: 0;
    transform-origin: left center;
    background: linear-gradient(90deg, #4f8d78, #5fd2ba 56%, #b1ffe7);
  }

  .xp-bar span {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: #f8f3e2;
    font-size: 0.66rem;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.72);
  }

  .character-main {
    grid-template-columns: minmax(0, 1fr) 190px;
    align-items: start;
  }

  .classic-panel,
  .paperdoll-panel,
  .profile-panel {
    padding: 12px;
    border-radius: 12px;
    border: 1px solid rgba(226, 201, 138, 0.18);
    background: rgba(77, 71, 46, 0.78);
    box-shadow: inset 0 1px 0 rgba(255, 243, 211, 0.06);
  }

  .attribute-panel {
    display: grid;
    grid-template-rows: auto 1fr auto;
    align-content: start;
  }

  .paperdoll-layout {
    grid-template-columns: 72px minmax(0, 1fr) 72px;
    align-items: center;
  }

  .slot-column {
    justify-items: center;
  }

  .equip-slot-card {
    display: grid;
    justify-items: center;
    gap: 6px;
  }

  .equip-slot-card span,
  .hero-caption,
  .soul-panel p {
    color: rgba(248, 241, 224, 0.84);
    font-size: 0.72rem;
  }

  .hero-doll {
    display: grid;
    justify-items: center;
    gap: 8px;
  }

  .hero-portrait {
    width: 160px;
    height: 204px;
    border-radius: 18px;
    border: 1px solid rgba(233, 210, 150, 0.34);
    background:
      radial-gradient(circle at 50% 28%, rgba(255, 255, 255, 0.2), transparent 28%),
      linear-gradient(180deg, rgba(109, 78, 39, 0.86), rgba(41, 33, 21, 0.96));
    display: grid;
    place-items: center;
    color: #fff2cf;
    font-family: var(--hud-font-display);
    font-size: 3rem;
    text-transform: uppercase;
  }

  .hero-badge {
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid rgba(233, 210, 150, 0.3);
    background: rgba(46, 39, 24, 0.92);
    color: #ffe99e;
    font-family: var(--hud-font-display);
    font-size: 0.72rem;
  }

  .profile-panel,
  .attribute-row,
  .combat-row {
    display: grid;
    gap: 8px;
  }

  .profile-row,
  .attribute-copy,
  .combat-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .profile-row span,
  .attribute-copy span,
  .combat-row span {
    color: rgba(248, 241, 224, 0.82);
    font-size: 0.76rem;
  }

  .profile-row strong,
  .attribute-copy strong,
  .combat-row strong {
    color: #fff4d3;
    font-size: 0.78rem;
  }

  .stats-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .attribute-row,
  .combat-row {
    padding: 8px 10px;
    border-radius: 10px;
    background: rgba(42, 37, 25, 0.68);
  }

  .attribute-actions {
    justify-content: flex-end;
  }

  .attribute-actions button {
    min-width: 34px;
    padding: 0 10px;
  }

  .attribute-footer {
    justify-content: space-between;
    margin-top: 10px;
    padding-top: 10px;
    border-top: 1px solid rgba(226, 201, 138, 0.14);
    gap: 10px;
  }

  .attribute-meta {
    display: grid;
    gap: 2px;
  }

  .attribute-summary {
    color: rgba(248, 241, 224, 0.84);
    font-size: 0.76rem;
  }

  @media (max-width: 860px) {
    .character-main,
    .stats-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 620px) {
    .paperdoll-layout {
      grid-template-columns: 1fr;
    }

    .slot-column {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      display: grid;
      width: 100%;
    }

    .hero-portrait {
      width: 132px;
      height: 172px;
    }

    .attribute-footer {
      justify-content: flex-start;
    }
  }
</style>
