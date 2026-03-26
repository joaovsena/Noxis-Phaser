<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import Slot from './components/Slot.svelte';
  import { displayItemName } from './lib/itemTooltip';
  import {
    cancelTrade,
    closeTradePanel,
    confirmTrade,
    inventoryStore,
    lockTrade,
    removeTradeOfferItem,
    respondTradeRequest,
    setTradeOfferItem,
    setTradeOfferWallet,
    tradeStore
  } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();

  let desiredQuantities: Record<string, number> = {};
  let walletOffer = { copper: 0, silver: 0, gold: 0, diamond: 0 };
  let lastWalletSignature = '';
  let lastSessionId = '';

  $: tradeState = $tradeStore.state || null;
  $: incomingRequest = tradeState?.incomingRequest || null;
  $: outgoingRequest = tradeState?.outgoingRequest || null;
  $: session = tradeState?.session || null;
  $: sessionId = String(session?.sessionId || '');
  $: partner = session?.partner || null;
  $: selfOffer = session?.self || null;
  $: otherOffer = session?.other || null;
  $: transferableInventory = ($inventoryStore.inventory || []).filter(isTradeableClientItem);
  $: walletSignature = JSON.stringify(selfOffer?.wallet || {});
  $: if (sessionId !== lastSessionId || walletSignature !== lastWalletSignature) {
    lastSessionId = sessionId;
    lastWalletSignature = walletSignature;
    walletOffer = {
      copper: Number(selfOffer?.wallet?.copper || 0),
      silver: Number(selfOffer?.wallet?.silver || 0),
      gold: Number(selfOffer?.wallet?.gold || 0),
      diamond: Number(selfOffer?.wallet?.diamond || 0)
    };
  }

  function isTradeableClientItem(item: any) {
    if (!item || typeof item !== 'object') return false;
    if (item.equipped === true) return false;
    if (item.locked === true || item.questItem === true) return false;
    if (item.noTrade === true || item.nonTradable === true || item.tradable === false) return false;
    if (item.bound === true || item.bindOnPickup === true || item.bindOnEquip === true) return false;
    if (String(item.bindingType || 'unbound').toLowerCase() !== 'unbound') return false;
    return true;
  }

  function desiredQuantityFor(item: any) {
    const itemId = String(item?.id || '');
    const max = Math.max(1, Number(item?.quantity || 1));
    return Math.max(1, Math.min(max, Math.floor(Number(desiredQuantities[itemId] || max))));
  }

  function offerItem(item: any) {
    if (!item?.id) return;
    setTradeOfferItem(String(item.id), desiredQuantityFor(item));
  }

  function updateWalletOffer() {
    setTradeOfferWallet(walletOffer);
  }

  function closeWindow() {
    cancelTrade();
    closeTradePanel();
    dispatch('close');
  }
</script>

<Window title="Troca" subtitle="Negociacao entre jogadores" width="clamp(720px, 70vw, 920px)" maxWidth="920px" maxBodyHeight="min(82vh, 860px)" on:close={closeWindow}>
  <div class="trade-shell">
    {#if incomingRequest && !session}
      <section class="hud-section compact request-card">
        <div>
          <div class="hud-kicker">Pedido recebido</div>
          <div class="hud-title">{incomingRequest.fromName || 'Jogador'}</div>
          <div class="hud-meta">Deseja iniciar uma troca com voce.</div>
        </div>
        <div class="actions">
          <button class="hud-btn" type="button" on:click={() => respondTradeRequest(String(incomingRequest.requestId || ''), true)}>Aceitar</button>
          <button class="hud-btn ghost" type="button" on:click={() => respondTradeRequest(String(incomingRequest.requestId || ''), false)}>Recusar</button>
        </div>
      </section>
    {:else if outgoingRequest && !session}
      <section class="hud-section compact request-card">
        <div>
          <div class="hud-kicker">Pedido enviado</div>
          <div class="hud-title">{outgoingRequest.toName || 'Jogador'}</div>
          <div class="hud-meta">Aguardando resposta para iniciar a troca.</div>
        </div>
        <div class="actions">
          <button class="hud-btn ghost" type="button" on:click={cancelTrade}>Cancelar</button>
        </div>
      </section>
    {:else if session}
      <section class="hud-section compact hero">
        <div>
          <div class="hud-kicker">Parceiro</div>
          <div class="hud-title">{partner?.name || 'Jogador'}</div>
          <div class="hud-meta">{partner?.class || 'classe'} | Nv. {Number(partner?.level || 1)}</div>
        </div>
        <div class="trade-status">
          <span class={`hud-pill ${selfOffer?.locked ? 'positive' : 'warning'}`}>Seu lock {selfOffer?.locked ? 'on' : 'off'}</span>
          <span class={`hud-pill ${otherOffer?.locked ? 'positive' : 'warning'}`}>Lock dele {otherOffer?.locked ? 'on' : 'off'}</span>
          <span class={`hud-pill ${selfOffer?.confirmed ? 'positive' : ''}`}>Sua confirmacao {selfOffer?.confirmed ? 'ok' : '-'}</span>
          <span class={`hud-pill ${otherOffer?.confirmed ? 'positive' : ''}`}>Confirmacao dele {otherOffer?.confirmed ? 'ok' : '-'}</span>
        </div>
      </section>

      <section class="trade-columns">
        <article class="hud-section compact offer-panel">
          <div class="panel-head">
            <div class="section-title">Sua oferta</div>
            <div class="hud-meta">Clique em um item abaixo para ofertar.</div>
          </div>

          <div class="wallet-grid">
            {#each [
              ['copper', 'Cobre'],
              ['silver', 'Prata'],
              ['gold', 'Ouro'],
              ['diamond', 'Diamante']
            ] as [key, label]}
              <label class="wallet-field">
                <span>{label}</span>
                <input bind:value={walletOffer[key]} class="hud-input" type="number" min="0" on:change={updateWalletOffer} />
              </label>
            {/each}
          </div>

          <div class="offer-list">
            {#if selfOffer?.items?.length}
              {#each selfOffer.items as entry}
                <div class="offer-row">
                  <div class="offer-item">
                    <Slot item={entry.item} size={42} />
                    <div>
                      <div class="row-title">{displayItemName(entry.item)}</div>
                      <div class="hud-meta">Qtd {Number(entry.quantity || 1)}</div>
                    </div>
                  </div>
                  <button class="hud-btn mini ghost" type="button" on:click={() => removeTradeOfferItem(String(entry.itemId || ''))}>Remover</button>
                </div>
              {/each}
            {:else}
              <div class="hud-empty">Nenhum item ofertado.</div>
            {/if}
          </div>

          <div class="panel-head">
            <div class="section-title">Itens disponiveis</div>
          </div>
          <div class="inventory-list">
            {#if transferableInventory.length}
              {#each transferableInventory as item}
                <div class="offer-row">
                  <div class="offer-item">
                    <Slot item={item} size={42} />
                    <div>
                      <div class="row-title">{displayItemName(item)}</div>
                      <div class="hud-meta">Qtd {Math.max(1, Number(item.quantity || 1))}</div>
                    </div>
                  </div>
                  <div class="inline-actions">
                    {#if Number(item.quantity || 1) > 1}
                      <input bind:value={desiredQuantities[item.id]} class="hud-input qty-input" type="number" min="1" max={Math.max(1, Number(item.quantity || 1))} />
                    {/if}
                    <button class="hud-btn mini" type="button" on:click={() => offerItem(item)}>Ofertar</button>
                  </div>
                </div>
              {/each}
            {:else}
              <div class="hud-empty">Nenhum item transferivel no inventario.</div>
            {/if}
          </div>
        </article>

        <article class="hud-section compact offer-panel">
          <div class="panel-head">
            <div class="section-title">Oferta de {partner?.name || 'Jogador'}</div>
          </div>
          <div class="wallet-preview">
            <span>{Number(otherOffer?.wallet?.copper || 0)}c</span>
            <span>{Number(otherOffer?.wallet?.silver || 0)}s</span>
            <span>{Number(otherOffer?.wallet?.gold || 0)}g</span>
            <span>{Number(otherOffer?.wallet?.diamond || 0)}d</span>
          </div>
          <div class="offer-list">
            {#if otherOffer?.items?.length}
              {#each otherOffer.items as entry}
                <div class="offer-row">
                  <div class="offer-item">
                    <Slot item={entry.item} size={42} />
                    <div>
                      <div class="row-title">{displayItemName(entry.item)}</div>
                      <div class="hud-meta">Qtd {Number(entry.quantity || 1)}</div>
                    </div>
                  </div>
                </div>
              {/each}
            {:else}
              <div class="hud-empty">A outra oferta ainda esta vazia.</div>
            {/if}
          </div>
        </article>
      </section>

      <div class="actions footer-actions">
        <button class="hud-btn ghost" type="button" on:click={cancelTrade}>Cancelar</button>
        <button class="hud-btn" type="button" on:click={lockTrade}>Travar</button>
        <button class="hud-btn" type="button" disabled={!selfOffer?.locked || !otherOffer?.locked} on:click={confirmTrade}>Confirmar</button>
      </div>
    {:else}
      <div class="hud-empty">Nenhuma troca ativa.</div>
    {/if}
  </div>
</Window>

<style>
  .trade-shell,
  .trade-columns,
  .offer-list,
  .inventory-list,
  .trade-status,
  .wallet-grid {
    display: grid;
    gap: 12px;
  }

  .trade-columns {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .compact {
    padding: 12px 14px;
  }

  .request-card,
  .hero {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }

  .wallet-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .wallet-field,
  .offer-row,
  .offer-item,
  .inline-actions,
  .footer-actions {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .wallet-field {
    flex-direction: column;
    align-items: stretch;
  }

  .wallet-field span,
  .section-title,
  .row-title {
    color: var(--hud-gold);
    font-family: var(--hud-font-display);
    text-transform: uppercase;
  }

  .wallet-preview {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    color: var(--hud-warning);
    font-family: var(--hud-font-display);
  }

  .offer-row {
    justify-content: space-between;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(7, 9, 12, 0.58);
  }

  .offer-item {
    min-width: 0;
    flex: 1;
  }

  .qty-input {
    width: 72px;
  }

  .footer-actions {
    justify-content: flex-end;
  }

  @media (max-width: 860px) {
    .trade-columns {
      grid-template-columns: 1fr;
    }

    .request-card,
    .hero,
    .offer-row {
      display: grid;
      grid-template-columns: 1fr;
      align-items: stretch;
    }
  }
</style>
