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
    { id: 'consumables', label: 'Consum.' }
  ] as const;

  let activeCategory: typeof categories[number]['id'] = 'all';
  let search = '';
  let searchOpen = false;
  let splitTarget: any = null;
  let splitAmount = 1;
  let deleteTarget: any = null;

  $: normalizedSearch = search.trim().toLowerCase();
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

  function toggleSearch() {
    if (searchOpen) search = '';
    searchOpen = !searchOpen;
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

  function normalizeWallet(source: any) {
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

  $: walletDisplay = normalizeWallet(wallet);
  $: walletTokens = [
    { key: 'diamond', amount: walletDisplay.diamond, css: 'coin-diamond' },
    { key: 'gold', amount: walletDisplay.gold, css: 'coin-gold' },
    { key: 'silver', amount: walletDisplay.silver, css: 'coin-silver' },
    { key: 'copper', amount: walletDisplay.copper, css: 'coin-copper' }
  ];
</script>

<Window title="Inventario" subtitle="Bolsa" width="clamp(430px, 38vw, 500px)" maxWidth="500px" maxBodyHeight="min(74vh, 620px)" on:close={() => dispatch('close')}>
  <div class="inventory-shell">
    <div class="inventory-topbar">
      <div class="category-row">
        {#each categories as category}
          <button class={`hud-tab category-chip ${activeCategory === category.id ? 'active' : 'ghost'}`} type="button" on:click={() => activeCategory = category.id}>
            {category.label}
          </button>
        {/each}
      </div>
    </div>

    {#if searchOpen}
      <div class="search-row">
        <input bind:value={search} class="hud-input" type="search" placeholder="Buscar item..." />
      </div>
    {/if}

    <div class="inventory-body">
      <div class="inventory-grid">
        {#each visibleSlots as slot (slot.slotIndex)}
          <div class={`inventory-drop-shell ${slot.hidden ? 'filtered' : ''}`} role="group" aria-label={`Inventario ${slot.slotIndex + 1}`} on:dragover|preventDefault on:drop={(event) => handleDrop(slot.slotIndex, event)}>
            <Slot
              item={slot.item}
              size={48}
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

      <aside class="actions-sidebar">
        <button class="side-action" type="button" on:click={() => sendUiMessage({ type: 'inventory_sort' })}>Ordenar</button>
        <button class={`side-action ${searchOpen || normalizedSearch ? 'active' : ''}`} type="button" on:click={toggleSearch}>Buscar</button>
        <div class={`side-action drop-action ${deleteTarget ? 'active' : ''}`} role="button" tabindex="-1" on:dragover|preventDefault on:drop={handleDeleteDrop}>
          Destruir
        </div>
      </aside>
    </div>

    <div class="inventory-footer">
      <div class="wallet-strip" aria-label="Carteira">
        <span class="wallet-label">Moeda</span>
        <div class="wallet-chain">
          {#each walletTokens as token}
            <span class="wallet-token">
              <span class={`coin-dot ${token.css}`}></span>
              <span class="coin-amount">{token.amount}</span>
            </span>
          {/each}
        </div>
      </div>
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
  .inventory-body {
    display: grid;
    gap: 8px;
  }

  .modal-card {
    padding: 10px;
    border-radius: 14px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(7, 9, 12, 0.62);
  }

  .inventory-topbar,
  .search-row,
  .inventory-footer {
    min-width: 0;
  }

  .inventory-body {
    grid-template-columns: max-content 88px;
    align-items: start;
    justify-content: start;
    gap: 4px;
  }

  .actions-sidebar {
    display: grid;
    gap: 5px;
  }

  .wallet-strip,
  .wallet-chain,
  .wallet-token {
    display: flex;
    align-items: center;
  }

  .wallet-strip {
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
  }

  .wallet-label {
    font-family: var(--hud-font-display);
    color: var(--hud-gold);
    font-size: 0.64rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .wallet-chain {
    flex-wrap: wrap;
    gap: 10px;
  }

  .wallet-token {
    gap: 4px;
  }

  .coin-dot {
    width: 14px;
    height: 14px;
    border-radius: 999px;
    display: inline-block;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.25) inset, 0 0 6px rgba(0, 0, 0, 0.35);
  }

  .coin-diamond {
    background: radial-gradient(circle at 30% 28%, #b9ecff, #4aaeff 56%, #2366be);
  }

  .coin-gold {
    background: radial-gradient(circle at 30% 28%, #ffe8ab, #e0b33a 58%, #936b13);
  }

  .coin-silver {
    background: radial-gradient(circle at 30% 28%, #f2f6ff, #b8c2d4 58%, #6a768c);
  }

  .coin-copper {
    background: radial-gradient(circle at 30% 28%, #f2c4a6, #bf6f3c 58%, #7f4221);
  }

  .coin-amount {
    min-width: 12px;
    color: var(--hud-text);
    font-size: 0.9rem;
    font-weight: 700;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }

  .category-row {
    display: flex;
    gap: 3px;
    overflow-x: auto;
    padding-bottom: 2px;
    scrollbar-width: none;
  }

  .category-row::-webkit-scrollbar {
    display: none;
  }

  .search-row :global(.hud-input) {
    min-height: 34px;
    padding: 0 10px;
    font-size: 0.74rem;
  }

  .category-chip {
    min-width: fit-content;
    min-height: 22px;
    padding: 0 7px;
    font-size: 0.52rem;
    letter-spacing: 0.03em;
    white-space: nowrap;
  }

  .hud-tab.active {
    border-color: rgba(201, 168, 106, 0.42);
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.12), 0 0 12px rgba(201, 168, 106, 0.1);
  }

  .inventory-grid {
    display: grid;
    grid-template-columns: repeat(6, 48px);
    gap: 2px;
    justify-content: start;
    align-content: start;
  }

  .inventory-drop-shell {
    position: relative;
    min-width: 48px;
    min-height: 48px;
  }

  .inventory-drop-shell.filtered {
    opacity: 0.4;
  }

  .inventory-footer {
    padding-top: 2px;
  }

  .side-action {
    min-height: 28px;
    display: grid;
    place-items: center;
    padding: 0 6px;
    border-radius: 10px;
    border: 1px solid rgba(201, 168, 106, 0.24);
    background: linear-gradient(180deg, rgba(28, 22, 15, 0.94), rgba(10, 8, 7, 0.98));
    color: #f0dfbc;
    font-family: var(--hud-font-display);
    font-size: 0.58rem;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
  }

  .side-action:hover,
  .side-action.active {
    transform: translateY(-1px);
    border-color: rgba(201, 168, 106, 0.4);
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.08), 0 0 12px rgba(201, 168, 106, 0.12);
  }

  .drop-action {
    border-style: dashed;
    color: #efc1b5;
    border-color: rgba(205, 116, 100, 0.36);
    background: linear-gradient(180deg, rgba(36, 14, 12, 0.92), rgba(16, 8, 8, 0.98));
  }

  .drop-action:hover,
  .drop-action.active {
    border-color: rgba(205, 116, 100, 0.58);
    box-shadow: 0 0 0 1px rgba(205, 116, 100, 0.08), 0 0 12px rgba(205, 116, 100, 0.1);
  }

  .modal-card {
    grid-column: 1 / -1;
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

  @media (max-width: 760px) {
    .inventory-body {
      grid-template-columns: 1fr;
    }

    .wallet-strip {
      justify-content: flex-start;
    }

    .actions-sidebar {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .inventory-grid {
      justify-content: start;
    }
  }
</style>
