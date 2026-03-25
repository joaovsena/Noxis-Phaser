<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import { appStore, createGuild, guildStore, inviteToGuild, kickGuildMember, leaveGuild, refreshGuildState, respondGuildInvite, setGuildMemberRank } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();

  let tab: 'overview' | 'members' | 'activity' | 'chat' = 'overview';
  let createName = '';
  let inviteName = '';

  $: guildState = $guildStore.state || null;
  $: guild = guildState?.guild || null;
  $: invites = Array.isArray(guildState?.invites) ? guildState.invites : [];
  $: selfId = Number($appStore.playerId || 0);
  $: selfMember = Array.isArray(guild?.members)
    ? guild.members.find((entry: any) => Number(entry?.playerId || 0) === selfId) || null
    : null;
  $: selfRank = String(selfMember?.rank || 'member');
  $: canInvite = selfRank === 'leader' || selfRank === 'officer';
  $: canManage = selfRank === 'leader';

  function submitCreate() {
    const name = createName.trim();
    if (!name) return;
    createGuild(name);
    createName = '';
  }

  function submitInvite() {
    const name = inviteName.trim();
    if (!name) return;
    inviteToGuild(name);
    inviteName = '';
  }
</script>

<Window title="Guilda" subtitle="Comunidade e progresso social" width="clamp(600px, 62vw, 760px)" maxWidth="760px" maxBodyHeight="min(82vh, 860px)" on:close={() => dispatch('close')}>
  <div class="guild-shell">
    <div class="toolbar">
      <button class="hud-btn ghost" type="button" on:click={refreshGuildState}>Atualizar</button>
      {#if guild}
        <button class="hud-btn danger" type="button" on:click={leaveGuild}>Sair</button>
      {/if}
    </div>

    {#if !guild}
      <section class="hud-section compact">
        <div class="section-title">Fundar guilda</div>
        <div class="toolbar">
          <input bind:value={createName} class="hud-input" type="text" maxlength="20" placeholder="Nome da guilda" />
          <button class="hud-btn" type="button" on:click={submitCreate}>Criar</button>
        </div>
      </section>

      <section class="hud-section compact">
        <div class="section-title">Convites pendentes</div>
        {#if invites.length}
          <div class="hud-list">
            {#each invites as invite}
              <div class="row-card">
                <div>
                  <div class="row-title">{invite.guildName || 'Guilda'}</div>
                  <div class="hud-meta">Convite de {invite.fromName || 'jogador'}</div>
                </div>
                <div class="actions">
                  <button class="hud-btn mini" type="button" on:click={() => respondGuildInvite(String(invite.inviteId || ''), true)}>Aceitar</button>
                  <button class="hud-btn mini ghost" type="button" on:click={() => respondGuildInvite(String(invite.inviteId || ''), false)}>Recusar</button>
                </div>
              </div>
            {/each}
          </div>
        {:else}
          <div class="hud-empty">Nenhum convite de guilda pendente.</div>
        {/if}
      </section>
    {:else}
      <section class="hero-card">
        <div class="crest">{String(guild.name || 'G').slice(0, 1).toUpperCase()}</div>
        <div class="hero-meta">
          <div class="hud-kicker">Painel principal</div>
          <div class="guild-name">{guild.name || 'Guilda'}</div>
          <div class="guild-copy">{Number(guild.memberCount || 0)} membro(s) | seu rank: {selfRank}</div>
        </div>
      </section>

      <div class="tabs">
        {#each [
          ['overview', 'Visao geral'],
          ['members', 'Membros'],
          ['activity', 'Atividade'],
          ['chat', 'Chat']
        ] as [tabId, label]}
          <button class={`hud-tab ${tab === tabId ? 'active' : 'ghost'}`} type="button" on:click={() => tab = tabId as typeof tab}>
            {label}
          </button>
        {/each}
      </div>

      {#if tab === 'overview'}
        <section class="summary-grid">
          <div class="summary-card">
            <div class="hud-kicker">Nome</div>
            <div class="summary-value">{guild.name}</div>
          </div>
          <div class="summary-card">
            <div class="hud-kicker">Membros</div>
            <div class="summary-value">{Number(guild.memberCount || 0)}</div>
          </div>
          <div class="summary-card">
            <div class="hud-kicker">Lider</div>
            <div class="summary-value">{guild.members?.find((entry: any) => entry.rank === 'leader')?.name || '-'}</div>
          </div>
        </section>

        {#if canInvite}
          <section class="hud-section compact">
            <div class="section-title">Convidar jogador</div>
            <div class="toolbar">
              <input bind:value={inviteName} class="hud-input" type="text" maxlength="20" placeholder="Nome do jogador" />
              <button class="hud-btn" type="button" on:click={submitInvite}>Convidar</button>
            </div>
          </section>
        {/if}
      {:else if tab === 'members'}
        <section class="hud-section compact">
          <div class="section-title">Lista de membros</div>
          <div class="hud-list">
            {#each guild.members || [] as member}
              <div class="row-card">
                <div>
                  <div class="row-title">{member.name || 'Membro'}</div>
                  <div class="hud-meta">{member.rank} | {member.class} | Nv. {Number(member.level || 1)} | {member.online ? 'online' : 'offline'}</div>
                </div>
                {#if canManage && Number(member.playerId || 0) !== selfId}
                  <div class="actions">
                    {#if member.rank !== 'leader'}
                      <button class="hud-btn mini ghost" type="button" on:click={() => setGuildMemberRank(member.playerId, 'leader')}>Lider</button>
                    {/if}
                    {#if member.rank !== 'officer'}
                      <button class="hud-btn mini ghost" type="button" on:click={() => setGuildMemberRank(member.playerId, 'officer')}>Oficial</button>
                    {/if}
                    {#if member.rank !== 'member'}
                      <button class="hud-btn mini ghost" type="button" on:click={() => setGuildMemberRank(member.playerId, 'member')}>Membro</button>
                    {/if}
                    <button class="hud-btn mini danger" type="button" on:click={() => kickGuildMember(member.playerId)}>Remover</button>
                  </div>
                {/if}
              </div>
            {/each}
          </div>
        </section>
      {:else if tab === 'activity'}
        <section class="hud-section compact">
          <div class="section-title">Atividade recente</div>
          {#if guild.activity?.length}
            <div class="hud-list">
              {#each guild.activity as entry}
                <div class="row-card">
                  <div class="hud-meta">{new Date(Number(entry.at || Date.now())).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} | {entry.text}</div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="hud-empty">Ainda nao ha eventos registrados para esta guilda.</div>
          {/if}
        </section>
      {:else}
        <section class="hud-section compact">
          <div class="section-title">Chat da guilda</div>
          <div class="hud-empty">Use a aba `Guilda` no chat principal para conversar com os membros online.</div>
        </section>
      {/if}
    {/if}
  </div>
</Window>

<style>
  .guild-shell,
  .tabs,
  .summary-grid {
    display: grid;
    gap: 12px;
  }

  .toolbar,
  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .toolbar {
    justify-content: flex-end;
  }

  .toolbar :global(.hud-input) {
    flex: 1;
  }

  .hero-card {
    display: grid;
    grid-template-columns: 88px minmax(0, 1fr);
    gap: 14px;
    align-items: center;
    padding: 14px;
    border-radius: 16px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(7, 9, 12, 0.62);
  }

  .crest {
    width: 88px;
    height: 88px;
    display: grid;
    place-items: center;
    border-radius: 20px;
    border: 1px solid rgba(201, 168, 106, 0.42);
    color: #f3e7cf;
    font-family: var(--hud-font-display);
    font-size: 1.8rem;
    background: radial-gradient(circle at 35% 30%, rgba(201, 168, 106, 0.34), rgba(46, 33, 18, 0.18) 48%, rgba(11, 13, 15, 0.96) 100%);
  }

  .guild-name,
  .summary-value,
  .row-title,
  .section-title {
    font-family: var(--hud-font-display);
    color: var(--hud-gold);
    text-transform: uppercase;
  }

  .tabs {
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  }

  .summary-grid {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }

  .summary-card,
  .compact,
  .row-card {
    padding: 12px;
    border-radius: 14px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(7, 9, 12, 0.58);
  }

  .summary-value {
    margin-top: 6px;
    font-size: 0.84rem;
  }

  .compact {
    padding: 12px 14px;
  }

  .row-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
  }

  @media (max-width: 760px) {
    .hero-card,
    .summary-grid,
    .row-card {
      grid-template-columns: 1fr;
    }
  }
</style>
