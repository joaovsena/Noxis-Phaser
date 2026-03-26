<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import {
    classLabel,
    displayItemName,
    inferEquipSlot,
    itemTypeLabel,
    normalizeWallet
  } from './lib/itemTooltip';
  import {
    acceptQuest,
    attributesStore,
    buyNpcOffer,
    completeQuest,
    enterDungeonFromNpc,
    equippedSlots,
    hideTooltip,
    inventoryStore,
    npcStore,
    partyStore,
    sendUiMessage,
    showTooltip
  } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();

  let selectedClassTab = 'knight';
  let activePanel: 'dialog' | 'quest' | 'shop' | 'sell' = 'dialog';
  let selectedQuestId = '';
  let dialogKey = '';
  let purchasePrompt: { offer: any; quantity: number } | null = null;

  $: dialog = $npcStore.dialog;
  $: npcId = String(dialog?.npc?.id || '');
  $: availableQuestIds = Array.isArray(dialog?.availableQuestIds) ? dialog.availableQuestIds.map(String) : [];
  $: turnInQuestIds = Array.isArray(dialog?.turnInQuestIds) ? dialog.turnInQuestIds.map(String) : [];
  $: quests = Array.isArray(dialog?.quests) ? dialog.quests : [];
  $: selectedQuest = quests.find((quest: any) => String(quest?.id || '') === selectedQuestId) || quests[0] || null;
  $: shopOffers = Array.isArray(dialog?.shopOffers) ? dialog.shopOffers : [];
  $: offerClassTabs = Array.from(new Set(shopOffers.map((offer: any) => String(offer?.requiredClass || '').toLowerCase()).filter(Boolean)));
  $: hasClassOffers = offerClassTabs.length > 0;
  $: filteredOffers = hasClassOffers
    ? shopOffers.filter((offer: any) => String(offer?.requiredClass || '').toLowerCase() === selectedClassTab)
    : shopOffers;
  $: wallet = $inventoryStore.wallet || {};
  $: walletCopper = (Number(wallet.diamond || 0) * 1000000) + (Number(wallet.gold || 0) * 10000) + (Number(wallet.silver || 0) * 100) + Number(wallet.copper || 0);
  $: inventoryItems = Array.isArray($inventoryStore.inventory) ? $inventoryStore.inventory : [];
  $: party = $partyStore.party;
  $: partyMemberCount = Array.isArray(party?.members) ? party.members.length : 0;
  $: dungeonEntry = dialog?.dungeonEntry || null;
  $: canSell = shopOffers.length > 0;
  $: sellableItems = inventoryItems.filter((item: any) => Number(item?.quantity || 1) > 0);
  $: playerClass = String($attributesStore.player?.class || 'knight').toLowerCase();
  $: playerWalletTokens = walletTokens(wallet);
  $: merchantIntro = activePanel === 'dialog' && shopOffers.length > 0 && !quests.length && !dungeonEntry;
  $: npcMood = {
    npc_ferreiro_borin: { label: 'Metalurgia', kicker: 'Armas e aco pesado', accent: '#d8a866', shopRole: 'Ferreiro', shopTab: 'Armas' },
    npc_armeira_maeve: { label: 'Armaduras', kicker: 'Vestes, malhas e couracas', accent: '#c7b58a', shopRole: 'Armeira', shopTab: 'Armaduras' },
    npc_joalheiro_orin: { label: 'Joias', kicker: 'Anelaria e relicarios', accent: '#84c3ff', shopRole: 'Joalheiro', shopTab: 'Joias' },
    npc_mercadora_tessa: { label: 'Suprimentos', kicker: 'Pocoes, materiais e utilidades', accent: '#8fd593', shopRole: 'Vendedora de itens variados', shopTab: 'Itens' }
  }[npcId] || { label: 'Interacao', kicker: 'Dialogo e progresso', accent: '#d8a866', shopRole: 'Comerciante', shopTab: 'Mercadoria' };
  $: npcGlyph = String(dialog?.npc?.name || 'N').slice(0, 1).toUpperCase() || 'N';
  $: merchantTitle = shopOffers.length > 0 ? `${dialog?.npc?.name || 'NPC'} (${npcMood.shopRole})` : (dialog?.npc?.name || 'NPC');

  $: if (dialog) {
    const nextKey = [npcId, quests.length, shopOffers.length, Number(Boolean(dungeonEntry)), offerClassTabs.join('|'), playerClass].join(':');
    if (nextKey !== dialogKey) {
      dialogKey = nextKey;
      selectedQuestId = quests[0] ? String(quests[0]?.id || '') : '';
      selectedClassTab = offerClassTabs.includes(playerClass) ? playerClass : (offerClassTabs[0] || playerClass || 'knight');
      purchasePrompt = null;
      activePanel = shopOffers.length ? 'dialog' : quests.length ? 'quest' : 'dialog';
    }

    if (selectedQuestId && !quests.some((quest: any) => String(quest?.id || '') === selectedQuestId)) {
      selectedQuestId = quests[0] ? String(quests[0]?.id || '') : '';
    }

    if (activePanel === 'quest' && !quests.length) activePanel = shopOffers.length ? 'dialog' : 'dialog';
    if (activePanel === 'shop' && !shopOffers.length) activePanel = quests.length ? 'quest' : 'dialog';
    if (activePanel === 'sell' && !canSell) activePanel = shopOffers.length ? 'shop' : quests.length ? 'quest' : 'dialog';
  } else {
    dialogKey = '';
    purchasePrompt = null;
  }

  function walletTokens(source: any) {
    const safe = normalizeWallet(source && typeof source === 'object' ? source : { copper: Number(source || 0) });
    const tokens = [
      { key: 'diamond', amount: safe.diamond, css: 'coin-diamond' },
      { key: 'gold', amount: safe.gold, css: 'coin-gold' },
      { key: 'silver', amount: safe.silver, css: 'coin-silver' },
      { key: 'copper', amount: safe.copper, css: 'coin-copper' }
    ].filter((entry) => entry.amount > 0);
    return tokens.length ? tokens : [{ key: 'copper', amount: 0, css: 'coin-copper' }];
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

  function chooseQuest(questId: string) {
    selectedQuestId = questId;
    activePanel = 'quest';
  }

  function openShop() {
    purchasePrompt = null;
    activePanel = 'shop';
  }

  function openSell() {
    purchasePrompt = null;
    activePanel = 'sell';
  }

  function bundleLabel(offer: any) {
    const quantity = Math.max(1, Number(offer?.quantity || 1));
    return quantity > 1 ? `Pacote x${quantity}` : '';
  }

  function requestBuy(offer: any) {
    if (!npcId || !offer || walletCopper < priceCopper(offer.price)) return;
    if (inferEquipSlot(offer)) {
      buyNpcOffer(npcId, String(offer.offerId || ''), 1);
      return;
    }
    purchasePrompt = { offer, quantity: 1 };
  }

  function getPromptMaxQuantity() {
    if (!purchasePrompt?.offer) return 1;
    return Math.max(1, Math.min(999, Math.floor(walletCopper / Math.max(1, priceCopper(purchasePrompt.offer.price))) || 1));
  }

  function getPromptPriceTokens() {
    if (!purchasePrompt?.offer) return walletTokens({ copper: 0 });
    return walletTokens({ copper: priceCopper(purchasePrompt.offer.price) * Math.max(1, Number(purchasePrompt.quantity || 1)) });
  }

  function setPromptQuantity(nextQuantity: number) {
    if (!purchasePrompt) return;
    purchasePrompt = {
      ...purchasePrompt,
      quantity: Math.max(1, Math.min(getPromptMaxQuantity(), Math.floor(Number(nextQuantity || 1))))
    };
  }

  function adjustPromptQuantity(delta: number) {
    setPromptQuantity(Number(purchasePrompt?.quantity || 1) + delta);
  }

  function handlePromptInput(event: Event) {
    const target = event.currentTarget as HTMLInputElement | null;
    setPromptQuantity(Number(target?.value || 1));
  }

  function confirmPromptPurchase() {
    if (!npcId || !purchasePrompt?.offer) return;
    buyNpcOffer(
      npcId,
      String(purchasePrompt.offer.offerId || ''),
      Math.max(1, Math.min(getPromptMaxQuantity(), Number(purchasePrompt.quantity || 1)))
    );
    purchasePrompt = null;
  }
</script>

{#if dialog}
  {#if activePanel === 'shop' || activePanel === 'sell'}
    <section class="shop-shell" style={`--npc-accent:${npcMood.accent};`}>
      <header class="shop-header" data-window-drag-handle="true">
        <div class="header-copy">
          <div class="header-kicker">{dialog.npc?.name || 'NPC'}</div>
          <div class="header-title">{activePanel === 'sell' ? 'Venda' : 'Loja'}</div>
        </div>
        <button class="close-btn" type="button" aria-label="Fechar dialogo" on:click={() => dispatch('close')}>x</button>
      </header>

      <div class="shop-toolbar">
        <div class="shop-tabs">
          {#if hasClassOffers}
            {#each offerClassTabs as tab}
              <button class:active={selectedClassTab === tab} type="button" on:click={() => selectedClassTab = tab}>
                {classLabel(tab)}
              </button>
            {/each}
          {:else}
            <button class="active" type="button">{npcMood.shopTab}</button>
          {/if}
        </div>

        <div class="wallet-strip">
          {#each playerWalletTokens as token}
            <span class="wallet-token">
              <span class={`coin-dot ${token.css}`}></span>
              <span class="coin-amount">{token.amount}</span>
            </span>
          {/each}
        </div>
      </div>

      <div class="shop-body">
        {#if activePanel === 'shop'}
          {#if filteredOffers.length}
            <div class="shop-grid">
              {#each filteredOffers as offer}
                <article class={`shop-card ${walletCopper < priceCopper(offer.price) ? 'disabled' : ''}`} on:mousemove={(event) => inspectOffer(offer, event.clientX, event.clientY)} on:mouseleave={hideTooltip}>
                  <div class="shop-card-main">
                    <div class="shop-icon-frame">
                      {#if offer.iconUrl}
                        <img class="shop-icon" src={offer.iconUrl} alt={displayItemName(offer)} />
                      {/if}
                    </div>

                    <div class="shop-copy">
                      <div class="card-title">{displayItemName(offer)}</div>
                      <div class="card-meta">
                        {#if offer.requiredLevel}<span>Nv {offer.requiredLevel}</span>{/if}
                        {#if offer.requiredClass}<span>{classLabel(String(offer.requiredClass))}</span>{/if}
                        {#if bundleLabel(offer)}<span>{bundleLabel(offer)}</span>{/if}
                      </div>
                      <div class="shop-price-row">
                        {#each walletTokens(offer.price) as token}
                          <span class="wallet-token compact">
                            <span class={`coin-dot ${token.css}`}></span>
                            <span class="coin-amount">{token.amount}</span>
                          </span>
                        {/each}
                      </div>
                    </div>
                  </div>

                  <button type="button" class="secondary shop-action" disabled={walletCopper < priceCopper(offer.price)} on:click={() => requestBuy(offer)}>Comprar</button>
                </article>
              {/each}
            </div>
          {:else}
            <div class="empty-state">Sem itens disponiveis para esta classe.</div>
          {/if}
        {:else}
          {#if sellableItems.length}
            <div class="shop-grid">
              {#each sellableItems as item}
                <article class="shop-card" on:mousemove={(event) => inspectInventoryItem(item, event.clientX, event.clientY)} on:mouseleave={hideTooltip}>
                  <div class="shop-card-main">
                    <div class="shop-icon-frame">
                      {#if item.iconUrl}
                        <img class="shop-icon" src={item.iconUrl} alt={displayItemName(item)} />
                      {/if}
                    </div>

                    <div class="shop-copy">
                      <div class="card-title">{displayItemName(item)}</div>
                      <div class="card-meta">
                        <span>{itemTypeLabel(item)}</span>
                        <span>Qtd {Math.max(1, Number(item.quantity || 1))}</span>
                      </div>
                      <div class="shop-price-row">
                        {#each walletTokens(item.sellPrice || { copper: 0 }) as token}
                          <span class="wallet-token compact">
                            <span class={`coin-dot ${token.css}`}></span>
                            <span class="coin-amount">{token.amount}</span>
                          </span>
                        {/each}
                      </div>
                    </div>
                  </div>

                  <button type="button" class="secondary shop-action" on:click={() => sellItem(item)}>Vender</button>
                </article>
              {/each}
            </div>
          {:else}
            <div class="empty-state">Nenhum item disponivel para vender.</div>
          {/if}
        {/if}
      </div>

      <div class="shop-footer">
        <div class="shop-footer-group">
          <button type="button" class="secondary footer-btn" disabled>Reparar</button>
          <button type="button" class="secondary footer-btn" disabled>Reparar tudo</button>
        </div>

        <div class="shop-footer-group right">
          {#if activePanel === 'sell'}
            <button type="button" class="secondary footer-btn" on:click={openShop}>Comprar</button>
          {:else}
            <button type="button" class="secondary footer-btn" on:click={openSell}>Vender</button>
          {/if}
        </div>
      </div>

      {#if purchasePrompt}
        <div class="purchase-popover">
          <div class="purchase-stepper">
            <button type="button" on:click={() => adjustPromptQuantity(-1)}>&lt;</button>
            <input class="purchase-input" type="number" min="1" max={getPromptMaxQuantity()} value={Math.max(1, Number(purchasePrompt.quantity || 1))} on:input={handlePromptInput} />
            <button type="button" on:click={() => adjustPromptQuantity(1)}>&gt;</button>
          </div>

          <div class="purchase-price">
            {#each getPromptPriceTokens() as token}
              <span class="wallet-token compact">
                <span class={`coin-dot ${token.css}`}></span>
                <span class="coin-amount">{token.amount}</span>
              </span>
            {/each}
          </div>

          <div class="purchase-actions">
            <button type="button" class="secondary footer-btn" on:click={confirmPromptPurchase}>Confirmar</button>
            <button type="button" class="secondary footer-btn" on:click={() => purchasePrompt = null}>Cancelar</button>
          </div>
        </div>
      {/if}
    </section>
  {:else if merchantIntro}
    <section class="merchant-dialog-shell" style={`--npc-accent:${npcMood.accent};`}>
      <div class="merchant-portrait">
        <div class="npc-avatar-core">{npcGlyph}</div>
      </div>

      <div class="merchant-dialog-panel">
        <button class="close-btn merchant-close" type="button" aria-label="Fechar dialogo" on:click={() => dispatch('close')}>x</button>
        <div class="merchant-title">{merchantTitle}:</div>
        <p class="merchant-speech">{dialog.npc?.greeting || 'Saudacoes, aventureiro.'}</p>

        <div class="merchant-options">
          <button class="choice-button merchant-option" type="button" on:click={openShop}>Trocar</button>
          <button class="choice-button merchant-option exit" type="button" on:click={() => dispatch('close')}>Sair</button>
        </div>
      </div>
    </section>
  {:else}
    <section class="npc-dialog-shell" style={`--npc-accent:${npcMood.accent};`}>
      <header class="npc-dialog-header" data-window-drag-handle="true">
        <div class="header-copy">
          <div class="header-kicker">{npcMood.label}</div>
          <div class="header-title">{dialog.npc?.name || 'NPC'}</div>
        </div>
        <button class="close-btn" type="button" aria-label="Fechar dialogo" on:click={() => dispatch('close')}>x</button>
      </header>

      <div class="npc-dialog-scene">
        <div class="npc-avatar">
          <div class="npc-avatar-core">{npcGlyph}</div>
        </div>

        <div class="npc-speech">
          <div class="npc-name">{dialog.npc?.name || 'NPC'}</div>
          <p>{dialog.npc?.greeting || 'Saudacoes, aventureiro.'}</p>
        </div>
      </div>

      <div class="npc-choice-list">
        {#if quests.length}
          {#each quests as quest}
            <button class={`choice-button ${activePanel === 'quest' && selectedQuestId === String(quest?.id || '') ? 'active' : ''}`} type="button" on:click={() => chooseQuest(String(quest?.id || ''))}>
              {quest.title || quest.id || 'Quest'}
            </button>
          {/each}
        {/if}

        {#if dungeonEntry}
          <button class={`choice-button ${activePanel === 'dialog' ? 'active' : ''}`} type="button" on:click={() => activePanel = 'dialog'}>
            {dungeonEntry.name || 'Entrada especial'}
          </button>
        {/if}

        {#if shopOffers.length}
          <button class="choice-button" type="button" on:click={openShop}>Trocar</button>
        {/if}

        <button class="choice-button exit" type="button" on:click={() => dispatch('close')}>Sair</button>
      </div>

      <div class="npc-detail-panel">
        {#if activePanel === 'quest' && selectedQuest}
          <section class="detail-block">
            <div class="detail-kicker">{selectedQuest.category === 'main' ? 'Trilha principal' : 'Missao secundaria'}</div>
            <h3>{selectedQuest.title || selectedQuest.id || 'Quest'}</h3>
            <p>{selectedQuest.description || 'Sem descricao adicional.'}</p>

            {#if Array.isArray(selectedQuest.objectives) && selectedQuest.objectives.length}
              <div class="objective-list">
                {#each selectedQuest.objectives as objective}
                  <div class="objective-row">
                    <span>{objective.text || objective.id || 'Objetivo'}</span>
                    <strong>x{Number(objective.required || 1)}</strong>
                  </div>
                {/each}
              </div>
            {/if}

            {#if selectedQuest.rewards}
              <div class="reward-row">
                {#if Number(selectedQuest.rewards.xp || 0) > 0}
                  <span class="reward-pill">XP {Number(selectedQuest.rewards.xp || 0)}</span>
                {/if}
                {#if Array.isArray(selectedQuest.rewards.items)}
                  {#each selectedQuest.rewards.items as reward}
                    <span class="reward-pill">{Number(reward.quantity || 1)}x {displayItemName(reward)}</span>
                  {/each}
                {/if}
              </div>
            {/if}

            <div class="action-row">
              {#if availableQuestIds.includes(String(selectedQuest.id || ''))}
                <button type="button" class="primary" on:click={() => acceptQuest(String(selectedQuest.id || ''))}>Aceitar</button>
              {/if}
              {#if turnInQuestIds.includes(String(selectedQuest.id || ''))}
                <button type="button" class="primary" on:click={() => completeQuest(String(selectedQuest.id || ''))}>Concluir</button>
              {/if}
            </div>
          </section>
        {:else}
          <section class="detail-block">
            <div class="detail-kicker">{dungeonEntry ? 'Entrada especial' : npcMood.kicker}</div>
            <h3>{dungeonEntry?.name || dialog.npc?.name || 'Dialogo'}</h3>
            <p>{dungeonEntry?.description || 'Escolha uma opcao acima para continuar a interacao.'}</p>

            {#if dungeonEntry}
              <div class="detail-meta-line">Grupo {partyMemberCount || 1}/{Number(dungeonEntry.maxPlayers || 1)}</div>
              <div class="action-row">
                {#if !dungeonEntry.opened}
                  <button type="button" class="primary" on:click={() => enterDungeonFromNpc(npcId, 'open')}>Abrir Dungeon</button>
                {:else if party && partyMemberCount > 1}
                  <button type="button" class="secondary" on:click={() => enterDungeonFromNpc(npcId, 'solo')}>Entrar Solo</button>
                  <button type="button" class="primary" on:click={() => enterDungeonFromNpc(npcId, 'group')}>Levar Grupo</button>
                {:else}
                  <button type="button" class="primary" on:click={() => enterDungeonFromNpc(npcId, 'solo')}>Entrar</button>
                {/if}
              </div>
            {/if}
          </section>
        {/if}
      </div>
    </section>
  {/if}
{/if}

<style>
  .npc-dialog-shell,
  .shop-shell,
  .merchant-dialog-shell {
    position: relative;
    width: min(640px, calc(100vw - 24px));
    max-width: calc(100vw - 24px);
    border: 1px solid rgba(218, 192, 124, 0.58);
    border-radius: 16px;
    background:
      radial-gradient(circle at top left, color-mix(in srgb, var(--npc-accent) 22%, transparent), transparent 30%),
      linear-gradient(180deg, rgba(44, 37, 20, 0.97), rgba(14, 12, 10, 0.98));
    box-shadow:
      inset 0 1px 0 rgba(255, 237, 196, 0.16),
      inset 0 0 0 1px rgba(91, 71, 35, 0.82),
      0 24px 48px rgba(0, 0, 0, 0.34);
    overflow: hidden;
  }

  .npc-dialog-shell::before,
  .shop-shell::before,
  .merchant-dialog-shell::before {
    content: '';
    position: absolute;
    inset: 8px;
    border: 1px solid rgba(226, 207, 153, 0.24);
    border-radius: 12px;
    pointer-events: none;
  }

  .npc-dialog-header,
  .npc-dialog-scene,
  .npc-choice-list,
  .npc-detail-panel {
    position: relative;
    z-index: 1;
  }

  .shop-header,
  .shop-toolbar,
  .shop-body,
  .shop-footer,
  .merchant-dialog-panel {
    position: relative;
    z-index: 1;
  }

  .npc-dialog-header,
  .shop-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px 10px;
    border-bottom: 1px solid rgba(221, 196, 127, 0.18);
    cursor: grab;
  }

  .npc-dialog-header:active,
  .shop-header:active {
    cursor: grabbing;
  }

  .header-copy {
    display: grid;
    gap: 2px;
  }

  .header-kicker,
  .detail-kicker {
    color: rgba(231, 206, 142, 0.78);
    font-family: var(--hud-font-display);
    font-size: 0.62rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .header-title,
  .npc-name,
  h3,
  .card-title {
    margin: 0;
    color: #f7e7b9;
    font-family: var(--hud-font-display);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.72);
  }

  .header-title {
    font-size: 1rem;
  }

  .close-btn {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 1px solid rgba(231, 206, 142, 0.4);
    background: linear-gradient(180deg, rgba(70, 54, 25, 0.96), rgba(18, 15, 11, 0.98));
    color: #f5e3bb;
    font-family: var(--hud-font-display);
    font-size: 0.95rem;
  }

  .npc-dialog-scene {
    display: grid;
    grid-template-columns: 78px minmax(0, 1fr);
    gap: 12px;
    padding: 14px 16px 10px;
    align-items: center;
  }

  .npc-avatar {
    width: 72px;
    height: 88px;
    padding: 3px;
    border-radius: 16px;
    border: 1px solid rgba(228, 206, 150, 0.46);
    background:
      linear-gradient(180deg, rgba(66, 51, 25, 0.98), rgba(20, 16, 10, 0.98));
    box-shadow:
      inset 0 0 0 1px rgba(81, 61, 26, 0.86),
      0 10px 16px rgba(0, 0, 0, 0.22);
  }

  .npc-avatar-core {
    width: 100%;
    height: 100%;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background:
      radial-gradient(circle at 50% 24%, rgba(255, 255, 255, 0.24), transparent 28%),
      linear-gradient(180deg, color-mix(in srgb, var(--npc-accent) 52%, #513c5e), #1b1220 88%);
    color: #fff1ff;
    font-family: var(--hud-font-display);
    font-size: 1.8rem;
    text-transform: uppercase;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.82);
  }

  .npc-speech {
    min-width: 0;
    padding: 12px 14px;
    border-radius: 10px;
    border: 1px solid rgba(221, 196, 127, 0.2);
    background: rgba(68, 62, 38, 0.72);
    box-shadow: inset 0 1px 0 rgba(255, 241, 206, 0.08);
  }

  .npc-name {
    font-size: 0.96rem;
    margin-bottom: 8px;
  }

  .npc-speech p,
  .detail-block p,
  .card-subtext,
  .wallet-line,
  .detail-meta-line,
  .empty-state {
    margin: 0;
    color: rgba(244, 238, 220, 0.88);
    font-size: 0.84rem;
    line-height: 1.5;
  }

  .npc-choice-list {
    display: grid;
    margin: 0 16px;
    border-top: 1px solid rgba(225, 199, 130, 0.18);
    border-bottom: 1px solid rgba(225, 199, 130, 0.18);
  }

  .choice-button {
    min-height: 38px;
    padding: 8px 14px;
    border: 0;
    border-top: 1px solid rgba(225, 199, 130, 0.08);
    background: transparent;
    color: rgba(246, 230, 168, 0.92);
    font-family: var(--hud-font-display);
    font-size: 0.92rem;
    text-align: left;
  }

  .choice-button:first-child {
    border-top: 0;
  }

  .choice-button:hover,
  .choice-button.active {
    background: linear-gradient(90deg, rgba(255, 220, 92, 0.12), transparent 72%);
    color: #ffe976;
  }

  .choice-button.exit {
    color: #f8d35d;
  }

  .npc-detail-panel {
    max-height: min(46vh, 420px);
    overflow: auto;
    padding: 14px 16px 16px;
  }

  .npc-detail-panel::-webkit-scrollbar {
    width: 8px;
  }

  .npc-detail-panel::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(227, 198, 125, 0.34), rgba(105, 78, 34, 0.48));
  }

  .npc-detail-panel::-webkit-scrollbar-track {
    background: rgba(7, 6, 6, 0.34);
  }

  .detail-block {
    display: grid;
    gap: 10px;
    padding: 12px;
    border: 1px solid rgba(225, 199, 130, 0.18);
    border-radius: 10px;
    background: rgba(55, 51, 32, 0.78);
  }

  h3 {
    font-size: 1rem;
  }

  .detail-header,
  .action-row,
  .reward-row,
  .card-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .detail-header {
    justify-content: space-between;
  }

  .objective-list,
  .detail-list {
    display: grid;
    gap: 8px;
  }

  .objective-row,
  .detail-card {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 12px;
    border: 1px solid rgba(225, 199, 130, 0.14);
    border-radius: 10px;
    background: rgba(26, 23, 18, 0.64);
  }

  .objective-row {
    align-items: center;
    color: rgba(244, 238, 220, 0.86);
    font-size: 0.8rem;
  }

  .detail-card.disabled {
    opacity: 0.56;
  }

  .card-copy {
    min-width: 0;
    display: grid;
    gap: 6px;
  }

  .card-title {
    font-size: 0.88rem;
  }

  .card-meta {
    gap: 6px;
  }

  .card-meta span,
  .reward-pill {
    padding: 3px 8px;
    border-radius: 999px;
    border: 1px solid rgba(225, 199, 130, 0.16);
    background: rgba(19, 17, 14, 0.68);
    color: rgba(245, 236, 211, 0.8);
    font-size: 0.68rem;
  }

  .action-row button,
  .detail-card button {
    min-height: 32px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid rgba(225, 199, 130, 0.24);
    color: #f7e6be;
    font-family: var(--hud-font-display);
    background: linear-gradient(180deg, rgba(69, 53, 24, 0.96), rgba(22, 16, 10, 0.98));
  }

  .action-row button.primary {
    box-shadow: 0 0 0 1px rgba(225, 199, 130, 0.12), 0 0 14px rgba(225, 199, 130, 0.12);
  }

  .action-row button.secondary,
  .detail-card button.secondary {
    background: linear-gradient(180deg, rgba(26, 28, 32, 0.94), rgba(10, 11, 14, 0.98));
  }

  .merchant-dialog-shell {
    min-height: 252px;
    padding: 22px 18px 18px 118px;
  }

  .merchant-portrait {
    position: absolute;
    left: 18px;
    top: 22px;
    z-index: 2;
    width: 84px;
    height: 112px;
    padding: 4px;
    border-radius: 18px;
    border: 1px solid rgba(228, 206, 150, 0.46);
    background: linear-gradient(180deg, rgba(66, 51, 25, 0.98), rgba(20, 16, 10, 0.98));
    box-shadow: inset 0 0 0 1px rgba(81, 61, 26, 0.86), 0 10px 16px rgba(0, 0, 0, 0.22);
  }

  .merchant-dialog-panel {
    min-height: 188px;
    padding: 18px 18px 12px;
    border-top: 1px solid rgba(225, 199, 130, 0.18);
    border-bottom: 1px solid rgba(225, 199, 130, 0.18);
    background: rgba(70, 64, 39, 0.76);
  }

  .merchant-close {
    position: absolute;
    top: 12px;
    right: 12px;
  }

  .merchant-title {
    margin: 0 34px 12px 0;
    color: #ffd34e;
    font-family: var(--hud-font-display);
    font-size: 0.98rem;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.72);
  }

  .merchant-speech {
    min-height: 92px;
    margin: 0;
    color: rgba(248, 241, 224, 0.92);
    font-size: 0.98rem;
    line-height: 1.55;
  }

  .merchant-options {
    display: grid;
    margin-top: 18px;
    border-top: 1px solid rgba(225, 199, 130, 0.18);
  }

  .merchant-option {
    border-left: 0;
    border-right: 0;
    border-bottom: 0;
    background: transparent;
    color: #ffe35f;
  }

  .shop-toolbar,
  .shop-footer,
  .shop-footer-group,
  .wallet-strip,
  .wallet-token,
  .shop-card-main,
  .shop-price-row,
  .purchase-stepper,
  .purchase-price,
  .purchase-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .shop-toolbar,
  .shop-footer {
    justify-content: space-between;
    padding: 12px 16px 10px;
  }

  .shop-tabs {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .shop-tabs button,
  .footer-btn {
    min-height: 30px;
    padding: 0 14px;
    border-radius: 8px;
    border: 1px solid rgba(226, 201, 138, 0.22);
    background: linear-gradient(180deg, rgba(104, 85, 43, 0.92), rgba(60, 50, 26, 0.96));
    color: #fff1cf;
    font-family: var(--hud-font-display);
  }

  .shop-tabs button.active {
    box-shadow: 0 0 0 1px rgba(226, 201, 138, 0.12), 0 0 12px rgba(226, 201, 138, 0.12);
  }

  .wallet-strip {
    justify-content: flex-end;
  }

  .wallet-token {
    gap: 4px;
  }

  .wallet-token.compact .coin-dot {
    width: 11px;
    height: 11px;
  }

  .coin-dot {
    width: 13px;
    height: 13px;
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
    color: #f3e9d4;
    font-size: 0.84rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  .shop-body {
    max-height: min(58vh, 520px);
    overflow: auto;
    padding: 0 16px 12px;
  }

  .shop-body::-webkit-scrollbar {
    width: 8px;
  }

  .shop-body::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(227, 198, 125, 0.34), rgba(105, 78, 34, 0.48));
  }

  .shop-body::-webkit-scrollbar-track {
    background: rgba(7, 6, 6, 0.34);
  }

  .shop-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .shop-card {
    display: grid;
    gap: 10px;
    padding: 12px;
    border: 1px solid rgba(225, 199, 130, 0.16);
    border-radius: 14px;
    background: rgba(56, 49, 28, 0.86);
  }

  .shop-card.disabled {
    opacity: 0.58;
  }

  .shop-card-main {
    align-items: flex-start;
    gap: 12px;
  }

  .shop-icon-frame {
    flex: 0 0 60px;
    width: 60px;
    height: 60px;
    border-radius: 12px;
    border: 1px solid rgba(218, 192, 124, 0.26);
    background: linear-gradient(180deg, rgba(34, 28, 20, 0.94), rgba(10, 8, 7, 0.98));
    display: grid;
    place-items: center;
  }

  .shop-icon {
    width: 46px;
    height: 46px;
    object-fit: contain;
  }

  .shop-copy {
    min-width: 0;
    flex: 1;
    display: grid;
    gap: 6px;
  }

  .shop-price-row {
    justify-content: flex-start;
  }

  .shop-action {
    justify-self: end;
    min-width: 108px;
  }

  .shop-footer {
    padding-bottom: 16px;
    border-top: 1px solid rgba(225, 199, 130, 0.14);
  }

  .shop-footer-group.right {
    margin-left: auto;
  }

  .purchase-popover {
    position: absolute;
    left: 50%;
    bottom: 74px;
    z-index: 5;
    transform: translateX(-50%);
    width: min(280px, calc(100% - 32px));
    padding: 12px 14px;
    border: 1px solid rgba(225, 199, 130, 0.34);
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(58, 47, 29, 0.98), rgba(18, 14, 10, 0.98));
    box-shadow: 0 14px 28px rgba(0, 0, 0, 0.28);
  }

  .purchase-stepper,
  .purchase-price,
  .purchase-actions {
    justify-content: center;
  }

  .purchase-stepper {
    margin-bottom: 10px;
  }

  .purchase-stepper button {
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 1px solid rgba(225, 199, 130, 0.24);
    background: rgba(39, 31, 20, 0.96);
    color: #f7e6be;
  }

  .purchase-input {
    width: 84px;
    min-height: 32px;
    border-radius: 8px;
    border: 1px solid rgba(225, 199, 130, 0.22);
    background: rgba(226, 210, 194, 0.92);
    color: #2c1c12;
    text-align: center;
    font-family: var(--hud-font-display);
    font-size: 0.9rem;
  }

  .purchase-price {
    margin-bottom: 10px;
  }

  .empty-state {
    padding: 10px 12px;
    border: 1px dashed rgba(225, 199, 130, 0.2);
    border-radius: 10px;
    background: rgba(18, 16, 12, 0.42);
  }

  @media (max-width: 720px) {
    .merchant-dialog-shell {
      padding: 132px 14px 14px;
    }

    .merchant-portrait {
      left: 50%;
      transform: translateX(-50%);
    }

    .shop-grid {
      grid-template-columns: 1fr;
    }

    .npc-dialog-scene {
      grid-template-columns: 1fr;
    }

    .npc-avatar {
      width: 64px;
      height: 78px;
    }

    .detail-header,
    .objective-row,
    .detail-card {
      grid-template-columns: 1fr;
      display: grid;
    }
  }
</style>
