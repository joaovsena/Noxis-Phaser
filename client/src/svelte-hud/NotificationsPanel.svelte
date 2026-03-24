<script lang="ts">
  import { friendStore, partyStore, respondFriendRequest, respondPartyInvite, respondPartyJoinRequest, sendUiMessage } from './stores/gameUi';

  $: notifications = [
    ...$partyStore.invites.map((entry: any) => ({ kind: 'party-invite', title: 'Convite de grupo', subtitle: entry.fromName || 'Aventureiro', entry })),
    ...$partyStore.joinRequests.map((entry: any) => ({ kind: 'party-join', title: 'Pedido para entrar', subtitle: entry.fromName || 'Aventureiro', entry })),
    ...(Array.isArray($friendStore.state?.incoming) ? $friendStore.state.incoming.map((entry: any) => ({ kind: 'friend', title: 'Pedido de amizade', subtitle: entry.fromName || 'Jogador', entry })) : [])
  ];

  function respondDungeon(accept: boolean) {
    const requestId = String($partyStore.dungeonReady?.requestId || '');
    if (!requestId) return;
    sendUiMessage({ type: 'dungeon.ready', requestId, accept });
  }
</script>

{#if notifications.length || $partyStore.dungeonReady}
  <section class="notify-stack">
    {#each notifications as row}
      <article class="notify-card">
        <div class="notify-top">
          <div>
            <div class="title">{row.title}</div>
            <div class="subtitle">{row.subtitle}</div>
          </div>
        </div>
        <div class="actions">
          {#if row.kind === 'party-invite'}
            <button type="button" on:click={() => respondPartyInvite(String(row.entry.inviteId || ''), String(row.entry.partyId || ''), true)}>Aceitar</button>
            <button type="button" class="ghost" on:click={() => respondPartyInvite(String(row.entry.inviteId || ''), String(row.entry.partyId || ''), false)}>Recusar</button>
          {:else if row.kind === 'party-join'}
            <button type="button" on:click={() => respondPartyJoinRequest(String(row.entry.requestId || ''), true)}>Aprovar</button>
            <button type="button" class="ghost" on:click={() => respondPartyJoinRequest(String(row.entry.requestId || ''), false)}>Recusar</button>
          {:else}
            <button type="button" on:click={() => respondFriendRequest(String(row.entry.requestId || ''), true)}>Aceitar</button>
            <button type="button" class="ghost" on:click={() => respondFriendRequest(String(row.entry.requestId || ''), false)}>Recusar</button>
          {/if}
        </div>
      </article>
    {/each}

    {#if $partyStore.dungeonReady}
      <article class="notify-card dungeon">
        <div class="notify-top">
          <div>
            <div class="title">Ready check da dungeon</div>
            <div class="subtitle">{$partyStore.dungeonReady.purpose || 'expedicao'}</div>
          </div>
        </div>
        <div class="member-list">
          {#each ($partyStore.dungeonReady.members || []) as member}
            <div class="member-row">{member.name || member.playerId}: {member.ready ? 'ok' : member.responded ? 'nao' : '...'}</div>
          {/each}
        </div>
        {#if $partyStore.dungeonReady.requestId}
          <div class="actions">
            <button type="button" on:click={() => respondDungeon(true)}>Pronto</button>
            <button type="button" class="ghost" on:click={() => respondDungeon(false)}>Nao</button>
          </div>
        {/if}
      </article>
    {/if}
  </section>
{/if}

<style>
  .notify-stack {
    display: grid;
    gap: 10px;
  }

  .notify-card {
    padding: 12px;
    border-radius: 14px;
    border: 1px solid rgba(201, 168, 106, 0.22);
    background: linear-gradient(180deg, rgba(17, 15, 12, 0.97), rgba(8, 8, 8, 0.98));
  }

  .notify-card.dungeon {
    border-color: rgba(240, 207, 143, 0.22);
  }

  .notify-top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }

  .title {
    color: #f0dfbc;
    font-family: var(--hud-font-display);
    font-size: 0.74rem;
    text-transform: uppercase;
  }

  .subtitle,
  .member-row {
    color: rgba(233, 223, 200, 0.74);
    font-size: 0.76rem;
  }

  .member-list {
    display: grid;
    gap: 6px;
    margin-bottom: 10px;
  }

  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  button {
    min-height: 34px;
    padding: 0 12px;
    border-radius: 10px;
    border: 1px solid rgba(201, 168, 106, 0.24);
    background: linear-gradient(180deg, rgba(33, 24, 14, 0.96), rgba(12, 10, 8, 0.98));
    color: #ecdcb8;
    font-family: var(--hud-font-display);
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .ghost {
    background: rgba(16, 20, 24, 0.95) !important;
  }
</style>
