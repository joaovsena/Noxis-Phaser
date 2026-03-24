<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onDestroy, onMount } from 'svelte';
  import Window from './components/Window.svelte';
  import { mapSettingsStore, selectedMobStore, worldStore } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();
  let canvasEl: HTMLCanvasElement | null = null;
  let drawQueued = false;
  let rafId = 0;

  function projectIso(x: number, y: number, worldWidth: number, worldHeight: number, tileW: number, tileH: number, width: number, height: number) {
    const nx = x / worldWidth;
    const ny = y / worldHeight;
    return {
      x: (nx - ny) * tileW * 0.5 + width / 2,
      y: (nx + ny) * tileH * 0.5 + 24 + height * 0.18
    };
  }

  function draw() {
    drawQueued = false;
    rafId = 0;
    const canvas = canvasEl;
    const state = $worldStore;
    if (!canvas || !state.world || !state.player) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    const worldWidth = Math.max(1, Number(state.world.world?.width || 1));
    const worldHeight = Math.max(1, Number(state.world.world?.height || 1));
    const tileW = 18;
    const tileH = 9;

    const drawPoint = (x: number, y: number, color: string, size: number, stroke = '') => {
      const point = projectIso(x, y, worldWidth, worldHeight, tileW, tileH, width, height);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    };

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#071019';
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = 'rgba(201, 168, 106, 0.1)';
    ctx.beginPath();
    ctx.moveTo(width / 2, 24);
    ctx.lineTo(width / 2 + width * 0.42, 24 + height * 0.36);
    ctx.lineTo(width / 2, 24 + height * 0.72);
    ctx.lineTo(width / 2 - width * 0.42, 24 + height * 0.36);
    ctx.closePath();
    ctx.fill();

    if ($mapSettingsStore.showPortals) {
      (state.world.portals || []).forEach((portal: any) => drawPoint(Number(portal.x || 0), Number(portal.y || 0), '#8f78ff', 4));
    }
    if ($mapSettingsStore.showEvents) {
      (state.world.activeEvents || []).forEach((evt: any) => drawPoint(Number(evt.x || 0), Number(evt.y || 0), '#ffd166', 5));
    }
    if ($mapSettingsStore.showNpcs) {
      (state.world.npcs || []).forEach((npc: any) => drawPoint(Number(npc.x || 0), Number(npc.y || 0), '#4fd09a', 4));
    }
    if ($mapSettingsStore.showMobs) {
      (state.world.mobs || []).forEach((mob: any) => {
        const selected = String(mob.id || '') === String($selectedMobStore?.id || '');
        drawPoint(Number(mob.x || 0), Number(mob.y || 0), selected ? '#ffef87' : '#cf4444', 4, selected ? '#fff7b2' : '');
      });
    }
    if ($mapSettingsStore.showPlayers) {
      Object.values(state.world.players || {}).forEach((entry: any) => {
        const mine = Number(entry.id || 0) === Number(state.player?.id || 0);
        drawPoint(Number(entry.x || 0), Number(entry.y || 0), mine ? '#5bbcff' : '#d8dfe8', 4, mine ? '#ffe082' : '');
      });
    }

    const me = projectIso(Number(state.player.x || 0), Number(state.player.y || 0), worldWidth, worldHeight, tileW, tileH, width, height);
    ctx.strokeStyle = '#ffe082';
    ctx.lineWidth = 2;
    ctx.strokeRect(me.x - 5, me.y - 5, 10, 10);
  }

  function scheduleDraw() {
    if (drawQueued) return;
    drawQueued = true;
    rafId = requestAnimationFrame(() => draw());
  }

  function handleCanvasClick(event: MouseEvent) {
    const canvas = canvasEl;
    const world = $worldStore.world;
    if (!canvas || !world?.world) return;
    const rect = canvas.getBoundingClientRect();
    const px = ((event.clientX - rect.left) / Math.max(1, rect.width)) * canvas.width - canvas.width / 2;
    const py = ((event.clientY - rect.top) / Math.max(1, rect.height)) * canvas.height - 24 - canvas.height * 0.18;
    const nx = (py / 9) + (px / 18);
    const ny = (py / 9) - (px / 18);
    const x = Math.max(0, Math.min(Number(world.world.width || 0), nx * Number(world.world.width || 0)));
    const y = Math.max(0, Math.min(Number(world.world.height || 0), ny * Number(world.world.height || 0)));
    window.dispatchEvent(new CustomEvent('noxis:svelte-worldmap-move', { detail: { x, y } }));
  }

  $: $worldStore, $selectedMobStore, $mapSettingsStore, scheduleDraw();

  onMount(() => scheduleDraw());
  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
  });
</script>

<Window title="Mapa" subtitle="Visao do mundo" width="clamp(560px, 58vw, 700px)" maxWidth="700px" maxBodyHeight="min(80vh, 840px)" on:close={() => dispatch('close')}>
  <div class="map-meta">
    <div class="map-pill">{$worldStore.mapCode}</div>
    <div class="map-coords">{$worldStore.coordsText}</div>
  </div>
  <canvas bind:this={canvasEl} class="map-canvas" width="480" height="320" on:click={handleCanvasClick}></canvas>
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
    cursor: pointer;
  }
</style>
