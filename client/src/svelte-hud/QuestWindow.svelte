<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import { displayItemName } from './lib/itemTooltip';
  import { questStore } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();

  let selectedTab: 'active' | 'available' = 'active';
  let selectedQuestId = '';
  let trackSelected = true;

  $: activeQuests = Array.isArray($questStore.quests) ? $questStore.quests : [];
  $: if (!activeQuests.some((quest: any) => String(quest?.id || '') === selectedQuestId)) {
    selectedQuestId = activeQuests[0] ? String(activeQuests[0]?.id || '') : '';
  }
  $: selectedQuest = activeQuests.find((quest: any) => String(quest?.id || '') === selectedQuestId) || activeQuests[0] || null;

  function currencyEntries(rewards: any) {
    const currency = rewards?.currency && typeof rewards.currency === 'object' ? rewards.currency : {};
    return [
      { label: 'Diamante', value: Number(currency.diamond || 0) },
      { label: 'Gold', value: Number(currency.gold || 0) },
      { label: 'Prata', value: Number(currency.silver || 0) },
      { label: 'Cobre', value: Number(currency.copper || 0) }
    ].filter((entry) => entry.value > 0);
  }
</script>

<Window title="Missoes" subtitle="Missoes" theme="classic" minimizable={false} width="clamp(620px, 58vw, 760px)" maxWidth="760px" maxBodyHeight="min(80vh, 840px)" on:close={() => dispatch('close')}>
  <div class="quest-window">
    <div class="quest-grid">
      <section class="quest-list-panel">
        <div class="quest-tabs">
          <button class:active={selectedTab === 'active'} type="button" on:click={() => selectedTab = 'active'}>Missoes atuais</button>
          <button class:active={selectedTab === 'available'} type="button" on:click={() => selectedTab = 'available'}>Missoes disponiveis</button>
        </div>

        {#if selectedTab === 'active'}
          <div class="quest-list">
            {#if activeQuests.length}
              {#each activeQuests as quest}
                <button
                  class={`quest-entry ${selectedQuestId === String(quest?.id || '') ? 'active' : ''}`}
                  type="button"
                  on:click={() => selectedQuestId = String(quest?.id || '')}
                >
                  {quest.title || quest.id || 'Quest'}
                  {#if quest.category === 'main'}<span>(Principal)</span>{/if}
                </button>
              {/each}
            {:else}
              <div class="empty-note">Nenhuma missao ativa.</div>
            {/if}
          </div>
        {:else}
          <div class="empty-note">As missoes disponiveis aparecem nas janelas de NPC.</div>
        {/if}
      </section>

      <section class="quest-detail-panel">
        <div class="detail-header">
          <div class="panel-title">Descricao da missao</div>
          <label class="track-toggle">
            <span>Rastreio da missao</span>
            <input bind:checked={trackSelected} type="checkbox" />
          </label>
        </div>

        {#if selectedQuest}
          <div class="detail-stack">
            <div class="quest-description">
              {selectedQuest.description || 'Sem descricao adicional.'}
            </div>

            <section class="detail-block">
              <div class="block-title">Condicoes da missao</div>
              {#if Array.isArray(selectedQuest.objectives) && selectedQuest.objectives.length}
                {#each selectedQuest.objectives as objective}
                  <div class="objective-row">
                    <span>{objective.text || objective.id || 'Objetivo'}</span>
                    <strong>{Number(objective.current || 0)} / {Number(objective.required || 1)}</strong>
                  </div>
                {/each}
              {:else}
                <div class="empty-note compact">Nenhum objetivo registrado.</div>
              {/if}
            </section>

            <section class="detail-block">
              <div class="block-title">Recompensa da missao</div>
              <div class="reward-list">
                {#if Number(selectedQuest.rewards?.xp || 0) > 0}
                  <div class="reward-row"><span>Experiencia</span><strong>{Number(selectedQuest.rewards?.xp || 0)}</strong></div>
                {/if}

                {#each currencyEntries(selectedQuest.rewards) as entry}
                  <div class="reward-row"><span>{entry.label}</span><strong>{entry.value}</strong></div>
                {/each}

                {#if Array.isArray(selectedQuest.rewards?.items)}
                  {#each selectedQuest.rewards.items as item}
                    <div class="reward-row"><span>{displayItemName(item)}</span><strong>{Number(item.quantity || 1)}x</strong></div>
                  {/each}
                {/if}
              </div>
            </section>
          </div>
        {:else}
          <div class="empty-note">Selecione uma missao para ver os detalhes.</div>
        {/if}
      </section>
    </div>
  </div>

  <svelte:fragment slot="footer">
    <div class="quest-footer">
      <button type="button" disabled>Abandonar missao</button>
    </div>
  </svelte:fragment>
</Window>

<style>
  .quest-window,
  .quest-grid,
  .quest-list,
  .detail-stack,
  .reward-list {
    display: grid;
    gap: 10px;
  }

  .quest-tabs,
  .detail-header,
  .quest-footer {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .quest-grid {
    grid-template-columns: 250px minmax(0, 1fr);
    align-items: start;
  }

  .quest-list-panel,
  .quest-detail-panel,
  .detail-block {
    padding: 10px;
    border-radius: 12px;
    border: 1px solid rgba(226, 201, 138, 0.18);
    background: rgba(77, 71, 46, 0.78);
  }

  .quest-tabs button,
  .quest-footer button {
    min-height: 28px;
    padding: 0 12px;
    border-radius: 7px;
    border: 1px solid rgba(226, 201, 138, 0.22);
    background: linear-gradient(180deg, rgba(104, 85, 43, 0.92), rgba(60, 50, 26, 0.96));
    color: #fff1cf;
    font-family: var(--hud-font-display);
  }

  .quest-tabs button.active {
    box-shadow: 0 0 0 1px rgba(226, 201, 138, 0.12), 0 0 12px rgba(226, 201, 138, 0.12);
  }

  .quest-list {
    min-height: 328px;
    align-content: start;
  }

  .quest-entry {
    min-height: 34px;
    padding: 8px 10px;
    border-radius: 8px;
    border: 1px solid rgba(226, 201, 138, 0.14);
    background: rgba(54, 49, 31, 0.74);
    color: rgba(255, 245, 219, 0.88);
    text-align: left;
    font-size: 0.82rem;
  }

  .quest-entry.active {
    background: linear-gradient(90deg, rgba(255, 219, 101, 0.12), rgba(74, 62, 33, 0.76));
    color: #fff0a6;
  }

  .quest-entry span {
    color: #ffe058;
  }

  .panel-title,
  .block-title {
    color: #fff1cf;
    font-family: var(--hud-font-display);
    font-size: 0.76rem;
  }

  .track-toggle {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 6px;
    color: rgba(248, 241, 224, 0.84);
    font-size: 0.72rem;
  }

  .track-toggle input {
    accent-color: #d7ce8b;
  }

  .quest-description,
  .objective-row,
  .reward-row,
  .empty-note {
    color: rgba(248, 241, 224, 0.88);
    font-size: 0.82rem;
    line-height: 1.5;
  }

  .detail-block {
    gap: 8px;
  }

  .objective-row,
  .reward-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    background: rgba(42, 37, 25, 0.68);
  }

  .empty-note {
    padding: 10px 12px;
    border-radius: 10px;
    background: rgba(42, 37, 25, 0.68);
  }

  .empty-note.compact {
    padding: 8px 10px;
  }

  @media (max-width: 780px) {
    .quest-grid {
      grid-template-columns: 1fr;
    }

    .quest-list {
      min-height: 0;
    }
  }
</style>
