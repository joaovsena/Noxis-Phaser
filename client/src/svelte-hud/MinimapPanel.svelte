<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onDestroy, onMount } from 'svelte';
  import { drawMapPreview, loadMapPreview, previewPointToWorld, type MapPreviewData, worldPointToPreview } from '../game/maps/MapPreview';
  import {
    leaveDungeon,
    mapSettingsStore,
    playerMetaStore,
    selectedAutoAttackStore,
    selectedMobStore,
    setSelectedAutoAttack,
    skillsStore,
    switchInstance,
    toggleMapSettings,
    togglePanel,
    worldStore
  } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();
  export let fixed = false;
  export let showClose = true;

  const zoomLevels = [2.5, 3.2, 4, 4.8];

  let canvasEl: HTMLCanvasElement | null = null;
  let drawQueued = false;
  let rafId = 0;
  let previewData: MapPreviewData | null = null;
  let previewKey = '';
  let previewRequestId = 0;
  let zoomIndex = 2;
  let minimapViewport: { centerX: number; centerY: number; zoom?: number } | null = null;
  let areaTitle = 'Mapa';

  function prettifyLabel(raw: string) {
    const safe = String(raw || '').trim();
    if (!safe) return 'Mapa';
    return safe
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function cycleZoom(direction: -1 | 1) {
    zoomIndex = Math.max(0, Math.min(zoomLevels.length - 1, zoomIndex + direction));
    scheduleDraw();
  }

  async function syncPreview() {
    const world = $worldStore.world;
    const mapTiled = world?.mapTiled || null;
    const key = `${String(mapTiled?.tmjUrl || '')}|${Number(world?.world?.width || 0)}x${Number(world?.world?.height || 0)}|${String(world?.mapCode || $worldStore.mapCode || '')}|${String(world?.mapKey || '')}`;
    if (key === previewKey) return;
    previewKey = key;
    const requestId = ++previewRequestId;
    const nextPreview = await loadMapPreview({
      tmjUrl: mapTiled?.tmjUrl || null,
      world: world?.world || null,
      mapCode: String(world?.mapCode || $worldStore.mapCode || ''),
      mapKey: String(world?.mapKey || '')
    });
    if (requestId !== previewRequestId) return;
    previewData = nextPreview;
    scheduleDraw();
  }

  function draw() {
    drawQueued = false;
    rafId = 0;
    const canvas = canvasEl;
    const state = $worldStore;
    const world = state.world;
    const player = state.player;
    const bounds = world?.world;
    if (!canvas || !world || !player || !bounds) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const selectedMobId = String($selectedMobStore?.id || '');

    if (previewData) {
      drawMapPreview(ctx, previewData, width, height, { showGrid: false, viewport: minimapViewport });
    } else {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#121522';
      ctx.fillRect(0, 0, width, height);
    }

    const drawPoint = (worldX: number, worldY: number, color: string, radius: number, stroke = '') => {
      const point = previewData
        ? worldPointToPreview(worldX, worldY, previewData, width, height, minimapViewport)
        : {
            x: (worldX / Math.max(1, Number(bounds.width || 1))) * width,
            y: (worldY / Math.max(1, Number(bounds.height || 1))) * height
          };
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.15;
        ctx.stroke();
      }
      return point;
    };

    (world.mobs || []).forEach((mob: any) => {
      const selected = String(mob?.id || '') === selectedMobId;
      drawPoint(Number(mob?.x || 0), Number(mob?.y || 0), selected ? '#ffd768' : '#f24e4e', selected ? 3.1 : 2.3, selected ? '#fff1b4' : '');
    });

    Object.values(world.players || {}).forEach((entry: any) => {
      const mine = Number(entry?.id || 0) === Number(player?.id || 0);
      drawPoint(Number(entry?.x || 0), Number(entry?.y || 0), mine ? '#3ec0ff' : '#f2f6ff', mine ? 2.9 : 2.1, mine ? '#ffe8a3' : '');
    });

    (world.npcs || []).forEach((npc: any) => drawPoint(Number(npc?.x || 0), Number(npc?.y || 0), '#47db8d', 2.2));
    (world.portals || []).forEach((portal: any) => drawPoint(Number(portal?.x || 0), Number(portal?.y || 0), '#7d73ff', 2.2));
    (world.activeEvents || []).forEach((entry: any) => drawPoint(Number(entry?.x || 0), Number(entry?.y || 0), '#ffd166', 2.7));

    const me = previewData
      ? worldPointToPreview(Number(player.x || 0), Number(player.y || 0), previewData, width, height, minimapViewport)
      : {
          x: (Number(player.x || 0) / Math.max(1, Number(bounds.width || 1))) * width,
          y: (Number(player.y || 0) / Math.max(1, Number(bounds.height || 1))) * height
        };

    ctx.save();
    ctx.translate(me.x, me.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#ffcf45';
    ctx.fillRect(-4.5, -4.5, 9, 9);
    ctx.strokeStyle = '#fff7d6';
    ctx.lineWidth = 1.3;
    ctx.strokeRect(-4.5, -4.5, 9, 9);
    ctx.restore();

    ctx.strokeStyle = 'rgba(238, 214, 139, 0.6)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(3.5, 3.5, width - 7, height - 7);
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
    const localX = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
    const localY = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
    const target = previewData
      ? previewPointToWorld(localX, localY, previewData, rect.width, rect.height, minimapViewport)
      : {
          x: (localX / Math.max(1, rect.width)) * Math.max(1, Number(world.world.width || 1)),
          y: (localY / Math.max(1, rect.height)) * Math.max(1, Number(world.world.height || 1))
        };
    window.dispatchEvent(new CustomEvent('noxis:svelte-minimap-move', { detail: { x: target.x, y: target.y } }));
  }

  $: areaTitle = prettifyLabel(String($worldStore.world?.mapKey || $worldStore.mapCode || 'Mapa'));
  $: minimapViewport = $worldStore.player
    ? {
        centerX: Number($worldStore.player.x || 0),
        centerY: Number($worldStore.player.y || 0),
        zoom: zoomLevels[zoomIndex]
      }
    : null;
  $: syncPreview();
  $: $worldStore, $selectedMobStore, $mapSettingsStore, zoomIndex, scheduleDraw();

  onMount(() => {
    void syncPreview();
    scheduleDraw();
  });

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
  });
</script>

<section class={`minimap-shell ${fixed ? 'fixed' : ''}`}>
  <div class="crest-medallion" aria-hidden="true">
    <span></span>
  </div>

  <div class="side-strip">
    <button class:active={$mapSettingsStore.open} class="edge-button" type="button" aria-label="Configuracoes do minimapa" on:click={() => toggleMapSettings()}>
      &#9881;
    </button>
    <button class="edge-button wide" type="button" aria-label="Abrir mapa" on:click={() => togglePanel('map')}>
      M
    </button>
  </div>

  <div class="mini-header" data-window-drag-handle={fixed ? undefined : 'true'}>
    <div class="title-stack">
      <strong>{areaTitle}</strong>
      <span>{$worldStore.mapCode}</span>
    </div>

    <div class="header-chrome">
      <div class="instance-badge">{$playerMetaStore.currentInstance}</div>
      {#if showClose}
        <button class="corner-button" type="button" aria-label="Fechar minimapa" on:click={() => dispatch('close')}>x</button>
      {/if}
    </div>
  </div>

  <div class="map-frame">
    <canvas bind:this={canvasEl} class="canvas" width="208" height="176" on:click={handleCanvasClick}></canvas>

    <div class="coords-readout">{$worldStore.coordsText}</div>

    <div class="zoom-strip">
      <button class="zoom-button" type="button" aria-label="Diminuir zoom" on:click={() => cycleZoom(-1)}>-</button>
      <button class="zoom-button" type="button" aria-label="Aumentar zoom" on:click={() => cycleZoom(1)}>+</button>
    </div>
  </div>

  {#if $mapSettingsStore.open}
    <div class="settings-panel">
      <div class="settings-head">Configuracoes do mapa</div>

      <div class="setting-group">
        <label for="minimap-instance-select">Instancia</label>
        <select id="minimap-instance-select" value={$playerMetaStore.currentInstance} on:change={(event) => switchInstance((event.currentTarget as HTMLSelectElement).value)}>
          {#each $playerMetaStore.availableInstances as instanceId}
            <option value={instanceId}>{instanceId}</option>
          {/each}
        </select>
      </div>

      <div class="setting-group">
        <label for="minimap-autoattack-select">Auto ataque</label>
        <select id="minimap-autoattack-select" value={$selectedAutoAttackStore} on:change={(event) => setSelectedAutoAttack((event.currentTarget as HTMLSelectElement).value)}>
          {#each $skillsStore.autoAttack as entry}
            <option value={entry.id}>{entry.label}</option>
          {/each}
        </select>
      </div>

      {#if $playerMetaStore.isDungeon}
        <button class="leave-button" type="button" on:click={leaveDungeon}>Sair da dungeon</button>
      {/if}
    </div>
  {/if}
</section>

<style>
  .minimap-shell {
    position: relative;
    width: 100%;
    padding: 10px 10px 10px 36px;
    border: 1px solid rgba(216, 192, 124, 0.46);
    border-radius: 20px;
    background:
      radial-gradient(circle at top left, rgba(255, 240, 204, 0.1), transparent 30%),
      linear-gradient(180deg, rgba(59, 49, 28, 0.98), rgba(34, 28, 18, 0.99));
    box-shadow:
      inset 0 1px 0 rgba(255, 241, 202, 0.12),
      inset 0 0 0 1px rgba(88, 70, 32, 0.86),
      0 16px 28px rgba(0, 0, 0, 0.28);
    pointer-events: auto;
    overflow: hidden;
  }

  .minimap-shell::before {
    content: '';
    position: absolute;
    inset: 6px;
    border: 1px solid rgba(230, 210, 160, 0.18);
    border-radius: 14px;
    pointer-events: none;
  }

  .crest-medallion {
    position: absolute;
    top: 6px;
    left: 6px;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    border: 1px solid rgba(232, 210, 150, 0.54);
    background:
      radial-gradient(circle at 40% 34%, rgba(255, 250, 232, 0.4), transparent 34%),
      linear-gradient(180deg, rgba(137, 108, 51, 0.96), rgba(68, 49, 20, 0.98));
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.28);
    display: grid;
    place-items: center;
  }

  .crest-medallion span {
    width: 12px;
    height: 12px;
    border-radius: 999px;
    background: radial-gradient(circle, #9af2ff, #2a6ea6);
    box-shadow: 0 0 10px rgba(93, 211, 255, 0.48);
  }

  .side-strip,
  .mini-header,
  .settings-panel,
  .map-frame {
    position: relative;
    z-index: 1;
  }

  .side-strip {
    position: absolute;
    top: 32px;
    left: 4px;
    display: grid;
    gap: 4px;
  }

  .edge-button,
  .corner-button,
  .zoom-button,
  .settings-panel select,
  .leave-button {
    border: 1px solid rgba(232, 210, 150, 0.34);
    background: linear-gradient(180deg, rgba(90, 72, 39, 0.96), rgba(43, 32, 18, 0.98));
    color: #fff5d5;
    font-family: 'Cinzel', serif;
    line-height: 1;
    box-shadow: inset 0 1px 0 rgba(255, 244, 218, 0.08);
  }

  .edge-button,
  .corner-button,
  .zoom-button {
    width: 24px;
    height: 24px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    font-size: 0.72rem;
    font-weight: 700;
  }

  .edge-button.wide {
    height: 28px;
  }

  .edge-button.active {
    border-color: rgba(255, 225, 146, 0.6);
    background: linear-gradient(180deg, rgba(126, 102, 51, 0.96), rgba(66, 50, 21, 0.98));
  }

  .mini-header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 8px;
    cursor: grab;
  }

  .minimap-shell.fixed .mini-header {
    cursor: default;
  }

  .title-stack {
    display: grid;
    gap: 2px;
  }

  .title-stack strong {
    color: #9efe52;
    font-family: 'Cinzel', serif;
    font-size: 0.74rem;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.92);
  }

  .title-stack span {
    color: #fff2c7;
    font-size: 0.64rem;
    opacity: 0.88;
  }

  .header-chrome {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .instance-badge {
    min-width: 26px;
    height: 22px;
    padding: 0 7px;
    border-radius: 999px;
    border: 1px solid rgba(232, 210, 150, 0.32);
    background: rgba(23, 18, 11, 0.58);
    color: #ffe48f;
    font-family: 'Cinzel', serif;
    font-size: 0.68rem;
    display: grid;
    place-items: center;
  }

  .map-frame {
    padding: 4px;
    border: 1px solid rgba(232, 214, 166, 0.28);
    border-radius: 12px;
    background:
      linear-gradient(180deg, rgba(80, 72, 45, 0.94), rgba(54, 46, 27, 0.98)),
      linear-gradient(180deg, rgba(255, 255, 255, 0.06), transparent);
  }

  .canvas {
    width: 100%;
    display: block;
    border: 1px solid rgba(235, 222, 184, 0.28);
    background: #050608;
    cursor: pointer;
    image-rendering: crisp-edges;
  }

  .coords-readout {
    margin-top: 6px;
    color: #fff2cf;
    font-size: 0.7rem;
    text-align: right;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  }

  .zoom-strip {
    position: absolute;
    right: 8px;
    bottom: 28px;
    display: grid;
    gap: 4px;
  }

  .settings-panel {
    margin-top: 8px;
    display: grid;
    gap: 8px;
    padding: 8px;
    border-radius: 12px;
    border: 1px solid rgba(232, 214, 166, 0.22);
    background: rgba(25, 18, 10, 0.82);
  }

  .settings-head,
  .setting-group label {
    color: #fff4d4;
    font-family: 'Cinzel', serif;
  }

  .settings-head {
    font-size: 0.68rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .setting-group {
    display: grid;
    gap: 4px;
  }

  .setting-group label {
    font-size: 0.62rem;
  }

  .settings-panel select {
    min-height: 28px;
    border-radius: 8px;
    padding: 0 8px;
    font-size: 0.72rem;
  }

  .leave-button {
    min-height: 28px;
    border-radius: 8px;
    padding: 0 10px;
    justify-self: start;
  }
</style>
