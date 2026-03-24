<script lang="ts">
  import ProgressBar from './components/ProgressBar.svelte';
  import { attackSelectedMob, clearCurrentTarget, combatContextStore, selectedMobStore } from './stores/gameUi';

  $: hp = Number($selectedMobStore?.hp || 0);
  $: maxHp = Math.max(1, Number($selectedMobStore?.maxHp || 1));
</script>

{#if $selectedMobStore}
  <section class="target-panel">
    <div class="target-top">
      <div class="avatar">M</div>
      <div class="meta">
        <div class="eyebrow">Monstro alvo</div>
        <div class="name">{$selectedMobStore.kind || 'Monstro'} Lv.{Number($selectedMobStore.level || 1)}</div>
        <div class="meta-row">
          <span class="pill danger">Hostil</span>
          <span class={`pill ${$combatContextStore.inRange ? 'positive' : 'warning'}`}>{Math.round($combatContextStore.targetDistance)}px</span>
          <span class="pill neutral">Auto {$combatContextStore.preferredSkillLabel}</span>
        </div>
      </div>
    </div>

    <ProgressBar value={hp} max={maxHp} label={`HP ${hp} / ${maxHp}`} tone="health" />

    <div class="actions">
      <button type="button" on:click={() => attackSelectedMob($selectedMobStore?.id)}>Atacar</button>
      <button type="button" class="ghost" on:click={clearCurrentTarget}>Limpar</button>
    </div>
  </section>
{/if}

<style>
  .target-panel {
    width: 100%;
    padding: 8px 10px;
    border-radius: 16px;
    border: 1px solid rgba(201, 168, 106, 0.24);
    background: rgba(8, 11, 15, 0.7);
  }

  .target-top,
  .meta-row,
  .actions {
    display: flex;
    gap: 10px;
  }

  .target-top {
    align-items: center;
    margin-bottom: 6px;
  }

  .avatar {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: rgba(122, 22, 22, 0.9);
    border: 1px solid rgba(230, 118, 118, 0.35);
    color: #fff2d8;
    font-family: var(--hud-font-display);
  }

  .meta {
    min-width: 0;
    flex: 1;
  }

  .eyebrow {
    font-family: var(--hud-font-display);
    font-size: 0.58rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(201, 168, 106, 0.72);
  }

  .name {
    margin-top: 4px;
    color: #f0dfbc;
    font-family: var(--hud-font-display);
    font-size: 0.68rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .meta-row {
    flex-wrap: wrap;
    margin-top: 5px;
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
  .pill.positive { color: var(--hud-positive); }
  .pill.warning { color: var(--hud-warning); }
  .pill.danger { color: var(--hud-danger); }

  .actions {
    justify-content: flex-end;
    gap: 8px;
    margin-top: 6px;
  }

  .actions button {
    min-height: 24px;
    padding: 0 8px;
    border-radius: 10px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(20, 16, 13, 0.92);
    color: var(--hud-gold);
    font-family: var(--hud-font-display);
    font-size: 0.56rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .actions .ghost {
    background: rgba(16, 20, 24, 0.95);
  }
</style>
