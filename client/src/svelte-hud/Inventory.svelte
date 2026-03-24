<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import Slot from './components/Slot.svelte';
  import { inferEquipSlot, inventoryCategory } from './lib/itemTooltip';
  import { activateInventoryItem, beginDrag, dragStore, endDrag, equippedSlots, hideTooltip, inventorySlots, inventoryStore, moveInventoryItem, sendUiMessage, showTooltip } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();

  const categories = [
    { id: 'all', label: 'Tudo' },
    { id: 'equipment', label: 'Equip.' },
    { id: 'consumables', label: 'Consum.' },
    { id: 'materials', label: 'Materiais' },
    { id: 'quest', label: 'Quest' },
    { id: 'misc', label: 'Diversos' }
  ] as const;

  let activeCategory: typeof categories[number]['id'] = 'all';
  let search = '';
  let splitTarget: any = null;
  let splitAmount = 1;
  let deleteTarget: any = null;

  $: normalizedSearch = search.trim().toLowerCase();
  $: occupiedSlots = ($inventoryStore.inventory || []).length;
  $: wallet = $inventoryStore.wallet || {};
  $: visibleSlots = $inventorySlots.map((entry) => {
    const category = entry.item ? inventoryCategory(entry.item) : 'empty';
    const matchesCategory = activeCategory === 'all' || category === activeCategory;
    const matchesSearch = normalizedSearch.length <= 0
      || String(entry.item?.name || entry.item?.templateId || '')
        .toLowerCase()
        .includes(normalizedSearch);
    return {
      ...entry,
      hidden: Boolean(entry.item) && !(matchesCategory && matchesSearch),
      category
    };
  });
  $: splitMax = splitTarget ? Math.max(1, Math.min(249, Math.floor(Number(splitTarget.quantity || 1)) - 1)) : 1;

  function openSplit(item: any) {
    if (!item) return;
    splitTarget = item;
    splitAmount = Math.max(1, Math.floor(splitMax / 2));
  }

  function openDelete(item: any) {
    if (!item) return;
    deleteTarget = item;
  }

  function confirmSplit() {
    if (!splitTarget) return;
    sendUiMessage({
      type: 'split_item_req',
      itemId: String(splitTarget.id || ''),
      slotIndex: Number(splitTarget.slotIndex ?? -1),
      quantity: Math.max(1, Math.min(splitMax, Math.floor(Number(splitAmount || 1))))
    });
    splitTarget = null;
  }

  function handleDrop(slotIndex: number, event: DragEvent) {
    event.preventDefault();
    const payload = $dragStore;
    if (!payload) return;
    if (payload.source === 'inventory') moveInventoryItem(payload.itemId, slotIndex);
    if (payload.source === 'equipment') sendUiMessage({ type: 'inventory_unequip_to_slot', itemId: payload.itemId, toSlot: slotIndex });
    endDrag();
  }

  function resolveDraggedItem() {
    const payload = $dragStore;
    if (!payload || !('itemId' in payload)) return null;
    const itemId = String(payload.itemId || '');
    return $inventoryStore.inventory.find((entry: any) => String(entry?.id || '') === itemId)
      || Object.values($equippedSlots).find((entry: any) => String(entry?.id || '') === itemId)
      || null;
  }

  function handleDeleteDrop(event: DragEvent) {
    event.preventDefault();
    deleteTarget = resolveDraggedItem();
    endDrag();
  }

  function confirmDelete() {
    if (!deleteTarget?.id) return;
    sendUiMessage({
      type: 'delete_item_req',
      itemId: String(deleteTarget.id || ''),
      slotIndex: Number(deleteTarget.slotIndex ?? -1)
    });
    deleteTarget = null;
  }

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

  function walletText() {
    return [`${Number(wallet.diamond || 0)}d`, `${Number(wallet.gold || 0)}g`, `${Number(wallet.silver || 0)}s`, `${Number(wallet.copper || 0)}c`]
      .filter((entry) => !entry.startsWith('0'))
      .join(' ') || '0c';
  }
</script>

<Window title="Inventario" subtitle="Bolsa, stacks e equipamentos" width="clamp(600px, 60vw, 700px)" maxWidth="700px" maxBodyHeight="min(80vh, 840px)" on:close={() => dispatch('close')}>
  <div class="inventory-shell">
    <div class="summary-row">
      <div class="summary-card">
        <div class="hud-kicker">Capacidade</div>
        <div class="summary-value">{occupiedSlots}/36</div>
      </div>
      <div class="summary-card">
        <div class="hud-kicker">Filtro</div>
        <div class="summary-value">{categories.find((entry) => entry.id === activeCategory)?.label || 'Tudo'}</div>
      </div>
      <div class="summary-card wallet">
        <div class="hud-kicker">Carteira</div>
        <div class="summary-value">{walletText()}</div>
      </div>
    </div>

    <div class="toolbar-row">
      <input bind:value={search} class="hud-input" type="search" placeholder="Buscar item..." />
      <button class="hud-btn" type="button" on:click={() => sendUiMessage({ type: 'inventory_sort' })}>Organizar</button>
    </div>

    <div class="category-row">
      {#each categories as category}
        <button class={`hud-tab ${activeCategory === category.id ? 'active' : 'ghost'}`} type="button" on:click={() => activeCategory = category.id}>
          {category.label}
        </button>
      {/each}
    </div>

    <div class="inventory-grid">
      {#each visibleSlots as slot (slot.slotIndex)}
        <div class={`inventory-drop-shell ${slot.hidden ? 'filtered' : ''}`} role="group" aria-label={`Inventario ${slot.slotIndex + 1}`} on:dragover|preventDefault on:drop={(event) => handleDrop(slot.slotIndex, event)}>
          <Slot
            item={slot.item}
            size={60}
            searchHidden={slot.hidden}
            on:ctrlclick={(event) => openSplit(event.detail)}
            on:contextaction={(event) => openDelete(event.detail)}
            on:dragstart={(event) => event.detail && beginDrag({ source: 'inventory', itemId: String(event.detail.id) })}
            on:dblactivate={(event) => event.detail && activateInventoryItem(event.detail)}
            on:inspect={(event) => inspectItem(event.detail.item, event.detail.x, event.detail.y)}
            on:inspectend={hideTooltip}
          />
          <div class="slot-index">{slot.slotIndex + 1}</div>
        </div>
      {/each}
    </div>

    <div class="hint-row">
      <span>Duplo clique usa/equipa</span>
      <span>Ctrl + clique divide pilha</span>
      <span>Botao direito prepara exclusao</span>
    </div>

    <div class="delete-dropzone" role="button" tabindex="-1" on:dragover|preventDefault on:drop={handleDeleteDrop}>
      Arraste aqui para destruir um item
    </div>

    {#if splitTarget}
      <div class="modal-card">
        <div class="hud-title">Dividir pilha</div>
        <p>{splitTarget.name}</p>
        <input bind:value={splitAmount} class="hud-input" min="1" max={splitMax} type="number" />
        <div class="modal-actions">
          <button class="hud-btn" type="button" on:click={confirmSplit}>Confirmar</button>
          <button class="hud-btn ghost" type="button" on:click={() => splitTarget = null}>Cancelar</button>
        </div>
      </div>
    {/if}

    {#if deleteTarget}
      <div class="modal-card danger">
        <div class="hud-title">Destruir item</div>
        <p>{deleteTarget.name}</p>
        <div class="modal-actions">
          <button class="hud-btn danger" type="button" on:click={confirmDelete}>Destruir</button>
          <button class="hud-btn ghost" type="button" on:click={() => deleteTarget = null}>Cancelar</button>
        </div>
      </div>
    {/if}
  </div>
</Window>

<style>
  .inventory-shell,
  .summary-row,
  .category-row {
    display: grid;
    gap: 12px;
  }

  .summary-row {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }

  .summary-card,
  .modal-card {
    padding: 12px;
    border-radius: 14px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(7, 9, 12, 0.62);
  }

  .summary-value {
    margin-top: 6px;
    color: var(--hud-gold);
    font-family: var(--hud-font-display);
    text-transform: uppercase;
    font-size: 0.82rem;
  }

  .wallet .summary-value {
    color: var(--hud-warning);
  }

  .toolbar-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
  }

  .category-row {
    grid-template-columns: repeat(auto-fit, minmax(88px, 1fr));
  }

  .hud-tab.active {
    border-color: rgba(201, 168, 106, 0.42);
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.12), 0 0 12px rgba(201, 168, 106, 0.1);
  }

  .inventory-grid {
    display: grid;
    grid-template-columns: repeat(6, 60px);
    gap: 12px;
    justify-content: center;
  }

  .inventory-drop-shell {
    position: relative;
    min-width: 60px;
    min-height: 76px;
    display: grid;
    justify-items: center;
    gap: 6px;
  }

  .inventory-drop-shell.filtered {
    opacity: 0.4;
  }

  .slot-index,
  .hint-row,
  p {
    color: var(--hud-text-soft);
  }

  .slot-index {
    font-size: 0.66rem;
  }

  .hint-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 0.72rem;
  }

  .delete-dropzone {
    min-height: 42px;
    display: grid;
    place-items: center;
    border: 1px dashed rgba(205, 116, 100, 0.42);
    border-radius: 12px;
    background: linear-gradient(180deg, rgba(36, 14, 12, 0.94), rgba(16, 8, 8, 0.98));
    color: #efc1b5;
    font-family: var(--hud-font-display);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .modal-card {
    margin-top: 4px;
  }

  .modal-card.danger {
    border-color: rgba(205, 116, 100, 0.28);
    background: rgba(20, 10, 10, 0.72);
  }

  p {
    margin: 8px 0 10px;
    font-size: 0.82rem;
  }

  .modal-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }

  @media (max-width: 820px) {
    .summary-row,
    .category-row {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .toolbar-row {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .summary-row,
    .category-row {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .inventory-grid {
      grid-template-columns: repeat(4, 60px);
    }
  }
</style>
