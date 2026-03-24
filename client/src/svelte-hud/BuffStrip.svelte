<script lang="ts">
  import { onDestroy } from 'svelte';

  export let title = 'Efeitos';
  export let effects: Array<{ id: string; label: string; shortLabel: string; expiresAt: number; beneficial: boolean }> = [];
  export let emptyLabel = 'Nenhum efeito ativo';

  let now = Date.now();
  const timer = typeof window !== 'undefined'
    ? window.setInterval(() => {
        now = Date.now();
      }, 250)
    : 0;

  onDestroy(() => {
    if (timer) window.clearInterval(timer);
  });

  function remainingText(expiresAt: number) {
    const remainingMs = Math.max(0, Number(expiresAt || 0) - now);
    if (remainingMs >= 10000) return `${Math.ceil(remainingMs / 1000)}s`;
    if (remainingMs > 0) return `${(remainingMs / 1000).toFixed(1)}s`;
    return '0s';
  }
</script>

<section class="buff-strip hud-section">
  <div class="buff-head">
    <div class="hud-kicker">{title}</div>
    <div class="buff-count">{effects.length}</div>
  </div>

  {#if effects.length}
    <div class="buff-list">
      {#each effects as effect (effect.id)}
        <div class={`buff-chip ${effect.beneficial ? 'positive' : 'warning'}`} title={effect.label}>
          <span class="label">{effect.shortLabel}</span>
          <span class="time">{remainingText(effect.expiresAt)}</span>
        </div>
      {/each}
    </div>
  {:else}
    <div class="hud-empty">{emptyLabel}</div>
  {/if}
</section>

<style>
  .buff-strip {
    min-width: 0;
    padding: 12px 14px;
  }

  .buff-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }

  .buff-count {
    color: var(--hud-text-soft);
    font-size: 0.74rem;
  }

  .buff-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .buff-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 30px;
    padding: 0 10px;
    border-radius: 999px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(8, 11, 14, 0.72);
    color: var(--hud-text-soft);
    font-size: 0.72rem;
  }

  .buff-chip.positive {
    border-color: rgba(134, 208, 148, 0.22);
    color: var(--hud-positive);
  }

  .buff-chip.warning {
    border-color: rgba(240, 207, 143, 0.2);
    color: var(--hud-warning);
  }

  .label {
    font-family: var(--hud-font-display);
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .time {
    color: rgba(255, 244, 221, 0.84);
    font-size: 0.68rem;
  }
</style>
