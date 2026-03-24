<script lang="ts">
  import { partyFramesStore } from './stores/gameUi';
</script>

{#if $partyFramesStore.length}
  <section class="party-frames">
    {#each $partyFramesStore as member}
      <article class={`frame ${member.online === false ? 'offline' : ''} ${Number(member.hp || 0) <= 0 ? 'dead' : ''}`}>
        <div class={`avatar class-${String(member.class || 'knight')}`}>{String(member.class || 'knight').slice(0, 1).toUpperCase()}</div>
        <div class="meta">
          <div class="topline">
            <div class="name">{member.role === 'leader' ? '[L] ' : ''}{member.name || 'Membro'}</div>
            <span class="status">{member.online === false ? 'offline' : Number(member.hp || 0) <= 0 ? 'morto' : 'ativo'}</span>
          </div>
          <div class="subline">Lv.{Number(member.level || 1)}</div>
          <div class="hp-track">
            <div class="hp-fill" style={`width:${Math.max(0, Math.min(100, (Number(member.hp || 0) / Math.max(1, Number(member.maxHp || 1))) * 100))}%`}></div>
          </div>
        </div>
      </article>
    {/each}
  </section>
{/if}

<style>
  .party-frames {
    display: grid;
    gap: 8px;
  }

  .frame {
    width: 100%;
    display: grid;
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(201, 168, 106, 0.22);
    background: linear-gradient(180deg, rgba(17, 15, 12, 0.97), rgba(8, 8, 8, 0.98));
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.2);
  }

  .frame.offline {
    opacity: 0.56;
  }

  .frame.dead {
    border-color: rgba(205, 116, 100, 0.22);
  }

  .avatar {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    border: 1px solid rgba(201, 168, 106, 0.26);
    background: rgba(29, 29, 29, 0.9);
    color: #f0dfbc;
    font-family: var(--hud-font-display);
    font-size: 0.78rem;
  }

  .topline {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .name {
    min-width: 0;
    color: #f0dfbc;
    font-family: var(--hud-font-display);
    font-size: 0.72rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .status,
  .subline {
    color: rgba(233, 223, 200, 0.72);
    font-size: 0.66rem;
    text-transform: uppercase;
  }

  .subline {
    margin-top: 4px;
  }

  .hp-track {
    height: 8px;
    margin-top: 6px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(201, 168, 106, 0.18);
    border-radius: 999px;
    overflow: hidden;
  }

  .hp-fill {
    height: 100%;
    background: linear-gradient(90deg, #7a1d18, #d25a47 55%, #f0ad73);
  }
</style>
