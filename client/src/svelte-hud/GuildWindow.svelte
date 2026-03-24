<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import { attributesStore, friendStore, partyStore } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();
  let tab: 'overview' | 'members' | 'ranks' | 'activity' | 'chat' = 'overview';

  $: player = $attributesStore.player || null;
  $: partyMembers = Array.isArray($partyStore.party?.members) ? $partyStore.party.members : [];
  $: friends = Array.isArray($friendStore.state?.friends) ? $friendStore.state.friends : [];
  $: guildName = player ? `Ordem de ${player.name || 'Noxis'}` : 'Ordem de Noxis';
  $: leaderName = player?.name || 'Sem mestre';
  $: memberSeed = [
    { name: leaderName, rank: 'Mestre', online: true, role: String(player?.class || 'knight') },
    ...partyMembers.slice(0, 4).map((entry: any, index: number) => ({
      name: entry.name || `Membro ${index + 1}`,
      rank: index === 0 ? 'Oficial' : 'Membro',
      online: entry.online !== false,
      role: String(entry.class || 'adventure')
    })),
    ...friends.slice(0, 4).map((entry: any) => ({
      name: entry.name || entry.playerName || 'Aliado',
      rank: 'Recruta',
      online: Boolean(entry.online),
      role: 'social'
    }))
  ].slice(0, 8);
</script>

<Window title="Guilda" subtitle="Estrutura preparada para integracao" width="clamp(560px, 58vw, 720px)" maxWidth="720px" maxBodyHeight="min(80vh, 840px)" on:close={() => dispatch('close')}>
  <div class="guild-shell">
    <section class="hero-card">
      <div class="crest">N</div>
      <div class="hero-meta">
        <div class="hud-kicker">Painel principal</div>
        <div class="guild-name">{guildName}</div>
        <div class="guild-copy">A estrutura visual de guilda esta pronta para receber backend real de membros, ranks, convites, chat e logs.</div>
      </div>
    </section>

    <div class="tabs">
      {#each [
        ['overview', 'Visao geral'],
        ['members', 'Membros'],
        ['ranks', 'Ranks'],
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
          <div class="hud-kicker">Mestre</div>
          <div class="summary-value">{leaderName}</div>
        </div>
        <div class="summary-card">
          <div class="hud-kicker">Membros</div>
          <div class="summary-value">{memberSeed.length}</div>
        </div>
        <div class="summary-card">
          <div class="hud-kicker">Foco</div>
          <div class="summary-value">PvE / Social</div>
        </div>
      </section>
    {:else if tab === 'members'}
      <section class="hud-section compact">
        <div class="section-title">Lista de membros</div>
        <div class="hud-list">
          {#each memberSeed as member}
            <div class="row-card">
              <div>
                <div class="row-title">{member.name}</div>
                <div class="hud-meta">{member.rank} | {member.role}</div>
              </div>
              <span class={`status ${member.online ? 'online' : 'offline'}`}>{member.online ? 'online' : 'offline'}</span>
            </div>
          {/each}
        </div>
      </section>
    {:else if tab === 'ranks'}
      <section class="hud-section compact">
        <div class="section-title">Estrutura de ranks</div>
        <div class="hud-list">
          {#each [
            ['Mestre', 'Gerencia convites, ranks e configuracoes.'],
            ['Oficial', 'Ajuda na organizacao e recrutamento.'],
            ['Membro', 'Participa das atividades da guilda.'],
            ['Recruta', 'Periodo inicial e avaliacao.']
          ] as [name, desc]}
            <div class="row-card">
              <div>
                <div class="row-title">{name}</div>
                <div class="hud-meta">{desc}</div>
              </div>
            </div>
          {/each}
        </div>
      </section>
    {:else if tab === 'activity'}
      <section class="hud-section compact">
        <div class="section-title">Feed de atividade</div>
        <div class="hud-list">
          {#each [
            'Espaco pronto para logs de entrada, saida, convites e promocoes.',
            'Pode consumir eventos futuros do backend sem refazer a HUD.',
            'Tambem comporta historico de participacao em dungeons/eventos.'
          ] as line}
            <div class="row-card">
              <div class="hud-meta">{line}</div>
            </div>
          {/each}
        </div>
      </section>
    {:else}
      <section class="hud-section compact">
        <div class="section-title">Chat da guilda</div>
        <div class="hud-empty">Janela preparada para integrar canal de guilda quando o backend estiver disponivel.</div>
      </section>
    {/if}
  </div>
</Window>

<style>
  .guild-shell {
    display: grid;
    gap: 12px;
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

  .hero-meta {
    display: grid;
    gap: 6px;
  }

  .guild-name,
  .summary-value,
  .row-title,
  .section-title {
    font-family: var(--hud-font-display);
    color: var(--hud-gold);
    text-transform: uppercase;
  }

  .guild-copy {
    color: var(--hud-text-soft);
    font-size: 0.82rem;
    line-height: 1.45;
  }

  .tabs,
  .summary-grid {
    display: grid;
    gap: 10px;
  }

  .tabs {
    grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  }

  .hud-tab.active {
    border-color: rgba(201, 168, 106, 0.42);
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.12), 0 0 12px rgba(201, 168, 106, 0.1);
  }

  .summary-grid {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }

  .summary-card,
  .row-card,
  .compact {
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

  .section-title {
    margin-bottom: 12px;
    font-size: 0.74rem;
    letter-spacing: 0.06em;
  }

  .row-card {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
  }

  .status {
    padding: 4px 8px;
    border-radius: 999px;
    border: 1px solid rgba(201, 168, 106, 0.16);
    font-size: 0.68rem;
    text-transform: uppercase;
  }

  .status.online {
    color: var(--hud-positive);
  }

  .status.offline {
    color: var(--hud-text-soft);
  }

  @media (max-width: 760px) {
    .hero-card,
    .summary-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
