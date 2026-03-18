<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import { questStore } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();

  function rewardText(rewards: any) {
    const xp = Number(rewards?.xp || 0);
    const currency = rewards?.currency && typeof rewards.currency === 'object'
      ? rewards.currency
      : {};
    const wallet = [
      `${Number(currency.diamond || 0)}d`,
      `${Number(currency.gold || 0)}g`,
      `${Number(currency.silver || 0)}s`,
      `${Number(currency.copper || 0)}c`
    ].filter((entry) => !entry.startsWith('0'));
    const items = Array.isArray(rewards?.items)
      ? rewards.items.map((entry: any) => `${Number(entry.quantity || 1)}x ${entry.templateId || 'item'}`)
      : [];
    return [`XP ${xp}`, ...wallet, ...items].filter(Boolean).join(' | ');
  }
</script>

<Window title="Quests" subtitle="Jornada ativa" width="360px" on:close={() => dispatch('close')}>
  <div class="quest-list">
    {#if $questStore.quests.length}
      {#each $questStore.quests as quest}
        <article class="quest-card">
          <div class="quest-title">{quest.title || quest.id || 'Quest'}</div>
          <div class="quest-status">{quest.status || 'ativa'}</div>
          {#if quest.description}
            <div class="quest-description">{quest.description}</div>
          {/if}
          {#if Array.isArray(quest.objectives) && quest.objectives.length}
            <div class="objective-list">
              {#each quest.objectives as objective}
                <div class="objective-row">
                  <span>{objective.text || objective.id || 'Objetivo'}</span>
                  <span>{Number(objective.current || 0)} / {Number(objective.required || 1)}</span>
                </div>
              {/each}
            </div>
          {/if}
          <div class="quest-reward">{rewardText(quest.rewards)}</div>
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

  .quest-description,
  .objective-row,
  .quest-reward,
  .quest-status,
  .empty-state {
    color: rgba(233, 223, 200, 0.72);
    font-size: 0.78rem;
  }

  .quest-description,
  .quest-reward {
    margin-top: 6px;
  }

  .objective-list {
    display: grid;
    gap: 6px;
    margin-top: 10px;
  }

  .objective-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }

  .quest-reward {
    color: #d7c28a;
  }
</style>
