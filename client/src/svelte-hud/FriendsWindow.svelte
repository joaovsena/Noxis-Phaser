<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import { friendStore, removeFriend, respondFriendRequest, sendUiMessage } from './stores/gameUi';

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

<Window title="Amigos" subtitle="Rede social" width="clamp(440px, 44vw, 520px)" maxWidth="520px" maxBodyHeight="min(80vh, 840px)" on:close={() => dispatch('close')}>
  <div class="friends-shell">
    <div class="toolbar">
      <input bind:value={targetName} class="hud-input" type="text" maxlength="20" placeholder="Nome do jogador" />
      <button class="hud-btn" type="button" on:click={requestFriend}>Adicionar</button>
      <button class="hud-btn ghost" type="button" on:click={refreshFriends}>Atualizar</button>
    </div>

    <section class="hud-section compact">
      <div class="section-title">Lista</div>
      {#if friends.length}
        <div class="hud-list">
          {#each friends as entry}
            <div class="row-card">
              <div>
                <div class="row-title">{entry.name || entry.playerName || 'Amigo'}</div>
                <div class={`hud-meta ${entry.online ? 'online' : ''}`}>{entry.online ? 'online' : 'offline'}</div>
              </div>
              <button class="hud-btn mini ghost" type="button" on:click={() => removeFriend(entry.friendPlayerId || entry.playerId || entry.id)}>Remover</button>
            </div>
          {/each}
        </div>
      {:else}
        <div class="hud-empty">Nenhum amigo cadastrado.</div>
      {/if}
    </section>

    <section class="hud-section compact">
      <div class="section-title">Pedidos recebidos</div>
      {#if incoming.length}
        <div class="hud-list">
          {#each incoming as entry}
            <div class="row-card">
              <div class="row-title">{entry.fromName || entry.from || 'Pedido'}</div>
              <div class="actions">
                <button class="hud-btn mini" type="button" on:click={() => respondFriendRequest(String(entry.requestId || entry.id || ''), true)}>Aceitar</button>
                <button class="hud-btn mini ghost" type="button" on:click={() => respondFriendRequest(String(entry.requestId || entry.id || ''), false)}>Recusar</button>
              </div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="hud-empty">Sem pedidos pendentes.</div>
      {/if}
    </section>

    <section class="hud-section compact">
      <div class="section-title">Pedidos enviados</div>
      {#if outgoing.length}
        <div class="hud-list">
          {#each outgoing as entry}
            <div class="row-card">
              <div class="row-title">{entry.toName || entry.to || 'Pedido enviado'}</div>
            </div>
          {/each}
        </div>
      {:else}
        <div class="hud-empty">Nenhum convite enviado.</div>
      {/if}
    </section>
  </div>
</Window>

<style>
  .friends-shell {
    display: grid;
    gap: 12px;
  }

  .toolbar,
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .toolbar :global(.hud-input) {
    flex: 1;
  }

  .compact {
    padding: 12px 14px;
  }

  .section-title,
  .row-title {
    color: var(--hud-gold);
    font-family: var(--hud-font-display);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .section-title {
    margin-bottom: 12px;
    font-size: 0.74rem;
  }

  .row-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 12px;
    border-radius: 14px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(7, 9, 12, 0.58);
  }

  .online {
    color: var(--hud-positive);
  }

  @media (max-width: 640px) {
    .row-card {
      grid-template-columns: 1fr;
      align-items: start;
    }
  }
</style>
