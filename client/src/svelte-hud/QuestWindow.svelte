<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import { questStore } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();
</script>

<Window title="Quests" subtitle="Jornada ativa" width="360px" on:close={() => dispatch('close')}>
  <div class="quest-list">
    {#if $questStore.quests.length}
      {#each $questStore.quests as quest}
        <article class="quest-card">
          <div class="quest-title">{quest.title || quest.id || 'Quest'}</div>
          <div class="quest-status">{quest.status || 'ativa'}</div>
        </article>
      {/each}
    {:else}
      <div class="empty-state">Nenhuma quest ativa.</div>
    {/if}
  </div>
</Window>

<style>
  .quest-list {
    display: grid;
    gap: 10px;
  }

  .quest-card {
    padding: 12px;
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
    border: 1px solid rgba(201, 168, 106, 0.2);
    background: rgba(10, 10, 10, 0.72);
  }

  .quest-title {
    font-family: 'Cinzel', serif;
    color: #f0dfbc;
    margin-bottom: 4px;
  }

  .quest-status,
  .empty-state {
    color: rgba(233, 223, 200, 0.72);
    font-size: 0.78rem;
  }
</style>
