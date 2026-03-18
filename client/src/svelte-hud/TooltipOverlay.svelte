<script lang="ts">
  import { onMount } from 'svelte';
  import { tooltipStore } from './stores/gameUi';
  import { bonusEntries, classLabel, computeSellCopper, goldValueFromCopper, rarityLabel, resolveItemRarity } from './lib/itemTooltip';

  let viewportWidth = 1920;
  let viewportHeight = 1080;

  $: payload = $tooltipStore.payload;
  $: item = payload?.item || null;
  $: equipped = payload?.equipped || null;
  $: rarity = resolveItemRarity(item);
  $: quantity = Math.max(1, Math.floor(Number(item?.quantity || 1)));
  $: itemBonuses = bonusEntries(item);
  $: equippedBonuses = bonusEntries(equipped);
  $: left = `${Math.min(viewportWidth - 260, Math.max(12, $tooltipStore.x + 18))}px`;
  $: top = `${Math.min(viewportHeight - 220, Math.max(12, $tooltipStore.y + 18))}px`;

  onMount(() => {
    const syncViewport = () => {
      viewportWidth = Math.max(320, window.innerWidth || 1920);
      viewportHeight = Math.max(240, window.innerHeight || 1080);
    };
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  });
</script>

{#if $tooltipStore.visible && item}
  <aside class="tooltip-shell rarity-{rarity}" style={`left:${left};top:${top};`}>
    <div class="title">{item.name || item.templateId || 'Item'}</div>
    <div class="muted">Raridade: {rarityLabel(item)}</div>
    <div class="divider"></div>
    <div class="muted">Tipo: {item.type || 'generic'}</div>
    {#if item.requiredClass}
      <div class="muted">Classe: {classLabel(String(item.requiredClass))}</div>
    {/if}
    {#if String(item?.type || '') === 'potion_hp'}
      <div>Consumivel</div>
      <div>Recupera HP</div>
    {:else if itemBonuses.length}
      {#each itemBonuses as [key, value]}
        <div class:value-pos={Number(value) >= 0} class:value-neg={Number(value) < 0}>{String(key).toUpperCase()}: {Number(value) > 0 ? '+' : ''}{Number(value)}</div>
      {/each}
    {:else}
      <div class="muted">Sem bonus declarados.</div>
    {/if}
    <div class="muted">Qtd: {quantity}</div>
    {#if payload?.showSell}
      <div class="muted">Venda: {goldValueFromCopper(computeSellCopper(item))} Gold</div>
    {/if}
    {#if equipped}
      <div class="divider"></div>
      <div class="muted">Equipado: {equipped.name || 'Item'}</div>
      {#if equippedBonuses.length}
        {#each equippedBonuses as [key, value]}
          <div class:value-pos={Number(value) >= 0} class:value-neg={Number(value) < 0}>{String(key).toUpperCase()}: {Number(value) > 0 ? '+' : ''}{Number(value)}</div>
        {/each}
      {:else}
        <div class="muted">Sem bonus declarados.</div>
      {/if}
    {/if}
  </aside>
{/if}

<style>
  .tooltip-shell {
    position: fixed;
    z-index: 1200;
    width: 240px;
    padding: 12px 14px;
    pointer-events: none;
    clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px);
    border: 1px solid rgba(201, 168, 106, 0.3);
    background: linear-gradient(180deg, rgba(12, 10, 9, 0.98), rgba(8, 8, 8, 0.99));
    box-shadow: 0 18px 36px rgba(0, 0, 0, 0.38);
    color: #f0dfbc;
    font-size: 0.78rem;
  }

  .title {
    font-family: 'Cinzel', serif;
    margin-bottom: 4px;
  }

  .muted {
    color: rgba(233, 223, 200, 0.72);
  }

  .divider {
    height: 1px;
    margin: 8px 0;
    background: rgba(201, 168, 106, 0.16);
  }

  .value-pos {
    color: #9bdfaa;
  }

  .value-neg {
    color: #efb4a6;
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
