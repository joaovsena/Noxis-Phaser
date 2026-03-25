<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import Slot from './components/Slot.svelte';
  import { depositToStorage, hideTooltip, inventorySlots, inventoryStore, showTooltip, storageStore, withdrawFromStorage, closeStoragePanel, equippedSlots } from './stores/gameUi';
  import { inferEquipSlot } from './lib/itemTooltip';

  const dispatch = createEventDispatcher<{ close: void }>();

  $: storageState = $storageStore.state || null;
  $: storageItems = Array.isArray(storageState?.items) ? storageState.items : [];
  $: storageCapacity = Math.max(1, Number(storageState?.capacity || 36));
  $: storageSlots = Array.from({ length: storageCapacity }, (_, slotIndex) => ({
    slotIndex,
    item: storageItems.find((entry: any) => Number(entry?.slotIndex) === slotIndex) || null
  }));
  $: occupiedInventory = ($inventoryStore.inventory || []).length;
  $: occupiedStorage = storageItems.length;

  function inspectItem(item: any, x: number, y: number) {
    if (!item) return;
    const equipSlot = inferEquipSlot(item);
    showTooltip({
      kind: 'item',
      item,
      equipped: equipSlot ? $equippedSlots[equipSlot] || null : null,
      showSell: false
    }, x, y);
  }

  function closeWindow() {
    closeStoragePanel();
    dispatch('close');
  }
</script>

<Window title="Bau Pessoal" subtitle={storageState?.npc?.name || 'Armazenamento do personagem'} width="clamp(760px, 72vw, 920px)" maxWidth="920px" maxBodyHeight="min(84vh, 880px)" on:close={closeWindow}>
  <div class="storage-shell">
    <section class="summary-row">
      <div class="summary-card">
        <div class="hud-kicker">Inventario</div>
        <div class="summary-value">{occupiedInventory}/36</div>
      </div>
      <div class="summary-card">
        <div class="hud-kicker">Bau</div>
        <div class="summary-value">{occupiedStorage}/{storageCapacity}</div>
      </div>
      <div class="summary-card">
        <div class="hud-kicker">Uso rapido</div>
        <div class="summary-value">Clique para mover</div>
      </div>
    </section>

    <section class="storage-columns">
      <article class="hud-section compact">
        <div class="section-title">Inventario</div>
        <div class="grid-six">
          {#each $inventorySlots as entry (entry.slotIndex)}
            <div class="slot-wrapper">
              <Slot
                item={entry.item}
                size={56}
                on:activate={() => entry.item && depositToStorage(String(entry.item.id || ''), Math.max(1, Number(entry.item.quantity || 1)))}
                on:inspect={(event) => inspectItem(event.detail.item, event.detail.x, event.detail.y)}
                on:inspectend={hideTooltip}
              />
            </div>
          {/each}
        </div>
      </article>

      <article class="hud-section compact">
        <div class="section-title">Bau</div>
        <div class="grid-six">
          {#each storageSlots as entry (entry.slotIndex)}
            <div class="slot-wrapper">
              <Slot
                item={entry.item}
                size={56}
                on:activate={() => entry.item && withdrawFromStorage(String(entry.item.id || ''), Math.max(1, Number(entry.item.quantity || 1)))}
                on:inspect={(event) => inspectItem(event.detail.item, event.detail.x, event.detail.y)}
                on:inspectend={hideTooltip}
              />
            </div>
          {/each}
        </div>
      </article>
    </section>
  </div>
</Window>

<style>
  .storage-shell,
  .summary-row,
  .storage-columns {
    display: grid;
    gap: 12px;
  }

  .summary-row {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .summary-card {
    padding: 12px;
    border-radius: 14px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(7, 9, 12, 0.62);
  }

  .summary-value,
  .section-title {
    color: var(--hud-gold);
    font-family: var(--hud-font-display);
    text-transform: uppercase;
  }

  .summary-value {
    margin-top: 6px;
    font-size: 0.82rem;
  }

  .storage-columns {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .compact {
    padding: 12px 14px;
  }

  .grid-six {
    display: grid;
    grid-template-columns: repeat(6, 56px);
    gap: 10px;
    justify-content: center;
  }

  .slot-wrapper {
    display: grid;
    place-items: center;
  }

  @media (max-width: 860px) {
    .summary-row,
    .storage-columns {
      grid-template-columns: 1fr;
    }
  }
</style>
