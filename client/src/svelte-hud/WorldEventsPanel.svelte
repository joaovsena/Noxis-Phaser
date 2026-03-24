<script lang="ts">
  import { activeEventsStore, worldStore } from './stores/gameUi';
</script>

<section class="events hud-section">
  <div class="events-head">
    <div>
      <div class="hud-kicker">Mundo</div>
      <div class="hud-title">Eventos ativos</div>
    </div>
    <div class="events-map">{$worldStore.mapCode}</div>
  </div>

  {#if $activeEventsStore.length}
    <div class="events-list">
      {#each $activeEventsStore as event}
        <div class="event-row">
          <div>
            <div class="event-title">{event.title}</div>
            <div class="hud-meta">X {Math.round(event.x)} | Y {Math.round(event.y)}</div>
          </div>
          <span class="event-stage">{event.stage}</span>
        </div>
      {/each}
    </div>
  {:else}
    <div class="hud-empty">Nenhum evento ativo neste mapa.</div>
  {/if}
</section>

<style>
  .events {
    padding: 12px 14px;
  }

  .events-head,
  .event-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .events-head {
    margin-bottom: 12px;
  }

  .events-map {
    color: var(--hud-text-soft);
    font-size: 0.74rem;
  }

  .events-list {
    display: grid;
    gap: 10px;
  }

  .event-row {
    padding: 12px;
    border-radius: 14px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(7, 9, 12, 0.58);
  }

  .event-title {
    font-family: var(--hud-font-display);
    color: var(--hud-gold);
    font-size: 0.78rem;
    text-transform: uppercase;
  }

  .event-stage {
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid rgba(240, 207, 143, 0.2);
    color: var(--hud-warning);
    font-size: 0.66rem;
    text-transform: uppercase;
  }
</style>
