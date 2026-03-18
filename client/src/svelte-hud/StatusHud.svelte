<script lang="ts">
  import { onMount } from 'svelte';
  import { adminStore, attributesStore, worldStore } from './stores/gameUi';

  let fps = 0;
  let frameCount = 0;
  let lastMark = 0;
  let rafId = 0;

  onMount(() => {
    const tick = (now: number) => {
      if (!lastMark) lastMark = now;
      frameCount += 1;
      if (now - lastMark >= 1000) {
        fps = Math.round((frameCount * 1000) / (now - lastMark));
        frameCount = 0;
        lastMark = now;
      }
      rafId = window.requestAnimationFrame(tick);
    };
    rafId = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafId);
  });

  $: player = $attributesStore.player;
  $: mapCode = String($worldStore.world?.mapCode || '-');
  $: mapId = String($worldStore.world?.mapId || '-');
</script>

<div class="status-stack">
  {#if player?.afkActive}
    <div class="chip warm">AFK ativo</div>
  {/if}
  <div class="perf-chip">FPS {fps > 0 ? fps : '--'} | Ping {$adminStore.pingMs ?? '--'}ms | WS {$adminStore.socketConnected ? 'on' : 'off'} | {mapCode} / {mapId}</div>
</div>

<style>
  .status-stack {
    display: grid;
    justify-items: end;
    gap: 8px;
  }

  .chip,
  .perf-chip {
    pointer-events: auto;
    padding: 8px 12px;
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
    border: 1px solid rgba(201, 168, 106, 0.28);
    background: linear-gradient(180deg, rgba(17, 15, 12, 0.97), rgba(8, 8, 8, 0.98));
    color: #f0dfbc;
    font-family: 'Cinzel', serif;
    font-size: 0.62rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .warm {
    border-color: rgba(219, 145, 94, 0.42);
    color: #f0c69d;
  }

  .perf-chip {
    color: rgba(233, 223, 200, 0.88);
  }
</style>
