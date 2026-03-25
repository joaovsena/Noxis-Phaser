<script lang="ts">
  import ProgressBar from './components/ProgressBar.svelte';
  import { selectedMobStore } from './stores/gameUi';

  $: target = $selectedMobStore;
  $: hp = Number(target?.hp || 0);
  $: maxHp = Math.max(1, Number(target?.maxHp || 1));
  $: hostile = Number(target?.hp || 0) > 0;
</script>

{#if target}
  <section class="target-panel mob">
    <div class="meta-row">
      <div class="identity">
        <div class="name">{target.kind || 'Monstro'} Lv.{Number(target.level || 1)}</div>
        <div class="subline">
          <span class={`pill ${hostile ? 'danger' : 'neutral'}`}>{hostile ? 'Hostil' : 'Inativo'}</span>
        </div>
      </div>
    </div>

    <ProgressBar value={hp} max={maxHp} label={`HP ${hp} / ${maxHp}`} tone="health" />
  </section>
{/if}

<style>
  .target-panel {
    width: 100%;
    padding: 8px 10px;
    border-radius: 14px;
    border: 1px solid rgba(201, 168, 106, 0.22);
    background: rgba(8, 11, 15, 0.74);
    display: grid;
    gap: 8px;
  }

  .meta-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .identity {
    min-width: 0;
    display: grid;
    gap: 4px;
  }

  .name {
    color: #f0dfbc;
    font-family: var(--hud-font-display);
    font-size: 0.74rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .subline {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .pill {
    min-height: 18px;
    padding: 0 6px;
    border-radius: 999px;
    border: 1px solid rgba(201, 168, 106, 0.16);
    display: inline-flex;
    align-items: center;
    font-size: 0.54rem;
    text-transform: uppercase;
  }

  .pill.neutral { color: rgba(233, 223, 200, 0.78); }
  .pill.danger { color: var(--hud-danger); }
</style>
