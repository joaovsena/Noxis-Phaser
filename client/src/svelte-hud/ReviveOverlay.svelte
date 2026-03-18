<script lang="ts">
  import { appStore, attributesStore, revivePlayer } from './stores/gameUi';

  $: hasPlayer = Boolean($attributesStore.player);
  $: dead = $appStore.connectionPhase === 'in_game'
    && hasPlayer
    && (Number($attributesStore.player?.hp || 0) <= 0 || Boolean($attributesStore.player?.dead));
</script>

{#if dead}
  <div class="overlay">
    <div class="card">
      <div class="title">Voce morreu.</div>
      <button type="button" on:click={revivePlayer}>Reviver aqui</button>
    </div>
  </div>
{/if}

<style>
  .overlay {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    pointer-events: auto;
    background: rgba(0, 0, 0, 0.35);
    backdrop-filter: blur(4px);
  }

  .card {
    min-width: 260px;
    padding: 20px;
    text-align: center;
    clip-path: polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px);
    border: 1px solid rgba(201, 168, 106, 0.32);
    background: linear-gradient(180deg, rgba(17, 15, 12, 0.97), rgba(8, 8, 8, 0.98));
    box-shadow: 0 18px 34px rgba(0, 0, 0, 0.28);
  }

  .title {
    margin-bottom: 14px;
    font-family: 'Cinzel', serif;
    color: #f0dfbc;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  button {
    min-height: 40px;
    border: 1px solid rgba(201, 168, 106, 0.28);
    background: linear-gradient(180deg, rgba(33, 24, 14, 0.96), rgba(12, 10, 8, 0.98));
    color: #ecdcb8;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    padding: 0 16px;
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
  }
</style>
