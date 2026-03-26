<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onDestroy, onMount } from 'svelte';
  import { drawMapPreview, loadMapPreview, previewPointToWorld, type MapPreviewData, worldPointToPreview } from '../game/maps/MapPreview';
  import Window from './components/Window.svelte';
  import { selectedMobStore, worldStore } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();

  type SideEntry = {
    id: string;
    label: string;
    meta: string;
    x: number;
    y: number;
    kind: 'npc';
  };

  let canvasEl: HTMLCanvasElement | null = null;
  let drawQueued = false;
  let rafId = 0;
  let previewData: MapPreviewData | null = null;
  let previewKey = '';
  let previewRequestId = 0;
  let focusedEntryId = '';
  let mapTitle = 'Mapa';
  let npcEntries: SideEntry[] = [];

  function prettifyLabel(raw: string) {
    const safe = String(raw || '').trim();
    if (!safe) return 'Mapa';
    return safe
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/\b\w/g, (letter) => letter.toUpperCase());
  }

  function focusEntry(entry: SideEntry) {
    focusedEntryId = String(entry.id || '');
    scheduleDraw();
  }

  function dispatchMove(x: number, y: number) {
    window.dispatchEvent(new CustomEvent('noxis:svelte-worldmap-move', { detail: { x, y } }));
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
    if (!canvas || !state.world || !state.player) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    const world = state.world;
    const worldWidth = Math.max(1, Number(world.world?.width || 1));
    const worldHeight = Math.max(1, Number(world.world?.height || 1));
    const selectedMobId = String($selectedMobStore?.id || '');
    const focusedEntry = npcEntries.find((entry) => entry.id === focusedEntryId) || null;

    if (previewData) {
      drawMapPreview(ctx, previewData, width, height, { showGrid: false });
    } else {
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = '#040508';
      ctx.fillRect(0, 0, width, height);
    }

    const drawPoint = (x: number, y: number, color: string, size: number, stroke = '') => {
      const point = previewData
        ? worldPointToPreview(x, y, previewData, width, height)
        : {
            x: (x / worldWidth) * width,
            y: (y / worldHeight) * height
          };
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
      ctx.fill();
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      return point;
    };

    if (focusedEntry) {
      const me = previewData
        ? worldPointToPreview(Number(state.player.x || 0), Number(state.player.y || 0), previewData, width, height)
        : {
            x: (Number(state.player.x || 0) / worldWidth) * width,
            y: (Number(state.player.y || 0) / worldHeight) * height
          };
      const targetPoint = previewData
        ? worldPointToPreview(focusedEntry.x, focusedEntry.y, previewData, width, height)
        : {
            x: (focusedEntry.x / worldWidth) * width,
            y: (focusedEntry.y / worldHeight) * height
          };

      ctx.beginPath();
      ctx.moveTo(me.x, me.y);
      ctx.lineTo(targetPoint.x, targetPoint.y);
      ctx.strokeStyle = 'rgba(241, 242, 255, 0.82)';
      ctx.lineWidth = 1.8;
      ctx.setLineDash([7, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    (world.portals || []).forEach((portal: any) => drawPoint(Number(portal.x || 0), Number(portal.y || 0), '#8b73ff', 4.4));
    (world.activeEvents || []).forEach((evt: any) => drawPoint(Number(evt.x || 0), Number(evt.y || 0), '#ffcf65', 5.2));
    (world.npcs || []).forEach((npc: any) => drawPoint(Number(npc.x || 0), Number(npc.y || 0), '#50da99', 4.1));
    (world.mobs || []).forEach((mob: any) => {
      const selected = String(mob.id || '') === selectedMobId;
      drawPoint(Number(mob.x || 0), Number(mob.y || 0), selected ? '#fff091' : '#ea5353', selected ? 4.4 : 3.4, selected ? '#fff7ca' : '');
    });
    Object.values(world.players || {}).forEach((entry: any) => {
      const mine = Number(entry.id || 0) === Number(state.player?.id || 0);
      drawPoint(Number(entry.x || 0), Number(entry.y || 0), mine ? '#54baff' : '#edf3ff', mine ? 4 : 3.2, mine ? '#ffe9a4' : '');
    });

    const me = previewData
      ? worldPointToPreview(Number(state.player.x || 0), Number(state.player.y || 0), previewData, width, height)
      : {
          x: (Number(state.player.x || 0) / worldWidth) * width,
          y: (Number(state.player.y || 0) / worldHeight) * height
        };
    ctx.save();
    ctx.translate(me.x, me.y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#38d7ff';
    ctx.fillRect(-5, -5, 10, 10);
    ctx.strokeStyle = '#eaf3ff';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(-5, -5, 10, 10);
    ctx.restore();

    if (focusedEntry) {
      drawPoint(focusedEntry.x, focusedEntry.y, '#ffc555', 6, '#fff2c2');
    }
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
      ? previewPointToWorld(localX, localY, previewData, rect.width, rect.height)
      : {
          x: (localX / Math.max(1, rect.width)) * Math.max(1, Number(world.world.width || 1)),
          y: (localY / Math.max(1, rect.height)) * Math.max(1, Number(world.world.height || 1))
        };
    dispatchMove(target.x, target.y);
  }

  $: mapTitle = prettifyLabel(String($worldStore.world?.mapKey || $worldStore.mapCode || 'Mapa'));
  $: npcEntries = Array.isArray($worldStore.world?.npcs)
    ? [...$worldStore.world.npcs]
      .map((npc: any) => ({
        id: `npc:${String(npc?.id || npc?.name || `${npc?.x || 0}:${npc?.y || 0}`)}`,
        label: String(npc?.name || npc?.title || 'NPC'),
        meta: `X:${Math.round(Number(npc?.x || 0))} Y:${Math.round(Number(npc?.y || 0))}`,
        x: Number(npc?.x || 0),
        y: Number(npc?.y || 0),
        kind: 'npc' as const
      }))
      .sort((a, b) => a.label.localeCompare(b.label))
    : [];
  $: if (focusedEntryId && !npcEntries.some((entry) => entry.id === focusedEntryId)) {
    focusedEntryId = '';
  }
  $: syncPreview();
  $: $worldStore, $selectedMobStore, focusedEntryId, scheduleDraw();

  onMount(() => {
    void syncPreview();
    scheduleDraw();
  });

  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
  });
</script>

<Window
  title={mapTitle}
  subtitle="Mapa"
  theme="classic"
  minimizable={false}
  scrollable={false}
  width="clamp(820px, 74vw, 980px)"
  maxWidth="980px"
  maxBodyHeight="min(84vh, 900px)"
  on:close={() => dispatch('close')}
>
  <div class="map-window">
    <div class="map-toolbar">
      <div class="coord-readout">{$worldStore.coordsText}</div>
      <button class="world-button" type="button" disabled>Mapa mundial</button>
    </div>

    <div class="map-grid">
      <section class="main-map-panel">
        <div class="map-canvas-shell">
          <canvas bind:this={canvasEl} class="map-canvas" width="660" height="458" on:click={handleCanvasClick}></canvas>
        </div>
      </section>

      <aside class="map-sidebar">
        <section class="side-panel">
          <header>NPCs</header>
          <div class="entry-list">
            {#if npcEntries.length}
              {#each npcEntries as entry}
                <button
                  class={`entry-button ${focusedEntryId === entry.id ? 'active' : ''}`}
                  type="button"
                  on:click={() => {
                    focusEntry(entry);
                    dispatchMove(entry.x, entry.y);
                  }}
                >
                  <span>{entry.label}</span>
                  <small>{entry.meta}</small>
                </button>
              {/each}
            {:else}
              <div class="empty-note">Nenhum NPC visivel neste mapa.</div>
            {/if}
          </div>
        </section>
      </aside>
    </div>
  </div>
</Window>

<style>
  .map-window {
    display: grid;
    gap: 10px;
  }

  .map-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .coord-readout {
    color: #f4ebcb;
    font-family: 'Cinzel', serif;
    font-size: 0.8rem;
    letter-spacing: 0.03em;
  }

  .world-button {
    min-height: 28px;
    padding: 0 12px;
    border-radius: 8px;
    border: 1px solid rgba(228, 206, 142, 0.4);
    background: linear-gradient(180deg, rgba(130, 106, 56, 0.92), rgba(67, 51, 26, 0.98));
    color: #fff6d7;
    font-family: 'Cinzel', serif;
    font-size: 0.78rem;
  }

  .world-button:disabled {
    opacity: 0.8;
    cursor: not-allowed;
  }

  .map-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 214px;
    gap: 12px;
    min-height: 0;
  }

  .main-map-panel,
  .map-sidebar,
  .side-panel,
  .entry-list {
    display: grid;
    gap: 10px;
    min-height: 0;
  }

  .map-canvas-shell,
  .side-panel {
    padding: 8px;
    border: 1px solid rgba(228, 206, 142, 0.3);
    border-radius: 12px;
    background:
      linear-gradient(180deg, rgba(83, 75, 47, 0.92), rgba(64, 59, 38, 0.98)),
      linear-gradient(180deg, rgba(255, 255, 255, 0.04), transparent);
    box-shadow: inset 0 1px 0 rgba(255, 245, 214, 0.08);
  }

  .map-canvas {
    width: 100%;
    display: block;
    border: 1px solid rgba(232, 216, 174, 0.38);
    background: #050608;
    cursor: crosshair;
    image-rendering: crisp-edges;
  }

  .map-sidebar {
    grid-template-rows: minmax(0, 1fr);
  }

  .side-panel header {
    color: #fff6d6;
    font-family: 'Cinzel', serif;
    font-size: 0.86rem;
    text-align: center;
    border-bottom: 1px solid rgba(228, 206, 142, 0.2);
    padding-bottom: 6px;
  }

  .entry-list {
    overflow: auto;
    padding-right: 4px;
  }

  .entry-list::-webkit-scrollbar {
    width: 8px;
  }

  .entry-list::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(209, 177, 103, 0.58), rgba(103, 77, 36, 0.86));
  }

  .entry-button {
    display: grid;
    gap: 2px;
    padding: 7px 8px;
    border-radius: 8px;
    border: 1px solid rgba(232, 216, 174, 0.16);
    background: rgba(21, 16, 9, 0.42);
    text-align: left;
    color: #f7edcc;
    transition: transform 140ms ease, border-color 160ms ease, background 160ms ease;
  }

  .entry-button span {
    font-size: 0.78rem;
  }

  .entry-button small {
    color: rgba(245, 236, 213, 0.68);
    font-size: 0.66rem;
  }

  .entry-button:hover {
    transform: translateY(-1px);
    border-color: rgba(232, 216, 174, 0.34);
    background: rgba(60, 45, 22, 0.54);
  }

  .entry-button.active {
    border-color: rgba(255, 224, 148, 0.54);
    background: linear-gradient(180deg, rgba(104, 78, 32, 0.74), rgba(58, 42, 18, 0.92));
    box-shadow: 0 0 0 1px rgba(255, 230, 175, 0.1);
  }

  .entry-button.kind-event.active {
    border-color: rgba(255, 216, 112, 0.7);
  }

  .entry-button.kind-portal.active {
    border-color: rgba(169, 148, 255, 0.7);
  }

  .empty-note {
    padding: 10px 8px;
    color: rgba(244, 236, 214, 0.72);
    font-size: 0.74rem;
  }

  @media (max-width: 1040px) {
    .map-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
