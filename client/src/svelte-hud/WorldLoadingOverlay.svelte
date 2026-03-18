<script lang="ts">
  import ProgressBar from './components/ProgressBar.svelte';
  import { loadingStore } from './stores/gameUi';

  $: progressPercent = Math.max(0, Math.min(100, Math.round($loadingStore.progress * 100)));
</script>

<div class="loading-shell" aria-live="polite" aria-busy="true">
  <div class="loading-card">
    <div class="loading-kicker">Sincronizando</div>
    <div class="loading-title">{$loadingStore.title}</div>
    <div class="loading-detail">{$loadingStore.detail}</div>
    <ProgressBar value={progressPercent} max={100} label={`${progressPercent}%`} tone="xp" />
  </div>
</div>

<style>
  .loading-shell {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    padding: 24px;
    background:
      radial-gradient(circle at 50% 24%, rgba(210, 168, 90, 0.14), transparent 24%),
      linear-gradient(180deg, rgba(4, 7, 10, 0.86), rgba(3, 5, 7, 0.92));
    pointer-events: auto;
  }

  .loading-card {
    width: min(420px, calc(100vw - 32px));
    display: grid;
    gap: 14px;
    padding: 24px 24px 20px;
    border: 1px solid rgba(201, 168, 106, 0.22);
    background:
      linear-gradient(180deg, rgba(15, 11, 8, 0.94), rgba(8, 10, 12, 0.98));
    box-shadow:
      0 22px 60px rgba(0, 0, 0, 0.42),
      inset 0 1px 0 rgba(255, 237, 196, 0.05);
    clip-path: polygon(18px 0, calc(100% - 18px) 0, 100% 18px, 100% calc(100% - 18px), calc(100% - 18px) 100%, 18px 100%, 0 calc(100% - 18px), 0 18px);
  }

  .loading-kicker {
    font-size: 0.68rem;
    letter-spacing: 0.32em;
    text-transform: uppercase;
    color: rgba(209, 176, 113, 0.72);
  }

  .loading-title {
    font-size: clamp(1.25rem, 2.4vw, 1.7rem);
    color: #f6ead0;
  }

  .loading-detail {
    font-size: 0.92rem;
    color: rgba(229, 219, 194, 0.78);
  }
</style>
