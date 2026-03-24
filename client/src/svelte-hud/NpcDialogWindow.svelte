<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import { inferEquipSlot } from './lib/itemTooltip';
  import { acceptQuest, buyNpcOffer, completeQuest, enterDungeonFromNpc, equippedSlots, hideTooltip, inventoryStore, npcStore, partyStore, sendUiMessage, showTooltip } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();
  let selectedClassTab = 'knight';

  $: dialog = $npcStore.dialog;
  $: npcId = String(dialog?.npc?.id || '');
  $: availableQuestIds = Array.isArray(dialog?.availableQuestIds) ? dialog.availableQuestIds.map(String) : [];
  $: turnInQuestIds = Array.isArray(dialog?.turnInQuestIds) ? dialog.turnInQuestIds.map(String) : [];
  $: quests = Array.isArray(dialog?.quests) ? dialog.quests : [];
  $: shopOffers = Array.isArray(dialog?.shopOffers) ? dialog.shopOffers : [];
  $: hasClassOffers = shopOffers.some((offer: any) => String(offer?.requiredClass || '').length > 0);
  $: filteredOffers = hasClassOffers ? shopOffers.filter((offer: any) => String(offer?.requiredClass || '').toLowerCase() === selectedClassTab) : shopOffers;
  $: wallet = $inventoryStore.wallet || {};
  $: walletCopper = (Number(wallet.diamond || 0) * 1000000) + (Number(wallet.gold || 0) * 10000) + (Number(wallet.silver || 0) * 100) + Number(wallet.copper || 0);
  $: inventoryItems = Array.isArray($inventoryStore.inventory) ? $inventoryStore.inventory : [];
  $: party = $partyStore.party;
  $: partyMemberCount = Array.isArray(party?.members) ? party.members.length : 0;
  $: dungeonEntry = dialog?.dungeonEntry || null;
  $: canSell = shopOffers.length > 0;
  $: sellableItems = inventoryItems.filter((item: any) => Number(item?.quantity || 1) > 0);

  function walletText(price: any) {
    const safe = price && typeof price === 'object' ? price : {};
    return [`${Number(safe.diamond || 0)}d`, `${Number(safe.gold || 0)}g`, `${Number(safe.silver || 0)}s`, `${Number(safe.copper || 0)}c`]
      .filter((entry) => !entry.startsWith('0'))
      .join(' ') || '0c';
  }

  function priceCopper(price: any) {
    const safe = price && typeof price === 'object' ? price : {};
    return (Number(safe.diamond || 0) * 1000000) + (Number(safe.gold || 0) * 10000) + (Number(safe.silver || 0) * 100) + Number(safe.copper || 0);
  }

  function inspectOffer(offer: any, x: number, y: number) {
    if (!offer) return;
    const equipSlot = inferEquipSlot(offer);
    showTooltip({
      kind: 'item',
      item: { ...offer, quantity: 1 },
      equipped: equipSlot ? $equippedSlots[equipSlot] || null : null,
      showSell: true
    }, x, y);
  }

  function inspectInventoryItem(item: any, x: number, y: number) {
    if (!item) return;
    const equipSlot = inferEquipSlot(item);
    showTooltip({
      kind: 'item',
      item,
      equipped: equipSlot ? $equippedSlots[equipSlot] || null : null,
      showSell: true
    }, x, y);
  }

  function sellItem(item: any) {
    if (!npcId || !item?.id) return;
    sendUiMessage({ type: 'sell_item_req', npcId, itemId: String(item.id) });
  }
</script>

{#if dialog}
  <Window title={dialog.npc?.name || 'NPC'} subtitle="Interacao" width="clamp(520px, 54vw, 680px)" maxWidth="680px" maxBodyHeight="min(82vh, 860px)" on:close={() => dispatch('close')}>
    <div class="greeting">{dialog.npc?.greeting || 'Saudacoes, aventureiro.'}</div>

    {#if dungeonEntry}
      <section class="block">
        <div class="block-title">Dungeon: {dungeonEntry.name || 'Instancia'}</div>
        <div class="block-text">{dungeonEntry.description || 'Entre com seu grupo e derrote o boss.'}</div>
        <div class="actions">
          {#if !dungeonEntry.opened}
            <button type="button" on:click={() => enterDungeonFromNpc(npcId, 'open')}>Abrir Dungeon</button>
          {:else if party && partyMemberCount > 1}
            <button type="button" class="ghost" on:click={() => enterDungeonFromNpc(npcId, 'solo')}>Entrar Solo</button>
            <button type="button" on:click={() => enterDungeonFromNpc(npcId, 'group')}>Levar Grupo</button>
          {:else}
            <button type="button" on:click={() => enterDungeonFromNpc(npcId, 'solo')}>Entrar</button>
          {/if}
        </div>
      </section>
    {/if}

    {#if quests.length}
      <section class="stack">
        {#each quests as quest}
          <article class="block">
            <div class="block-title">{quest.title || quest.id || 'Quest'}</div>
            <div class="block-text">{quest.description || ''}</div>
            {#if Array.isArray(quest.objectives)}
              <div class="objective-list">
                {#each quest.objectives as objective}
                  <div class="objective">{objective.text || objective.id || 'Objetivo'} ({Number(objective.required || 1)})</div>
                {/each}
              </div>
            {/if}
            <div class="actions">
              {#if availableQuestIds.includes(String(quest.id || ''))}
                <button type="button" class="ghost" on:click={() => acceptQuest(String(quest.id || ''))}>Aceitar</button>
              {/if}
              {#if turnInQuestIds.includes(String(quest.id || ''))}
                <button type="button" on:click={() => completeQuest(String(quest.id || ''))}>Concluir</button>
              {/if}
            </div>
          </article>
        {/each}
      </section>
    {/if}

    {#if shopOffers.length}
      <section class="stack">
        <div class="shop-head">
          <div class="block-title">Loja</div>
          <div class="wallet">Saldo: {walletText(wallet)}</div>
        </div>
        {#if hasClassOffers}
          <div class="tabs">
            {#each ['knight', 'archer', 'druid', 'assassin'] as tab}
              <button class:active={selectedClassTab === tab} type="button" on:click={() => selectedClassTab = tab}>{tab}</button>
            {/each}
          </div>
        {/if}
        {#if filteredOffers.length}
          <div class="shop-list">
            {#each filteredOffers as offer}
              <article class={`shop-card ${walletCopper < priceCopper(offer.price) ? 'disabled' : ''}`} on:mousemove={(event) => inspectOffer(offer, event.clientX, event.clientY)} on:mouseleave={hideTooltip}>
                <div>
                  <div class="block-title">{offer.name || 'Item'}</div>
                  {#if offer.requiredClass}
                    <div class="block-text">Classe: {offer.requiredClass}</div>
                  {/if}
                  <div class="block-text">Custo: {walletText(offer.price)}</div>
                </div>
                <button type="button" disabled={walletCopper < priceCopper(offer.price)} on:click={() => buyNpcOffer(npcId, String(offer.offerId || ''), 1)}>Comprar</button>
              </article>
            {/each}
          </div>
        {:else}
          <div class="empty-state">Sem itens para esta classe.</div>
        {/if}
      </section>
    {/if}

    {#if canSell}
      <section class="stack">
        <div class="shop-head">
          <div class="block-title">Venda</div>
          <div class="wallet">Itens no inventario: {sellableItems.length}</div>
        </div>
        {#if sellableItems.length}
          <div class="shop-list">
            {#each sellableItems as item}
              <article class="shop-card" on:mousemove={(event) => inspectInventoryItem(item, event.clientX, event.clientY)} on:mouseleave={hideTooltip}>
                <div>
                  <div class="block-title">{item.name || item.templateId || 'Item'}</div>
                  <div class="block-text">Qtd: {Math.max(1, Number(item.quantity || 1))}</div>
                  <div class="block-text">Tipo: {item.type || 'misc'}</div>
                </div>
                <button type="button" class="ghost" on:click={() => sellItem(item)}>Vender</button>
              </article>
            {/each}
          </div>
        {:else}
          <div class="empty-state">Nenhum item disponivel para vender.</div>
        {/if}
      </section>
    {/if}
  </Window>
{/if}

<style>
  .stack,
  .objective-list,
  .shop-list {
    display: grid;
    gap: 10px;
  }

  .greeting,
  .block,
  .tabs button,
  .actions button,
  .shop-card {
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
  }

  .greeting,
  .block {
    margin-bottom: 10px;
    padding: 12px;
    border: 1px solid rgba(201, 168, 106, 0.2);
    background: rgba(10, 10, 10, 0.72);
    color: rgba(233, 223, 200, 0.78);
    font-size: 0.8rem;
  }

  .block-title {
    font-family: 'Cinzel', serif;
    color: #f0dfbc;
    margin-bottom: 4px;
  }

  .block-text,
  .objective,
  .wallet,
  .empty-state {
    color: rgba(233, 223, 200, 0.72);
    font-size: 0.78rem;
  }

  .actions,
  .shop-head,
  .tabs {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .shop-head {
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .tabs {
    margin-bottom: 10px;
  }

  .tabs button,
  .actions button,
  .shop-card button {
    min-height: 38px;
    border: 1px solid rgba(201, 168, 106, 0.28);
    background: linear-gradient(180deg, rgba(33, 24, 14, 0.96), rgba(12, 10, 8, 0.98));
    color: #ecdcb8;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0 14px;
  }

  .tabs button.active {
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.14), 0 0 16px rgba(201, 168, 106, 0.14);
  }

  .ghost {
    background: rgba(16, 20, 24, 0.95) !important;
  }

  .shop-card {
    display: flex;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 12px;
    align-items: start;
    padding: 12px;
    border: 1px solid rgba(201, 168, 106, 0.2);
    background: rgba(10, 10, 10, 0.72);
  }

  .shop-card button {
    margin-left: auto;
  }

  .shop-card.disabled {
    opacity: 0.56;
  }

  @media (max-width: 700px) {
    .shop-head {
      align-items: start;
    }

    .shop-head,
    .tabs {
      justify-content: flex-start;
    }
  }
</style>
