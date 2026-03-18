<script lang="ts">
  import { friendStore, partyStore, respondFriendRequest, respondPartyInvite, respondPartyJoinRequest, sendUiMessage } from './stores/gameUi';

  $: partyRows = [
    ...$partyStore.invites.map((entry: any) => ({ kind: 'invite', entry })),
    ...$partyStore.joinRequests.map((entry: any) => ({ kind: 'join', entry }))
  ];

  function respondDungeon(accept: boolean) {
    const requestId = String($partyStore.dungeonReady?.requestId || '');
    if (!requestId) return;
    sendUiMessage({ type: 'dungeon.ready', requestId, accept });
  }
</script>

{#if partyRows.length}
  <section class="notify-shell party">
    <div class="title">Grupo</div>
    {#each partyRows as row}
      <div class="row">
        <span>{row.kind === 'invite' ? `Convite: ${row.entry.fromName}` : `Solicitacao: ${row.entry.fromName}`}</span>
        <div class="actions">
          {#if row.kind === 'invite'}
            <button type="button" on:click={() => respondPartyInvite(String(row.entry.inviteId || ''), String(row.entry.partyId || ''), true)}>Aceitar</button>
            <button type="button" class="ghost" on:click={() => respondPartyInvite(String(row.entry.inviteId || ''), String(row.entry.partyId || ''), false)}>Recusar</button>
          {:else}
            <button type="button" on:click={() => respondPartyJoinRequest(String(row.entry.requestId || ''), true)}>Aprovar</button>
            <button type="button" class="ghost" on:click={() => respondPartyJoinRequest(String(row.entry.requestId || ''), false)}>Recusar</button>
          {/if}
        </div>
      </div>
    {/each}
  </section>
{/if}

{#if Array.isArray($friendStore.state?.incoming) && $friendStore.state.incoming.length}
  <section class="notify-shell friend">
    <div class="title">Amizades</div>
    {#each $friendStore.state.incoming as entry}
      <div class="row">
        <span>Pedido: {entry.fromName}</span>
        <div class="actions">
          <button type="button" on:click={() => respondFriendRequest(String(entry.requestId || ''), true)}>Aceitar</button>
          <button type="button" class="ghost" on:click={() => respondFriendRequest(String(entry.requestId || ''), false)}>Recusar</button>
        </div>
      </div>
    {/each}
  </section>
{/if}

{#if $partyStore.dungeonReady}
  <section class="notify-shell dungeon">
    <div class="title">Dungeon</div>
    <div class="row static">
      <span>{$partyStore.dungeonReady.purpose || 'dungeon'}</span>
    </div>
    {#each ($partyStore.dungeonReady.members || []) as member}
      <div class="member">{member.name || member.playerId}: {member.ready ? 'ok' : member.responded ? 'nao' : '...'}</div>
    {/each}
    {#if $partyStore.dungeonReady.requestId}
      <div class="actions">
        <button type="button" on:click={() => respondDungeon(true)}>Aceitar</button>
        <button type="button" class="ghost" on:click={() => respondDungeon(false)}>Recusar</button>
      </div>
    {/if}
  </section>
{/if}

<style>
  .notify-shell {
    pointer-events: auto;
    width: 300px;
    padding: 12px;
    position: relative;
    overflow: hidden;
    clip-path: polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px);
    border: 1px solid rgba(201, 168, 106, 0.28);
    background: linear-gradient(180deg, rgba(17, 15, 12, 0.97), rgba(8, 8, 8, 0.98));
  }

  .notify-shell + .notify-shell {
    margin-top: 10px;
  }

  .title {
    font-family: 'Cinzel', serif;
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #c9a86a;
    margin-bottom: 10px;
  }

  .row,
  .member {
    color: rgba(233, 223, 200, 0.78);
    font-size: 0.78rem;
    margin-bottom: 8px;
  }

  .row {
    display: grid;
    gap: 8px;
  }

  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  button {
    min-height: 34px;
    border: 1px solid rgba(201, 168, 106, 0.28);
    background: linear-gradient(180deg, rgba(33, 24, 14, 0.96), rgba(12, 10, 8, 0.98));
    color: #ecdcb8;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0 12px;
    clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px);
  }

  .ghost {
    background: rgba(16, 20, 24, 0.95) !important;
  }
</style>
