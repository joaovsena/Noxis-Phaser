<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import { appStore, kickPartyMember, partyStore, promotePartyMember, sendUiMessage } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();
  let inviteName = '';

  $: party = $partyStore.party;
  $: areaList = Array.isArray($partyStore.areaList) ? $partyStore.areaList : [];
  $: selfPlayerId = Number($appStore.playerId || 0);
  $: isLeader = party ? Number(party.leaderId || 0) === selfPlayerId : false;

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

<Window title="Grupo" subtitle="Social e coordenacao" width="clamp(460px, 46vw, 560px)" maxWidth="560px" maxBodyHeight="min(80vh, 840px)" on:close={() => dispatch('close')}>
  <div class="party-shell">
    <section class="hud-section compact">
      <div class="section-head">
        <div>
          <div class="hud-kicker">Area atual</div>
          <div class="hud-title">Grupos visiveis</div>
        </div>
        <div class="section-actions">
          <button class="hud-btn mini ghost" type="button" on:click={refreshAreaParties}>Atualizar</button>
          <button class="hud-btn mini" type="button" on:click={createParty}>Criar</button>
        </div>
      </div>

      {#if areaList.length}
        <div class="hud-list">
          {#each areaList as entry}
            <article class="row-card">
              <div>
                <div class="row-title">{entry.name || entry.partyId || 'Grupo'}</div>
                <div class="hud-meta">Membros: {Array.isArray(entry.members) ? entry.members.length : Number(entry.memberCount || 0)}</div>
              </div>
              <button class="hud-btn mini" type="button" on:click={() => requestJoin(String(entry.partyId || ''))}>Entrar</button>
            </article>
          {/each}
        </div>
      {:else}
        <div class="hud-empty">Nenhum grupo visivel na area.</div>
      {/if}
    </section>

    <section class="hud-section compact">
      <div class="section-head">
        <div>
          <div class="hud-kicker">Seu grupo</div>
          <div class="hud-title">{party ? 'Membros atuais' : 'Sem grupo'}</div>
        </div>
      </div>

      {#if party}
        <div class="invite-row">
          <input bind:value={inviteName} class="hud-input" type="text" maxlength="20" placeholder="Nome do jogador" />
          <button class="hud-btn" type="button" on:click={inviteByName}>Convidar</button>
        </div>

        <div class="hud-list">
          {#each (party.members || []) as member}
            <div class="row-card member-row">
              <div>
                <div class="row-title">{member.name || member.playerId || 'Membro'}</div>
                <div class="hud-meta">{member.online === false ? 'offline' : 'online'}{Number(member.playerId || 0) === Number(party.leaderId || 0) ? ' | lider' : ''}</div>
              </div>
              {#if isLeader && Number(member.playerId || 0) !== selfPlayerId}
                <div class="section-actions">
                  <button class="hud-btn mini ghost" type="button" on:click={() => promotePartyMember(member.playerId)}>Promover</button>
                  <button class="hud-btn mini danger" type="button" on:click={() => kickPartyMember(member.playerId)}>Expulsar</button>
                </div>
              {/if}
            </div>
          {/each}
        </div>

        <button class="hud-btn danger" type="button" on:click={leaveParty}>Sair do grupo</button>
      {:else}
        <div class="hud-empty">Voce ainda nao esta em um grupo.</div>
      {/if}
    </section>
  </div>
</Window>

<style>
  .party-shell {
    display: grid;
    gap: 12px;
  }

  .compact {
    padding: 12px 14px;
  }

  .section-head,
  .section-actions,
  .invite-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .invite-row {
    margin: 12px 0;
  }

  .invite-row :global(.hud-input) {
    flex: 1;
  }

  .row-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border-radius: 14px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(7, 9, 12, 0.58);
  }

  .row-title {
    color: var(--hud-gold);
    font-family: var(--hud-font-display);
    text-transform: uppercase;
    font-size: 0.78rem;
  }

  .member-row {
    align-items: start;
  }

  @media (max-width: 680px) {
    .section-head,
    .section-actions,
    .invite-row,
    .row-card {
      display: grid;
      grid-template-columns: 1fr;
      align-items: stretch;
    }
  }
</style>
