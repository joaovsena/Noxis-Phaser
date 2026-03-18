<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onDestroy, onMount } from 'svelte';
  import { adminStore, hudScaleStore, leaveDungeon, mapSettingsStore, playerMetaStore, resetHudScale, selectedAutoAttackStore, selectedMobStore, sendAdminCommand, setHudScale, setInteractionDebugEnabled, setMapSetting, setMobPeacefulEnabled, setPathDebugEnabled, setSelectedAutoAttack, skillsStore, switchInstance, toggleMapSettings, worldStore } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();
  let canvasEl: HTMLCanvasElement | null = null;
  let drawQueued = false;
  let rafId = 0;

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
    const worldWidth = Math.max(1, Number(bounds.width || 1));
    const worldHeight = Math.max(1, Number(bounds.height || 1));
    const selectedMobId = String($selectedMobStore?.id || '');
    const mapCode = String(world?.mapCode || state.mapCode || '').toUpperCase();
    const palette = mapCode === 'A2'
      ? { base: '#c4a36a', line: 'rgba(110, 77, 34, 0.28)' }
      : mapCode === 'DNG'
        ? { base: '#b8aa8d', line: 'rgba(72, 56, 33, 0.24)' }
        : { base: '#89a74c', line: 'rgba(76, 109, 34, 0.24)' };

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = palette.base;
    ctx.fillRect(0, 0, width, height);

    const offset = ((Number(player.x || 0) + Number(player.y || 0)) / 22) % 18;
    ctx.strokeStyle = palette.line;
    ctx.lineWidth = 1;
    for (let x = -height; x < width + height; x += 18) {
      ctx.beginPath();
      ctx.moveTo(x + offset, 0);
      ctx.lineTo(x + height + offset, height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - offset, 0);
      ctx.lineTo(x - height - offset, height);
      ctx.stroke();
    }

    const drawPoint = (worldX: number, worldY: number, color: string, radius: number, stroke = '') => {
      const px = (worldX / worldWidth) * width;
      const py = (worldY / worldHeight) * height;
      ctx.beginPath();
      ctx.fillStyle = color;
      ctx.arc(px, py, radius, 0, Math.PI * 2);
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
    const nx = Math.max(0, Math.min(1, (event.clientX - rect.left) / Math.max(1, rect.width)));
    const ny = Math.max(0, Math.min(1, (event.clientY - rect.top) / Math.max(1, rect.height)));
    const x = nx * Math.max(1, Number(world.world.width || 1));
    const y = ny * Math.max(1, Number(world.world.height || 1));
    window.dispatchEvent(new CustomEvent('noxis:svelte-minimap-move', { detail: { x, y } }));
  }

  $: $worldStore, $selectedMobStore, $mapSettingsStore, scheduleDraw();

  onMount(() => scheduleDraw());
  onDestroy(() => {
    if (rafId) cancelAnimationFrame(rafId);
  });
</script>

<section class="minimap-shell">
  <div class="header" data-window-drag-handle="true">
    <div>
      <div class="eyebrow">Minimapa</div>
      <div class="title">{$worldStore.mapCode}</div>
    </div>
    <div class="header-right">
      <div class="coords">{$worldStore.coordsText}</div>
      <button class="mini-btn" type="button" aria-label="Configurar minimapa" on:click={() => toggleMapSettings()}>&#9881;</button>
      <button class="close-btn" type="button" aria-label="Fechar minimapa" on:click={() => dispatch('close')}>x</button>
    </div>
  </div>

  <canvas bind:this={canvasEl} class="canvas" width="260" height="180" on:click={handleCanvasClick}></canvas>

  <div class="instance-row">
    <label for="instance-select-svelte">Instancia</label>
    <select id="instance-select-svelte" value={$playerMetaStore.currentInstance} on:change={(event) => switchInstance((event.currentTarget as HTMLSelectElement).value)}>
      {#each $playerMetaStore.availableInstances as instanceId}
        <option value={instanceId}>{instanceId}</option>
      {/each}
    </select>
  </div>

  {#if $playerMetaStore.isDungeon}
    <button class="dungeon-leave-btn" type="button" on:click={leaveDungeon}>Sair da Dungeon</button>
  {/if}

  {#if $mapSettingsStore.open}
    <div class="settings-panel">
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
      {#if $adminStore.isAdmin}
        <label class="setting-line">
          <input type="checkbox" checked={$adminStore.pathDebugEnabled} on:change={(event) => setPathDebugEnabled((event.currentTarget as HTMLInputElement).checked)} />
          <span>Debug Path</span>
        </label>
        <label class="setting-line">
          <input type="checkbox" checked={$adminStore.interactionDebugEnabled} on:change={(event) => setInteractionDebugEnabled((event.currentTarget as HTMLInputElement).checked)} />
          <span>Debug Interacao</span>
        </label>
        <label class="setting-line">
          <input type="checkbox" checked={$adminStore.mobPeacefulEnabled} on:change={(event) => setMobPeacefulEnabled((event.currentTarget as HTMLInputElement).checked)} />
          <span>Mobs pacificos</span>
        </label>
        <div class="hud-scale-panel">
          <div class="hud-scale-top">
            <span>Escala HUD</span>
            <span>{Math.round($hudScaleStore * 100)}%</span>
          </div>
          <input type="range" min="70" max="140" step="1" value={Math.round($hudScaleStore * 100)} on:input={(event) => setHudScale(Number((event.currentTarget as HTMLInputElement).value) / 100)} />
          <button class="mini-action" type="button" on:click={resetHudScale}>Reset HUD</button>
          <button class="mini-action warning" type="button" on:click={() => sendAdminCommand('dungeon.debug')}>Debug Dungeon</button>
        </div>
      {/if}
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
    pointer-events: auto;
    width: 292px;
    padding: 14px;
    position: relative;
    overflow: hidden;
    clip-path: polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px);
    border: 1px solid rgba(201, 168, 106, 0.34);
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
    clip-path: inherit;
    border: 1px solid rgba(201, 168, 106, 0.1);
    pointer-events: none;
  }

  .header,
  .instance-row,
  .settings-panel,
  .dungeon-leave-btn {
    position: relative;
    z-index: 1;
  }

  .header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
    cursor: grab;
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
  }

  .coords {
    align-self: end;
    font-size: 0.72rem;
    color: rgba(234, 224, 202, 0.78);
  }

  .canvas,
  .instance-row select,
  .mini-btn,
  .close-btn,
  .dungeon-leave-btn,
  .settings-panel select {
    clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px);
  }

  .mini-btn,
  .close-btn,
  .dungeon-leave-btn,
  .instance-row select,
  .settings-panel select {
    border: 1px solid rgba(201, 168, 106, 0.24);
    background: linear-gradient(180deg, rgba(28, 22, 15, 0.94), rgba(10, 8, 7, 0.98));
    color: #e8d5aa;
    font-family: 'Cinzel', serif;
  }

  .mini-btn,
  .close-btn {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    line-height: 1;
  }

  .canvas {
    width: 100%;
    display: block;
    border: 1px solid rgba(201, 168, 106, 0.22);
    background: #0c120b;
    cursor: pointer;
  }

  .instance-row,
  .auto-attack-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-top: 10px;
    color: rgba(234, 224, 202, 0.78);
    font-size: 0.76rem;
  }

  .hud-scale-panel {
    display: grid;
    gap: 8px;
    margin-top: 10px;
    padding-top: 8px;
    border-top: 1px solid rgba(201, 168, 106, 0.12);
  }

  .hud-scale-top {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    color: rgba(234, 224, 202, 0.78);
    font-size: 0.76rem;
  }

  .hud-scale-panel input[type="range"] {
    width: 100%;
  }

  .mini-action {
    min-height: 32px;
    border: 1px solid rgba(201, 168, 106, 0.24);
    background: linear-gradient(180deg, rgba(28, 22, 15, 0.94), rgba(10, 8, 7, 0.98));
    color: #e8d5aa;
    font-family: 'Cinzel', serif;
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px);
  }

  .mini-action.warning {
    border-color: rgba(217, 154, 95, 0.3);
    color: #f0c790;
  }

  .instance-row label,
  .auto-attack-row span {
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: rgba(201, 168, 106, 0.72);
  }

  .instance-row select,
  .settings-panel select {
    min-height: 34px;
    padding: 0 10px;
  }

  .dungeon-leave-btn {
    margin-top: 10px;
    width: 100%;
    min-height: 38px;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .settings-panel {
    margin-top: 10px;
    padding: 10px;
    border: 1px solid rgba(201, 168, 106, 0.2);
    background: rgba(10, 10, 10, 0.72);
    display: grid;
    gap: 8px;
  }

  .setting-line {
    display: flex;
    align-items: center;
    gap: 8px;
    color: rgba(233, 223, 200, 0.82);
    font-size: 0.78rem;
  }
</style>
