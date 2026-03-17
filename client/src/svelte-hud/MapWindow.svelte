<script lang="ts">
  import { onMount } from 'svelte';
  import Window from './components/Window.svelte';
  import { worldStore } from './stores/gameUi';

  let canvasEl: HTMLCanvasElement | null = null;

  function draw() {
    const canvas = canvasEl;
    const state = $worldStore;
    if (!canvas || !state.world || !state.player) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#1d1d1b';
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = 'rgba(201, 168, 106, 0.12)';
    for (let x = -height; x < width + height; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + height, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, height);
      ctx.lineTo(x + height, 0);
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(201, 168, 106, 0.18)';
    ctx.fillRect(0, 0, width, 32);
    ctx.fillStyle = '#c9a86a';
    ctx.font = '12px Cinzel';
    ctx.fillText(`Mapa ${state.mapCode}`, 14, 20);
    const wx = Math.max(1, Number(state.world.world?.width || 1));
    const wy = Math.max(1, Number(state.world.world?.height || 1));
    const px = Math.max(0, Math.min(1, Number(state.player.x || 0) / wx));
    const py = Math.max(0, Math.min(1, Number(state.player.y || 0) / wy));
    const cx = width * 0.5 + (px - py) * width * 0.28;
    const cy = height * 0.2 + (px + py) * height * 0.28;
    ctx.fillStyle = '#f4e2ba';
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(244, 226, 186, 0.24)';
    ctx.beginPath();
    ctx.arc(cx, cy, 10, 0, Math.PI * 2);
    ctx.stroke();
  }

  $: draw();

  onMount(() => draw());
</script>

<Window title="Mapa" subtitle="Visao do mundo" width="520px">
  <div class="map-meta">
    <div class="map-pill">{$worldStore.mapCode}</div>
    <div class="map-coords">{$worldStore.coordsText}</div>
  </div>
  <canvas bind:this={canvasEl} class="map-canvas" width="480" height="320"></canvas>
</Window>

<style>
  .map-meta {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 12px;
    color: rgba(234, 224, 202, 0.78);
    font-size: 0.78rem;
  }

  .map-pill {
    font-family: 'Cinzel', serif;
    color: #c9a86a;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .map-canvas {
    width: 100%;
    max-width: 100%;
    display: block;
    clip-path: polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px);
    border: 1px solid rgba(201, 168, 106, 0.24);
    background: #0a0a09;
  }
</style>
