<script lang="ts">
  import { questTrackerStore } from './stores/gameUi';
</script>

<section class="tracker hud-section">
  <div class="tracker-head">
    <div>
      <div class="hud-kicker">Objetivos</div>
      <div class="hud-title">Rastreador de quests</div>
    </div>
    <div class="tracker-count">{$questTrackerStore.length}</div>
  </div>

  {#if $questTrackerStore.length}
    <div class="tracker-list">
      {#each $questTrackerStore as quest}
        <article class="quest-card">
          <div class="quest-top">
            <div class="quest-title">{quest.title}</div>
            <span class="status-pill">{quest.status}</span>
          </div>
          {#if quest.objectives.length}
            <div class="objective-list">
              {#each quest.objectives.slice(0, 2) as objective}
                <div class="objective-row">
                  <span>{objective.text}</span>
                  <strong>{objective.current}/{objective.required}</strong>
                </div>
              {/each}
            </div>
          {:else}
            <div class="hud-meta">Sem objetivos detalhados.</div>
          {/if}
        </article>
      {/each}
    </div>
  {:else}
    <div class="hud-empty">Nenhuma quest ativa.</div>
  {/if}
</section>

<style>
  .tracker {
    padding: 12px 14px;
  }

  .tracker-head,
  .quest-top,
  .objective-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .tracker-head {
    margin-bottom: 12px;
  }

  .tracker-count {
    color: var(--hud-text-soft);
    font-size: 0.74rem;
  }

  .tracker-list,
  .objective-list {
    display: grid;
    gap: 10px;
  }

  .quest-card {
    padding: 12px;
    border-radius: 14px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(7, 9, 12, 0.58);
  }

  .quest-title {
    font-family: var(--hud-font-display);
    color: var(--hud-gold);
    font-size: 0.8rem;
    text-transform: uppercase;
  }

  .status-pill {
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid rgba(201, 168, 106, 0.14);
    color: var(--hud-warning);
    font-size: 0.66rem;
    text-transform: uppercase;
  }

  .objective-row {
    color: var(--hud-text-soft);
    font-size: 0.76rem;
  }

  strong {
    color: var(--hud-gold);
    font-size: 0.72rem;
  }
</style>
