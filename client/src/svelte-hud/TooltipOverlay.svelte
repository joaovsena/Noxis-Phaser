<script lang="ts">
  import { onMount } from 'svelte';
  import { tooltipStore } from './stores/gameUi';
  import { classLabel, compareBonusEntries, computeSellCopper, goldValueFromCopper, inventoryCategory, rarityLabel, resolveItemRarity } from './lib/itemTooltip';

  let viewportWidth = 1920;
  let viewportHeight = 1080;

  $: payload = $tooltipStore.payload;
  $: item = payload?.item || null;
  $: equipped = payload?.equipped || null;
  $: rarity = resolveItemRarity(item);
  $: quantity = Math.max(1, Math.floor(Number(item?.quantity || 1)));
  $: comparison = compareBonusEntries(item, equipped);
  $: left = `${Math.min(viewportWidth - 320, Math.max(12, $tooltipStore.x + 18))}px`;
  $: top = `${Math.min(viewportHeight - 260, Math.max(12, $tooltipStore.y + 18))}px`;

  onMount(() => {
    const syncViewport = () => {
      viewportWidth = Math.max(320, window.innerWidth || 1920);
      viewportHeight = Math.max(240, window.innerHeight || 1080);
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  });

  function formatDiff(value: number) {
    const safe = Number(value || 0);
    if (safe === 0) return '=';
    return `${safe > 0 ? '+' : ''}${safe}`;
  }
</script>

{#if $tooltipStore.visible && item}
  <aside class={`tooltip-shell rarity-${rarity}`} style={`left:${left};top:${top};`}>
    <div class="tooltip-head">
      <div class="title">{item.name || item.templateId || 'Item'}</div>
      <div class="rarity-pill">{rarityLabel(item)}</div>
    </div>

    <div class="meta-grid">
      <span class="meta-pill">{inventoryCategory(item)}</span>
      <span class="meta-pill">Qtd {quantity}</span>
      {#if item.requiredClass}
        <span class="meta-pill">{classLabel(String(item.requiredClass))}</span>
      {/if}
      {#if payload?.showSell}
        <span class="meta-pill">Venda {goldValueFromCopper(computeSellCopper(item))}G</span>
      {/if}
    </div>

    <div class="divider"></div>

    {#if comparison.length}
      <div class="section-title">Comparacao rapida</div>
      <div class="stats-grid">
        {#each comparison as entry}
          <div class="stat-row">
            <span>{String(entry.key).toUpperCase()}</span>
            <div class="stat-values">
              <span class="current">{entry.value > 0 ? '+' : ''}{entry.value}</span>
              {#if equipped}
                <span class={`diff ${entry.diff > 0 ? 'pos' : entry.diff < 0 ? 'neg' : 'neutral'}`}>{formatDiff(entry.diff)}</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    {:else if String(item?.type || '') === 'potion_hp'}
      <div class="section-title">Consumivel</div>
      <div class="muted">Recupera HP ao usar.</div>
    {:else}
      <div class="section-title">Informacao</div>
      <div class="muted">Sem bonus declarados.</div>
    {/if}

    {#if equipped}
      <div class="divider"></div>
      <div class="section-title">Equipado no slot</div>
      <div class="equipped-name">{equipped.name || 'Item equipado'}</div>
    {/if}
  </aside>
{/if}

<style>
  .tooltip-shell {
    position: fixed;
    z-index: 1200;
    width: 300px;
    padding: 14px;
    pointer-events: none;
    border-radius: 16px;
    border: 1px solid rgba(201, 168, 106, 0.3);
    background: linear-gradient(180deg, rgba(12, 10, 9, 0.98), rgba(8, 8, 8, 0.99));
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.38);
    color: #f0dfbc;
    font-size: 0.78rem;
  }

  .tooltip-head,
  .stat-row,
  .stat-values {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .tooltip-head {
    margin-bottom: 10px;
  }

  .title,
  .section-title {
    font-family: var(--hud-font-display);
  }

  .title {
    font-size: 0.9rem;
    color: #f4e5c2;
  }

  .rarity-pill,
  .meta-pill {
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid rgba(201, 168, 106, 0.16);
    background: rgba(11, 14, 18, 0.72);
    color: rgba(233, 223, 200, 0.78);
    font-size: 0.66rem;
    text-transform: uppercase;
  }

  .meta-grid {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .divider {
    height: 1px;
    margin: 12px 0;
    background: rgba(201, 168, 106, 0.16);
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
    color: rgba(239, 231, 215, 0.84);
  }

  .stat-values {
    gap: 8px;
  }

  .current {
    color: rgba(239, 231, 215, 0.9);
  }

  .diff {
    font-weight: 700;
  }

  .diff.pos {
    color: #9bdfaa;
  }

  .diff.neg {
    color: #efb4a6;
  }

  .diff.neutral,
  .muted,
  .equipped-name {
    color: rgba(233, 223, 200, 0.72);
  }

  .rarity-rare .title {
    color: #7cb7ff;
  }

  .rarity-epic .title {
    color: #c58cff;
  }

  .rarity-legendary .title {
    color: #ffc46b;
  }
</style>
