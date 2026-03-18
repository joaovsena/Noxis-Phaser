<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import Slot from './components/Slot.svelte';
  import { inferEquipSlot } from './lib/itemTooltip';
  import { activateInventoryItem, beginDrag, dragStore, endDrag, equippedSlots, hideTooltip, inventorySlots, inventoryStore, moveInventoryItem, sendUiMessage, showTooltip } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();

  let search = '';
  let splitTarget: any = null;
  let splitAmount = 1;
  let deleteTarget: any = null;

  $: normalizedSearch = search.trim().toLowerCase();
  $: visibleSlots = $inventorySlots.map((entry) => ({
    ...entry,
    hidden: normalizedSearch.length > 0 && !String(entry.item?.name || entry.item?.templateId || '')
      .toLowerCase()
      .includes(normalizedSearch)
  }));
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
</script>

<Window title="Inventario" subtitle="Reliquias e espolios" width="432px" on:close={() => dispatch('close')}>
  <div class="inventory-toolbar">
    <input bind:value={search} class="search-input" type="search" placeholder="Buscar item..." />
    <button class="sort-btn" type="button" on:click={() => sendUiMessage({ type: 'inventory_sort' })}>Ordenar</button>
  </div>

  <div class="inventory-grid">
    {#each visibleSlots as slot (slot.slotIndex)}
      <div class="inventory-drop-shell" role="group" aria-label={`Inventario ${slot.slotIndex + 1}`} on:dragover|preventDefault on:drop={(event) => handleDrop(slot.slotIndex, event)}>
        <Slot
          item={slot.item}
          searchHidden={slot.hidden}
          on:ctrlclick={(event) => openSplit(event.detail)}
          on:contextaction={(event) => openDelete(event.detail)}
          on:dragstart={(event) => event.detail && beginDrag({ source: 'inventory', itemId: String(event.detail.id) })}
          on:dblactivate={(event) => event.detail && activateInventoryItem(event.detail)}
          on:inspect={(event) => inspectItem(event.detail.item, event.detail.x, event.detail.y)}
          on:inspectend={hideTooltip}
        />
      </div>
    {/each}
  </div>

  <div class="delete-dropzone" role="button" tabindex="-1" on:dragover|preventDefault on:drop={handleDeleteDrop}>
    Arraste aqui para destruir um item
  </div>

  {#if splitTarget}
    <div class="split-modal">
      <div class="split-title">Dividir Pilha</div>
      <p>{splitTarget.name}</p>
      <input bind:value={splitAmount} min="1" max={splitMax} type="number" />
      <div class="split-actions">
        <button type="button" on:click={confirmSplit}>Confirmar</button>
        <button type="button" class="ghost" on:click={() => splitTarget = null}>Cancelar</button>
      </div>
    </div>
  {/if}

  {#if deleteTarget}
    <div class="split-modal danger">
      <div class="split-title">Destruir Item</div>
      <p>{deleteTarget.name}</p>
      <div class="split-actions">
        <button type="button" on:click={confirmDelete}>Destruir</button>
        <button type="button" class="ghost" on:click={() => deleteTarget = null}>Cancelar</button>
      </div>
    </div>
  {/if}
</Window>

<style>
  .inventory-toolbar {
    display: flex;
    gap: 10px;
    margin-bottom: 14px;
  }

  .search-input,
  .sort-btn,
  .split-modal input,
  .split-actions button {
    pointer-events: auto;
  }

  .search-input,
  .split-modal input {
    flex: 1;
    min-height: 42px;
    border: 1px solid rgba(201, 168, 106, 0.26);
    background: linear-gradient(180deg, rgba(8, 9, 10, 0.96), rgba(4, 6, 7, 0.98));
    color: #f2e7c6;
    padding: 0 12px;
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
  }

  .search-input::placeholder {
    color: rgba(194, 181, 157, 0.38);
  }

  .search-input:focus,
  .split-modal input:focus {
    outline: none;
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.14), 0 0 16px rgba(201, 168, 106, 0.1);
  }

  .sort-btn,
  .split-actions button {
    min-height: 42px;
    border: 1px solid rgba(201, 168, 106, 0.3);
    background: linear-gradient(180deg, rgba(57, 41, 20, 0.96), rgba(27, 20, 11, 0.98));
    color: #f3e2bc;
    padding: 0 14px;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
  }

  .inventory-grid {
    display: grid;
    grid-template-columns: repeat(6, 52px);
    gap: 10px;
  }

  .delete-dropzone {
    margin-top: 14px;
    min-height: 42px;
    display: grid;
    place-items: center;
    border: 1px dashed rgba(205, 116, 100, 0.42);
    background: linear-gradient(180deg, rgba(36, 14, 12, 0.94), rgba(16, 8, 8, 0.98));
    color: #efc1b5;
    font-family: 'Cinzel', serif;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
  }

  .inventory-drop-shell {
    min-width: 52px;
    min-height: 52px;
  }

  .split-modal {
    margin-top: 14px;
    padding: 14px;
    border: 1px solid rgba(201, 168, 106, 0.22);
    background:
      radial-gradient(circle at top, rgba(201, 168, 106, 0.07), transparent 34%),
      linear-gradient(180deg, rgba(13, 11, 10, 0.96), rgba(7, 7, 8, 0.98));
    clip-path: polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px);
  }

  .split-modal.danger {
    border-color: rgba(205, 116, 100, 0.26);
    background:
      radial-gradient(circle at top, rgba(205, 116, 100, 0.08), transparent 34%),
      linear-gradient(180deg, rgba(21, 11, 10, 0.96), rgba(10, 7, 8, 0.98));
  }

  .split-title {
    font-family: 'Cinzel', serif;
    color: #f3dfb1;
    margin-bottom: 6px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  p {
    margin: 0 0 10px;
    color: rgba(220, 211, 191, 0.78);
    font-size: 0.82rem;
  }

  .split-actions {
    display: flex;
    gap: 8px;
    margin-top: 10px;
  }

  .ghost {
    background: rgba(16, 20, 24, 0.95) !important;
  }

  @media (max-width: 560px) {
    .inventory-grid {
      grid-template-columns: repeat(5, 52px);
    }
  }
</style>
