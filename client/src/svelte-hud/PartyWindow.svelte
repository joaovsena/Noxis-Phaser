<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import { partyStore, sendUiMessage } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();
  let inviteName = '';

  $: party = $partyStore.party;
  $: areaList = Array.isArray($partyStore.areaList) ? $partyStore.areaList : [];

  function refreshAreaParties() {
    sendUiMessage({ type: 'party.requestAreaParties' });
  }

  function createParty() {
    sendUiMessage({ type: 'party.create' });
  }

  function leaveParty() {
    sendUiMessage({ type: 'party.leave' });
  }

  function inviteByName() {
    const targetName = inviteName.trim();
    if (!targetName) return;
    sendUiMessage({ type: 'party.invite', targetName });
    inviteName = '';
  }

  function requestJoin(partyId: string) {
    if (!partyId) return;
    sendUiMessage({ type: 'party.requestJoin', partyId });
  }
</script>

<Window title="Grupo" subtitle="Companheiros de jornada" width="420px" on:close={() => dispatch('close')}>
  <section class="stack">
    <div class="section-title">Grupos na area</div>
    <div class="actions">
      <button type="button" on:click={refreshAreaParties}>Atualizar</button>
      <button type="button" class="ghost" on:click={createParty}>Criar grupo</button>
    </div>
    {#if areaList.length}
      {#each areaList as entry}
        <article class="card-row">
          <div>
            <div class="name">{entry.name || entry.partyId || 'Grupo'}</div>
            <div class="meta">Membros: {Array.isArray(entry.members) ? entry.members.length : Number(entry.memberCount || 0)}</div>
          </div>
          <button type="button" on:click={() => requestJoin(String(entry.partyId || ''))}>Entrar</button>
        </article>
      {/each}
    {:else}
      <div class="empty-state">Nenhum grupo visivel na area.</div>
    {/if}
  </section>

  <section class="stack">
    <div class="section-title">Meu grupo</div>
    {#if party}
      <div class="actions">
        <input bind:value={inviteName} type="text" maxlength="20" placeholder="Nome do jogador" />
        <button type="button" on:click={inviteByName}>Convidar</button>
      </div>
      <div class="member-list">
        {#each (party.members || []) as member}
          <div class="member-row">
            <span>{member.name || member.playerId || 'Membro'}</span>
            <span class="meta">{member.online === false ? 'offline' : 'online'}</span>
          </div>
        {/each}
      </div>
      <button type="button" class="ghost danger" on:click={leaveParty}>Sair do grupo</button>
    {:else}
      <div class="empty-state">Voce ainda nao esta em um grupo.</div>
    {/if}
  </section>
</Window>

<style>
  .stack,
  .member-list {
    display: grid;
    gap: 10px;
  }

  .stack + .stack {
    margin-top: 14px;
  }

  .section-title,
  .name {
    font-family: 'Cinzel', serif;
    color: #f0dfbc;
    text-transform: uppercase;
  }

  .section-title {
    font-size: 0.76rem;
    letter-spacing: 0.08em;
  }

  .card-row,
  .member-row,
  .actions input,
  .actions button {
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
  }

  .card-row,
  .member-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
    padding: 12px;
    border: 1px solid rgba(201, 168, 106, 0.2);
    background: rgba(10, 10, 10, 0.72);
  }

  .meta,
  .empty-state {
    color: rgba(233, 223, 200, 0.72);
    font-size: 0.78rem;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .actions input {
    flex: 1;
    min-height: 40px;
    border: 1px solid rgba(201, 168, 106, 0.26);
    background: linear-gradient(180deg, rgba(8, 9, 10, 0.96), rgba(4, 6, 7, 0.98));
    color: #f2e7c6;
    padding: 0 12px;
  }

  .actions button,
  .danger {
    min-height: 40px;
    border: 1px solid rgba(201, 168, 106, 0.3);
    background: linear-gradient(180deg, rgba(57, 41, 20, 0.96), rgba(27, 20, 11, 0.98));
    color: #f3e2bc;
    padding: 0 14px;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .ghost {
    background: rgba(16, 20, 24, 0.95) !important;
  }

  .danger {
    border-color: rgba(205, 116, 100, 0.26);
    color: #efc1b5;
  }
</style>
