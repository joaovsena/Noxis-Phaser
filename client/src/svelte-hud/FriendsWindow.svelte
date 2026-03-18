<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import { friendStore, sendUiMessage } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();
  let targetName = '';

  $: friends = Array.isArray($friendStore.state?.friends) ? $friendStore.state.friends : [];
  $: incoming = Array.isArray($friendStore.state?.incoming) ? $friendStore.state.incoming : [];
  $: outgoing = Array.isArray($friendStore.state?.outgoing) ? $friendStore.state.outgoing : [];

  function refreshFriends() {
    sendUiMessage({ type: 'friend.list' });
  }

  function requestFriend() {
    const name = targetName.trim();
    if (!name) return;
    sendUiMessage({ type: 'friend.request', targetName: name });
    targetName = '';
  }
</script>

<Window title="Amigos" subtitle="Rede social" width="420px" on:close={() => dispatch('close')}>
  <div class="actions">
    <input bind:value={targetName} type="text" maxlength="20" placeholder="Nome do jogador" />
    <button type="button" on:click={requestFriend}>Adicionar</button>
    <button type="button" class="ghost" on:click={refreshFriends}>Atualizar</button>
  </div>

  <section class="stack">
    <div class="section-title">Lista</div>
    {#if friends.length}
      {#each friends as entry}
        <div class="row">
          <span>{entry.name || entry.playerName || 'Amigo'}</span>
          <span class="meta">{entry.online ? 'online' : 'offline'}</span>
        </div>
      {/each}
    {:else}
      <div class="empty-state">Nenhum amigo cadastrado.</div>
    {/if}
  </section>

  <section class="stack">
    <div class="section-title">Pedidos recebidos</div>
    {#if incoming.length}
      {#each incoming as entry}
        <div class="row">
          <span>{entry.fromName || entry.from || 'Pedido'}</span>
        </div>
      {/each}
    {:else}
      <div class="empty-state">Sem pedidos pendentes.</div>
    {/if}
  </section>

  <section class="stack">
    <div class="section-title">Pedidos enviados</div>
    {#if outgoing.length}
      {#each outgoing as entry}
        <div class="row">
          <span>{entry.toName || entry.to || 'Pedido enviado'}</span>
        </div>
      {/each}
    {:else}
      <div class="empty-state">Nenhum convite enviado.</div>
    {/if}
  </section>
</Window>

<style>
  .actions,
  .stack {
    display: grid;
    gap: 10px;
  }

  .stack + .stack {
    margin-top: 14px;
  }

  .section-title {
    font-family: 'Cinzel', serif;
    color: #f0dfbc;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.76rem;
  }

  .row,
  .actions input,
  .actions button {
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
  }

  .row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
    padding: 12px;
    border: 1px solid rgba(201, 168, 106, 0.2);
    background: rgba(10, 10, 10, 0.72);
    color: rgba(233, 223, 200, 0.82);
    font-size: 0.8rem;
  }

  .meta,
  .empty-state {
    color: rgba(233, 223, 200, 0.72);
    font-size: 0.78rem;
  }

  .actions {
    grid-template-columns: minmax(0, 1fr) 116px 116px;
  }

  .actions input {
    min-height: 40px;
    border: 1px solid rgba(201, 168, 106, 0.26);
    background: linear-gradient(180deg, rgba(8, 9, 10, 0.96), rgba(4, 6, 7, 0.98));
    color: #f2e7c6;
    padding: 0 12px;
  }

  .actions button {
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
</style>
