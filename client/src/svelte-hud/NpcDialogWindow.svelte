<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import { inferEquipSlot, qualityLabel, rarityLabel } from './lib/itemTooltip';
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
  $: npcMood = {
    npc_ferreiro_borin: { label: 'Metalurgia', kicker: 'Armas e aco pesado', accent: '#d8a866' },
    npc_armeira_maeve: { label: 'Armaduras', kicker: 'Vestes, malhas e couracas', accent: '#c7b58a' },
    npc_joalheiro_orin: { label: 'Joias', kicker: 'Anelaria e relicarios', accent: '#84c3ff' },
    npc_mercadora_tessa: { label: 'Suprimentos', kicker: 'Pocoes, materiais e utilidades', accent: '#8fd593' }
  }[npcId] || { label: 'Interacao', kicker: 'Dialogo e progresso', accent: '#d8a866' };

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
    <div class="hero" style={`--npc-accent:${npcMood.accent};`}>
      <div class="hero-kicker">{npcMood.label}</div>
      <div class="hero-title">{dialog.npc?.name || 'NPC'}</div>
      <div class="hero-subtitle">{npcMood.kicker}</div>
      <div class="hero-text">{dialog.npc?.greeting || 'Saudacoes, aventureiro.'}</div>
    </div>

    {#if dungeonEntry}
      <section class="block">
        <div class="block-head">
          <div>
            <div class="section-kicker">Entrada especial</div>
            <div class="block-title">Dungeon: {dungeonEntry.name || 'Instancia'}</div>
          </div>
          <div class="meta-inline">Grupo {partyMemberCount || 1}/{Number(dungeonEntry.maxPlayers || 1)}</div>
        </div>
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
            <div class="block-head">
              <div>
                <div class="section-kicker">{quest.category === 'main' ? 'Trilha principal' : 'Missao secundaria'}</div>
                <div class="block-title">{quest.title || quest.id || 'Quest'}</div>
              </div>
            </div>
            <div class="block-text">{quest.description || ''}</div>
            {#if Array.isArray(quest.objectives)}
              <div class="objective-list">
                {#each quest.objectives as objective}
                  <div class="objective">
                    <span>{objective.text || objective.id || 'Objetivo'}</span>
                    <strong>x{Number(objective.required || 1)}</strong>
                  </div>
                {/each}
              </div>
            {/if}
            {#if quest.rewards}
              <div class="reward-row">
                {#if Number(quest.rewards.xp || 0) > 0}
                  <span class="reward-pill">XP {Number(quest.rewards.xp || 0)}</span>
                {/if}
                {#if Array.isArray(quest.rewards.items)}
                  {#each quest.rewards.items as reward}
                    <span class="reward-pill">{Number(reward.quantity || 1)}x {reward.name || reward.templateId || 'Item'}</span>
                  {/each}
                {/if}
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
          <div>
            <div class="section-kicker">Mercadoria</div>
            <div class="block-title">Loja</div>
          </div>
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
          <div class="shop-list rich">
            {#each filteredOffers as offer}
              <article class={`shop-card ${walletCopper < priceCopper(offer.price) ? 'disabled' : ''}`} on:mousemove={(event) => inspectOffer(offer, event.clientX, event.clientY)} on:mouseleave={hideTooltip}>
                <div class="offer-main">
                  <div class="offer-title">{offer.name || 'Item'}</div>
                  <div class="offer-meta">
                    <span>{rarityLabel(offer)}</span>
                    <span>{qualityLabel(offer)}</span>
                    {#if offer.requiredLevel}<span>Nivel {offer.requiredLevel}</span>{/if}
                    {#if offer.requiredClass}<span>Classe {offer.requiredClass}</span>{/if}
                  </div>
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
          <div>
            <div class="section-kicker">Recolhimento</div>
            <div class="block-title">Venda</div>
          </div>
          <div class="wallet">Itens no inventario: {sellableItems.length}</div>
        </div>
        {#if sellableItems.length}
          <div class="shop-list rich">
            {#each sellableItems as item}
              <article class="shop-card" on:mousemove={(event) => inspectInventoryItem(item, event.clientX, event.clientY)} on:mouseleave={hideTooltip}>
                <div class="offer-main">
                  <div class="offer-title">{item.name || item.templateId || 'Item'}</div>
                  <div class="offer-meta">
                    <span>{rarityLabel(item)}</span>
                    <span>{qualityLabel(item)}</span>
                    <span>Qtd {Math.max(1, Number(item.quantity || 1))}</span>
                  </div>
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

  .hero,
  .block,
  .tabs button,
  .actions button,
  .shop-card {
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
  }

  .hero,
  .block {
    margin-bottom: 10px;
    padding: 14px;
    border: 1px solid rgba(201, 168, 106, 0.2);
    background: rgba(10, 10, 10, 0.72);
    color: rgba(233, 223, 200, 0.78);
    font-size: 0.8rem;
  }

  .hero {
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.02), transparent 48%),
      radial-gradient(circle at top right, color-mix(in srgb, var(--npc-accent) 26%, transparent), transparent 52%),
      rgba(10, 10, 10, 0.8);
    display: grid;
    gap: 4px;
  }

  .hero-kicker,
  .section-kicker {
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: rgba(201, 168, 106, 0.7);
    font-size: 0.64rem;
  }

  .hero-title {
    font-family: 'Cinzel', serif;
    color: #f0dfbc;
    font-size: 1.1rem;
  }

  .hero-subtitle,
  .hero-text,
  .meta-inline {
    color: rgba(233, 223, 200, 0.72);
    font-size: 0.78rem;
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
  .tabs,
  .block-head,
  .reward-row,
  .offer-meta {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }

  .block-head,
  .shop-head {
    justify-content: space-between;
  }

  .shop-head {
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

  .offer-main {
    display: grid;
    gap: 6px;
  }

  .offer-title {
    font-family: 'Cinzel', serif;
    color: #f2e3c0;
    font-size: 0.9rem;
  }

  .offer-meta,
  .reward-row {
    gap: 6px;
  }

  .offer-meta span,
  .reward-pill {
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid rgba(201, 168, 106, 0.16);
    background: rgba(13, 15, 18, 0.64);
    color: rgba(240, 223, 188, 0.76);
    font-size: 0.68rem;
  }

  .objective {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 10px;
    border: 1px solid rgba(201, 168, 106, 0.1);
    background: rgba(12, 12, 13, 0.44);
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
