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
    setMapSetting,
    setSelectedAutoAttack,
    skillsStore,
    switchInstance,
    toggleMapSettings,
    worldStore
  } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();
  export let fixed = false;
  export let showClose = true;

  let canvasEl: HTMLCanvasElement | null = null;
  let drawQueued = false;
  let rafId = 0;
  let previewData: MapPreviewData | null = null;
  let previewKey = '';
  let previewRequestId = 0;
  let minimapViewport: { centerX: number; centerY: number; zoom?: number } | null = null;

  $: minimapViewport = $worldStore.player
    ? {
        centerX: Number($worldStore.player.x || 0),
        centerY: Number($worldStore.player.y || 0),
        zoom: 3.4
      }
    : null;

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
      ctx.fillStyle = '#2d3c2d';
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
        ctx.lineWidth = 1.25;
        ctx.stroke();
      }
    };

    if ($mapSettingsStore.showMobs) {
      (world?.mobs || []).forEach((mob: any) => {
        const selected = String(mob?.id || '') === selectedMobId;
        drawPoint(Number(mob?.x || 0), Number(mob?.y || 0), selected ? '#ffef87' : '#e24b4b', selected ? 3.2 : 2.4, selected ? '#fff7b2' : '');
      });
    }

    if ($mapSettingsStore.showPlayers) {
      Object.values(world?.players || {}).forEach((entry: any) => {
        const mine = Number(entry?.id || 0) === Number(player?.id || 0);
        drawPoint(Number(entry?.x || 0), Number(entry?.y || 0), mine ? '#4ea3ff' : '#d8dfe8', mine ? 3 : 2.2, mine ? '#ffe082' : '');
      });
    }

    if ($mapSettingsStore.showNpcs) {
      (world?.npcs || []).forEach((npc: any) => drawPoint(Number(npc?.x || 0), Number(npc?.y || 0), '#4fd09a', 2.3));
    }

    if ($mapSettingsStore.showPortals) {
      (world?.portals || []).forEach((portal: any) => drawPoint(Number(portal?.x || 0), Number(portal?.y || 0), '#8f78ff', 2.2));
    }

    if ($mapSettingsStore.showEvents) {
      (world?.activeEvents || []).forEach((entry: any) => drawPoint(Number(entry?.x || 0), Number(entry?.y || 0), '#ffd166', 3));
    }

    ctx.strokeStyle = 'rgba(255, 226, 130, 0.38)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(6, 6, width - 12, height - 12);
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
    const x = target.x;
    const y = target.y;
    window.dispatchEvent(new CustomEvent('noxis:svelte-minimap-move', { detail: { x, y } }));
  }

  $: syncPreview();
  $: $worldStore, $selectedMobStore, $mapSettingsStore, scheduleDraw();

  onMount(() => {
    void syncPreview();
    scheduleDraw();
  });
  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
  });
</script>

<section class={`minimap-shell ${fixed ? 'fixed' : ''}`}>
  <div class="header" data-window-drag-handle={fixed ? undefined : 'true'}>
    <div>
      <div class="eyebrow">Minimapa</div>
      <div class="title">{$worldStore.mapCode} / {$worldStore.mapId}</div>
    </div>
    <div class="header-right">
      <div class="coords">{$worldStore.coordsText}</div>
      <button class="mini-btn" type="button" aria-label="Configurar minimapa" on:click={() => toggleMapSettings()}>&#9881;</button>
      {#if showClose}
        <button class="close-btn" type="button" aria-label="Fechar minimapa" on:click={() => dispatch('close')}>x</button>
      {/if}
    </div>
  </div>

  <canvas bind:this={canvasEl} class="canvas" width="214" height="132" on:click={handleCanvasClick}></canvas>

  <div class="legend-row">
    <span class="legend-pill player">Jogadores</span>
    <span class="legend-pill mob">Mobs</span>
    <span class="legend-pill npc">NPCs</span>
    <span class="legend-pill portal">Portais</span>
    <span class="legend-pill event">Eventos</span>
  </div>

  <div class="instance-row">
    <label for="instance-select-svelte">Instancia</label>
    <select id="instance-select-svelte" value={$playerMetaStore.currentInstance} on:change={(event) => switchInstance((event.currentTarget as HTMLSelectElement).value)}>
      {#each $playerMetaStore.availableInstances as instanceId}
        <option value={instanceId}>{instanceId}</option>
      {/each}
    </select>
    {#if $playerMetaStore.isDungeon}
      <button class="dungeon-leave-btn" type="button" on:click={leaveDungeon}>Sair</button>
    {/if}
  </div>

  {#if $mapSettingsStore.open}
    <div class="settings-panel">
      <div class="settings-title">Filtros do mapa</div>
      <label class="setting-line">
        <input type="checkbox" checked={$mapSettingsStore.autoAttackEnabled} on:change={(event) => setMapSetting('autoAttackEnabled', (event.currentTarget as HTMLInputElement).checked)} />
        <span>Ataque automatico</span>
      </label>
      <label class="setting-line">
        <input type="checkbox" checked={$mapSettingsStore.showPlayers} on:change={(event) => setMapSetting('showPlayers', (event.currentTarget as HTMLInputElement).checked)} />
        <span>Jogadores</span>
      </label>
      <label class="setting-line">
        <input type="checkbox" checked={$mapSettingsStore.showMobs} on:change={(event) => setMapSetting('showMobs', (event.currentTarget as HTMLInputElement).checked)} />
        <span>Mobs</span>
      </label>
      <label class="setting-line">
        <input type="checkbox" checked={$mapSettingsStore.showNpcs} on:change={(event) => setMapSetting('showNpcs', (event.currentTarget as HTMLInputElement).checked)} />
        <span>NPCs</span>
      </label>
      <label class="setting-line">
        <input type="checkbox" checked={$mapSettingsStore.showPortals} on:change={(event) => setMapSetting('showPortals', (event.currentTarget as HTMLInputElement).checked)} />
        <span>Portais</span>
      </label>
      <label class="setting-line">
        <input type="checkbox" checked={$mapSettingsStore.showEvents} on:change={(event) => setMapSetting('showEvents', (event.currentTarget as HTMLInputElement).checked)} />
        <span>Eventos</span>
      </label>
      <div class="auto-attack-row">
        <span>Auto ataque</span>
        <select value={$selectedAutoAttackStore} on:change={(event) => setSelectedAutoAttack((event.currentTarget as HTMLSelectElement).value)}>
          {#each $skillsStore.autoAttack as entry}
            <option value={entry.id}>{entry.label}</option>
          {/each}
        </select>
      </div>
    </div>
  {/if}
</section>

<style>
  .minimap-shell {
    width: 100%;
    padding: 10px;
    position: relative;
    overflow: hidden;
    border: 1px solid rgba(201, 168, 106, 0.34);
    border-radius: 18px;
    background:
      radial-gradient(circle at top, rgba(201, 168, 106, 0.08), transparent 34%),
      linear-gradient(180deg, rgba(17, 15, 12, 0.97), rgba(8, 8, 8, 0.98));
    box-shadow:
      0 18px 34px rgba(0, 0, 0, 0.28),
      inset 0 0 0 1px rgba(255, 239, 206, 0.03);
  }

  .minimap-shell::before {
    content: '';
    position: absolute;
    inset: 8px;
    border: 1px solid rgba(201, 168, 106, 0.1);
    border-radius: 12px;
    pointer-events: none;
  }

  .header,
  .legend-row,
  .instance-row,
  .settings-panel {
    position: relative;
    z-index: 1;
  }

  .header {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
    cursor: grab;
  }

  .minimap-shell.fixed .header {
    cursor: default;
  }

  .header-right {
    display: flex;
    align-items: end;
    gap: 8px;
  }

  .eyebrow {
    font-family: 'Cinzel', serif;
    font-size: 0.58rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(201, 168, 106, 0.72);
  }

  .title {
    margin-top: 4px;
    color: #f0dfbc;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    font-size: 0.76rem;
  }

  .coords {
    align-self: end;
    font-size: 0.6rem;
    color: rgba(234, 224, 202, 0.78);
  }

  .mini-btn,
  .close-btn,
  .dungeon-leave-btn,
  .instance-row select,
  .auto-attack-row select {
    border: 1px solid rgba(201, 168, 106, 0.24);
    background: linear-gradient(180deg, rgba(28, 22, 15, 0.94), rgba(10, 8, 7, 0.98));
    color: #e8d5aa;
    font-family: 'Cinzel', serif;
    border-radius: 10px;
  }

  .mini-btn,
  .close-btn {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    line-height: 1;
  }

  .close-btn {
    color: #efc1b5;
  }

  .canvas {
    position: relative;
    z-index: 1;
    width: 100%;
    display: block;
    border-radius: 14px;
    border: 1px solid rgba(201, 168, 106, 0.22);
    background: #0c120b;
    cursor: pointer;
    image-rendering: crisp-edges;
  }

  .legend-row,
  .instance-row,
  .settings-panel,
  .auto-attack-row {
    margin-top: 8px;
  }

  .legend-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .legend-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-height: 20px;
    padding: 0 6px;
    border-radius: 999px;
    border: 1px solid rgba(201, 168, 106, 0.16);
    background: rgba(9, 12, 16, 0.68);
    color: rgba(234, 224, 202, 0.78);
    font-size: 0.56rem;
  }

  .legend-pill::before {
    content: '';
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: currentColor;
    opacity: 0.96;
  }

  .legend-pill.player { color: #d8dfe8; }
  .legend-pill.mob { color: #e24b4b; }
  .legend-pill.npc { color: #4fd09a; }
  .legend-pill.portal { color: #8f78ff; }
  .legend-pill.event { color: #ffd166; }

  .instance-row,
  .auto-attack-row {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 8px;
    align-items: center;
    color: rgba(234, 224, 202, 0.78);
    font-size: 0.76rem;
  }

  .instance-row label,
  .auto-attack-row span,
  .settings-title {
    font-family: 'Cinzel', serif;
    color: #f0dfbc;
    text-transform: uppercase;
    font-size: 0.56rem;
    letter-spacing: 0.08em;
  }

  .instance-row select,
  .auto-attack-row select {
    min-height: 28px;
    padding: 0 8px;
  }

  .dungeon-leave-btn {
    min-height: 28px;
    padding: 0 10px;
  }

  .settings-panel {
    padding: 8px;
    border-radius: 14px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(7, 9, 11, 0.7);
    display: grid;
    gap: 10px;
  }

  .setting-line {
    display: flex;
    align-items: center;
    gap: 8px;
    color: rgba(233, 223, 200, 0.82);
    font-size: 0.66rem;
  }
</style>
