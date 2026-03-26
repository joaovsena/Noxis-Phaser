<script lang="ts">
  import { onMount } from 'svelte';
  import { tooltipStore } from './stores/gameUi';
  import {
    classLabel,
    compareBonusEntries,
    computeSellCopper,
    displayItemName,
    inferItemTier,
    itemTypeLabel,
    normalizeWallet,
    qualityLabel,
    rarityLabel,
    resolveItemRarity,
    statLabel
  } from './lib/itemTooltip';

  const TOOLTIP_WIDTH = 332;
  const TOOLTIP_HEIGHT = 420;

  let viewportWidth = 1920;
  let viewportHeight = 1080;

  $: payload = $tooltipStore.payload;
  $: item = payload?.item || null;
  $: equipped = payload?.equipped || null;
  $: rarity = resolveItemRarity(item);
  $: title = displayItemName(item);
  $: quantity = Math.max(1, Math.floor(Number(item?.quantity || 1)));
  $: itemTier = inferItemTier(item);
  $: comparison = compareBonusEntries(item, equipped);
  $: metaTags = [
    qualityLabel(item),
    quantity > 1 ? `Qtd ${quantity}` : ''
  ].filter(Boolean);
  $: infoRows = [
    { label: 'Tipo do item', value: itemTypeLabel(item), tone: 'neutral' },
    item?.requiredLevel ? { label: 'Exigencia de nivel', value: `Nivel ${item.requiredLevel}`, tone: 'positive' } : null,
    itemTier ? { label: 'Nivel do item', value: `Nivel ${itemTier}`, tone: 'neutral' } : null,
    item?.requiredClass ? { label: 'Classe', value: classLabel(String(item.requiredClass)), tone: 'positive' } : null
  ].filter(Boolean);
  $: sellWallet = payload?.showSell
    ? normalizeWallet(item?.sellPrice && typeof item.sellPrice === 'object' ? item.sellPrice : { copper: computeSellCopper(item) })
    : null;
  $: sellTokens = sellWallet
    ? ([
      { key: 'diamond', amount: sellWallet.diamond, css: 'coin-diamond' },
      { key: 'gold', amount: sellWallet.gold, css: 'coin-gold' },
      { key: 'silver', amount: sellWallet.silver, css: 'coin-silver' },
      { key: 'copper', amount: sellWallet.copper, css: 'coin-copper' }
    ].filter((entry) => entry.amount > 0).length
      ? [
        { key: 'diamond', amount: sellWallet.diamond, css: 'coin-diamond' },
        { key: 'gold', amount: sellWallet.gold, css: 'coin-gold' },
        { key: 'silver', amount: sellWallet.silver, css: 'coin-silver' },
        { key: 'copper', amount: sellWallet.copper, css: 'coin-copper' }
      ].filter((entry) => entry.amount > 0)
      : [{ key: 'copper', amount: 0, css: 'coin-copper' }])
    : [];
  $: left = `${Math.min(Math.max(12, viewportWidth - TOOLTIP_WIDTH), Math.max(12, $tooltipStore.x + 18))}px`;
  $: top = `${Math.min(Math.max(12, viewportHeight - TOOLTIP_HEIGHT), Math.max(12, $tooltipStore.y + 18))}px`;

  onMount(() => {
    const syncViewport = () => {
      viewportWidth = Math.max(320, window.innerWidth || 1920);
      viewportHeight = Math.max(240, window.innerHeight || 1080);
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  });

  function formatEntryValue(entry: any, value: number) {
    const safe = Number(value || 0);
    if (entry?.kind === 'percent') {
      return `${safe > 0 ? '+' : ''}${Math.round(safe * 100)}%`;
    }
    return `${safe > 0 ? '+' : ''}${safe}`;
  }
</script>

{#if $tooltipStore.visible && item}
  <aside class={`tooltip-shell rarity-${rarity}`} style={`left:${left};top:${top};`}>
    <div class="tooltip-head">
      <div class="head-copy">
        <div class="title">{title}</div>
        {#if metaTags.length}
          <div class="meta-grid">
            {#each metaTags as tag}
              <span class="meta-pill">{tag}</span>
            {/each}
          </div>
        {/if}
      </div>
      <div class="rarity-pill">{rarityLabel(item)}</div>
    </div>

    {#if infoRows.length}
      <div class="info-grid">
        {#each infoRows as row}
          <div class="info-row">
            <span class="info-label">{row.label}</span>
            <strong class={`info-value ${row.tone || 'neutral'}`}>{row.value}</strong>
          </div>
        {/each}
      </div>
    {/if}

    <div class="divider"></div>

    {#if comparison.length}
      {#if equipped}
        <div class="section-title">Comparacao rapida</div>
      {:else}
        <div class="section-title">Atributos</div>
      {/if}
      <div class="stats-grid">
        {#each comparison as entry}
          <div class="stat-row">
            <span class="stat-label">{statLabel(String(entry.key || ''))}{entry.kind === 'percent' ? ' %' : ''}</span>
            <div class="stat-values">
              <span class={`current ${!equipped || entry.diff > 0 ? 'pos' : entry.diff < 0 ? 'neg' : 'neutral'}`}>{formatEntryValue(entry, entry.value)}</span>
              {#if equipped && entry.diff !== 0}
                <span class={`diff ${entry.diff > 0 ? 'pos' : 'neg'}`}>({formatEntryValue(entry, entry.diff)})</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {:else if String(item?.type || '').includes('potion') || Number(item?.healPercent || 0) > 0}
      <div class="section-title">Efeito</div>
      <div class="muted">
        {#if Number(item?.healPercent || 0) > 0}
          Recupera {Math.round(Number(item.healPercent || 0) * 100)}% do HP ao usar.
        {:else}
          Recupera HP ao usar.
        {/if}
      </div>
    {:else}
      <div class="section-title">Descricao</div>
      <div class="muted">Sem atributos declarados.</div>
    {/if}

    {#if payload?.showSell}
      <div class="divider"></div>
      <div class="price-row">
        <span class="section-title price-title">Preco</span>
        <div class="wallet-chain">
          {#each sellTokens as token}
            <span class="wallet-token">
              <span class={`coin-dot ${token.css}`}></span>
              <span class="coin-amount">{token.amount}</span>
            </span>
          {/each}
        </div>
      </div>
    {/if}
  </aside>
{/if}

<style>
  .tooltip-shell {
    position: fixed;
    z-index: 1200;
    width: min(320px, calc(100vw - 24px));
    padding: 14px 14px 12px;
    pointer-events: none;
    border-radius: 18px;
    border: 1px solid rgba(201, 168, 106, 0.26);
    background:
      linear-gradient(180deg, rgba(34, 28, 20, 0.96), rgba(10, 8, 7, 0.985)),
      radial-gradient(circle at top, rgba(201, 168, 106, 0.08), transparent 46%);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.03) inset,
      0 18px 36px rgba(0, 0, 0, 0.42);
    color: #f0dfbc;
    font-size: 0.78rem;
  }

  .tooltip-head,
  .head-copy,
  .info-grid,
  .price-row,
  .wallet-chain,
  .wallet-token,
  .stat-row,
  .stat-values {
    display: flex;
    gap: 10px;
  }

  .tooltip-head {
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .head-copy,
  .info-grid {
    flex-direction: column;
  }

  .head-copy {
    gap: 6px;
    min-width: 0;
  }

  .title,
  .section-title {
    font-family: var(--hud-font-display);
  }

  .title {
    font-size: 0.96rem;
    line-height: 1.18;
    color: #f4e5c2;
    text-shadow: 0 0 10px rgba(0, 0, 0, 0.4);
  }

  .rarity-pill,
  .meta-pill {
    padding: 4px 9px;
    border-radius: 999px;
    border: 1px solid rgba(201, 168, 106, 0.16);
    background: rgba(12, 14, 18, 0.78);
    color: rgba(241, 230, 205, 0.84);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .meta-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .info-grid {
    gap: 4px;
    margin-bottom: 4px;
  }

  .info-row,
  .price-row {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 14px;
  }

  .info-label {
    color: rgba(212, 191, 145, 0.82);
    font-size: 0.72rem;
  }

  .info-value {
    font-size: 0.76rem;
    color: #efe7d7;
    text-align: right;
  }

  .info-value.positive {
    color: #71ea79;
  }

  .divider {
    height: 1px;
    margin: 12px 0;
    background: linear-gradient(90deg, rgba(201, 168, 106, 0.2), rgba(201, 168, 106, 0.08));
  }

  .section-title {
    margin-bottom: 8px;
    color: #f0dfbc;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.72rem;
  }

  .stats-grid {
    display: grid;
    gap: 6px;
  }

  .stat-row {
    align-items: center;
    justify-content: space-between;
    color: rgba(239, 231, 215, 0.84);
  }

  .stat-label {
    color: rgba(239, 231, 215, 0.92);
  }

  .stat-values {
    align-items: center;
    justify-content: flex-end;
    gap: 8px;
    font-weight: 700;
  }

  .current {
    color: rgba(239, 231, 215, 0.94);
  }

  .current.pos,
  .diff.pos,
  .equipped-name {
    color: #74ed78;
  }

  .current.neg,
  .diff.neg {
    color: #f2a6a1;
  }

  .current.neutral,
  .muted {
    color: rgba(233, 223, 200, 0.72);
  }

  .price-row {
    align-items: center;
  }

  .price-title {
    margin: 0;
  }

  .wallet-chain {
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 10px;
  }

  .wallet-token {
    align-items: center;
    gap: 4px;
  }

  .coin-dot {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    display: inline-block;
    box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.24) inset, 0 0 6px rgba(0, 0, 0, 0.36);
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

  .rarity-verde .title {
    color: #90e07f;
  }

  .rarity-azul .title {
    color: #7cb7ff;
  }

  .rarity-roxo .title {
    color: #c58cff;
  }

  .rarity-laranja .title {
    color: #ffc46b;
  }
</style>
