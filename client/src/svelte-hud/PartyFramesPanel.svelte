<script lang="ts">
  import { partyFramesStore } from './stores/gameUi';
</script>

{#if $partyFramesStore.length}
  <section class="party-frames">
    {#each $partyFramesStore as member}
      <article class="frame">
        <div class={`avatar class-${String(member.class || 'knight')}`}>{String(member.class || 'knight').slice(0, 1).toUpperCase()}</div>
        <div class="meta">
          <div class="name">{member.role === 'leader' ? '[L] ' : ''}{member.name || 'Membro'} Lv.{Number(member.level || 1)}</div>
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
    pointer-events: auto;
    width: 220px;
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    padding: 10px;
    clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px);
    border: 1px solid rgba(201, 168, 106, 0.28);
    background: linear-gradient(180deg, rgba(17, 15, 12, 0.97), rgba(8, 8, 8, 0.98));
    box-shadow: 0 10px 22px rgba(0, 0, 0, 0.2);
  }

  .avatar {
    width: 34px;
    height: 34px;
    display: grid;
    place-items: center;
    clip-path: inherit;
    border: 1px solid rgba(201, 168, 106, 0.26);
    background: rgba(29, 29, 29, 0.9);
    color: #f0dfbc;
    font-family: 'Cinzel', serif;
    font-size: 0.78rem;
  }

  .meta {
    min-width: 0;
  }

  .name {
    font-family: 'Cinzel', serif;
    color: #f0dfbc;
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .hp-track {
    height: 8px;
    margin-top: 6px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(201, 168, 106, 0.18);
    overflow: hidden;
  }

  .hp-fill {
    height: 100%;
    background: linear-gradient(90deg, #7a1d18, #d25a47 55%, #f0ad73);
  }
</style>
