<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import ProgressBar from './components/ProgressBar.svelte';
  import { adminStore, appStore, loadingPacketStore, loadingStore, loadingTraceStore, worldStore } from './stores/gameUi';

  $: progressPercent = Math.max(0, Math.min(100, Math.round($loadingStore.progress * 100)));
  $: worldPlayers = Object.keys($worldStore.world?.players || {}).length;
  $: worldMobs = Array.isArray($worldStore.world?.mobs) ? $worldStore.world.mobs.length : 0;
  $: debugSteps = $loadingTraceStore
    .filter((line) => line.includes('WS <= debug.step'))
    .map((line) => line.replace(/^.*WS <= debug\.step \(/, '').replace(/\)\.?$/, ''));
  $: lastServerStep = debugSteps[0] || 'nenhuma etapa de servidor confirmada';
  $: packetStates = [
    { key: 'ws_open', value: $loadingPacketStore.wsOpen, done: Boolean($loadingPacketStore.wsOpen) },
    { key: 'announced_packet', value: $loadingPacketStore.announcedPacket, done: Boolean($loadingPacketStore.announcedPacket) },
    { key: 'auth_success', value: $loadingPacketStore.authSuccess, done: Boolean($loadingPacketStore.authSuccess) },
    { key: 'world_static', value: $loadingPacketStore.worldStatic, done: Boolean($loadingPacketStore.worldStatic) },
    { key: 'world_state', value: $loadingPacketStore.worldState, done: Boolean($loadingPacketStore.worldState) },
    { key: 'inventory_state', value: $loadingPacketStore.inventoryState, done: Boolean($loadingPacketStore.inventoryState) }
  ];
  $: nextExpectedPacket = packetStates.find((packet) => !packet.done)?.key || 'nenhum';
  $: diagnosisTitle = !debugSteps.length
    ? 'Cliente ainda nao recebeu etapas detalhadas do servidor.'
    : $loadingPacketStore.worldStatic && !$loadingPacketStore.worldState
      ? 'Fluxo para logo apos world_static.'
      : $loadingPacketStore.worldState && !$loadingPacketStore.inventoryState
        ? 'world_state chegou, mas inventory_state nao chegou.'
        : !$loadingPacketStore.authSuccess
          ? 'Travamento antes da autenticacao final.'
          : 'Fluxo parcialmente concluido.';
  $: diagnosisBody = !debugSteps.length
    ? 'O cliente montou a HUD, mas nenhuma etapa interna do character_enter foi confirmada.'
    : $loadingPacketStore.worldStatic && !$loadingPacketStore.worldState
      ? 'Ultimo pacote confirmado: world_static. Proximo pacote esperado: world_state. O ponto exato de bloqueio esta entre "character_enter: world_static enviado" e o envio/consumo de world_state.'
      : $loadingPacketStore.worldState && !$loadingPacketStore.inventoryState
        ? 'Ultimo pacote confirmado: world_state. Proximo pacote esperado: inventory_state. O bloqueio ocorre depois do snapshot do mundo e antes do inventario.'
        : !$loadingPacketStore.authSuccess
          ? 'Nem auth_success foi confirmado, entao o problema esta antes da entrada efetiva no personagem.'
          : 'Os pacotes basicos chegaram; o gargalo restante esta em uma etapa posterior do bootstrap.';
  let sceneDebug: any = null;
  let pollTimer = 0;

  function refreshSceneDebug() {
    const debugApi = (window as any).__NOXIS_DEBUG__;
    sceneDebug = typeof debugApi?.getSceneDebug === 'function' ? debugApi.getSceneDebug() : null;
  }

  onMount(() => {
    refreshSceneDebug();
    pollTimer = window.setInterval(refreshSceneDebug, 300);
  });

  onDestroy(() => {
    if (pollTimer) window.clearInterval(pollTimer);
  });
</script>

<div class="loading-shell" aria-live="polite" aria-busy="true">
  <div class="loading-card">
    <div class="loading-kicker">Sincronizando</div>
    <div class="loading-title">{$loadingStore.title}</div>
    <div class="loading-detail">{$loadingStore.detail}</div>
    <ProgressBar value={progressPercent} max={100} label={`${progressPercent}%`} tone="xp" />
    <div class="loading-debug">
      Fase {$appStore.connectionPhase} | WS {$adminStore.socketConnected ? 'on' : 'off'} | mapa {$worldStore.mapCode}/{$worldStore.mapId} | player {$worldStore.player ? 'ok' : 'pendente'} | players {worldPlayers} | mobs {worldMobs}
    </div>
    <div class="loading-diagnosis">
      <div><strong>Ultima etapa confirmada:</strong> {lastServerStep}</div>
      <div><strong>Proximo pacote esperado:</strong> {nextExpectedPacket}</div>
      <div><strong>Leitura objetiva:</strong> {diagnosisTitle}</div>
      <div><strong>Ponto provavel do bloqueio:</strong> {diagnosisBody}</div>
    </div>
    <div class="loading-packets">
      <div><strong>ws_open</strong>: {$loadingPacketStore.wsOpen || 'aguardando'}</div>
      <div><strong>announced_packet</strong>: {$loadingPacketStore.announcedPacket || 'aguardando'}</div>
      <div><strong>ws_error</strong>: {$loadingPacketStore.wsError || 'nenhum'}</div>
      <div><strong>ws_close</strong>: {$loadingPacketStore.wsClose || 'nenhum'}</div>
      <div><strong>auth_success</strong>: {$loadingPacketStore.authSuccess || 'aguardando'}</div>
      <div><strong>world_static</strong>: {$loadingPacketStore.worldStatic || 'aguardando'}</div>
      <div><strong>world_state</strong>: {$loadingPacketStore.worldState || 'aguardando'}</div>
      <div><strong>inventory_state</strong>: {$loadingPacketStore.inventoryState || 'aguardando'}</div>
      <div><strong>ultimo pacote</strong>: {$loadingPacketStore.lastPacket || 'nenhum'}</div>
    </div>
    {#if sceneDebug}
      <div class="loading-scene-debug">
        <div>Scene mapUrl: {sceneDebug.mapUrl || '-'}</div>
        <div>Scene loadingMapUrl: {sceneDebug.loadingMapUrl || '-'}</div>
        <div>Texturas: {sceneDebug.tileTexturesLoaded || 0} / {sceneDebug.tileTexturesRequired || 0}</div>
        <div>Falhas: {(sceneDebug.tileTexturesFailed || []).length}</div>
        <div>Markers: P {sceneDebug.playerMarkers || 0} | M {sceneDebug.mobMarkers || 0} | N {sceneDebug.npcMarkers || 0} | I {sceneDebug.groundItemMarkers || 0}</div>
        <div>Camera: {sceneDebug.camera ? `${sceneDebug.camera.x}, ${sceneDebug.camera.y} z${sceneDebug.camera.zoom}` : '-'}</div>
        <div>Erro: {sceneDebug.lastMapError || '-'}</div>
      </div>
    {/if}
    {#if $loadingTraceStore.length}
      <div class="loading-trace">
        {#each $loadingTraceStore.slice(0, 12) as line}
          <div>{line}</div>
        {/each}
      </div>
    {/if}
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
    width: min(980px, calc(100vw - 32px));
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

  .loading-debug {
    font-size: 0.72rem;
    color: rgba(214, 201, 173, 0.68);
    letter-spacing: 0.02em;
  }

  .loading-scene-debug,
  .loading-diagnosis,
  .loading-packets,
  .loading-trace {
    display: grid;
    gap: 4px;
    padding: 10px 12px;
    border: 1px solid rgba(201, 168, 106, 0.14);
    background: rgba(8, 10, 12, 0.62);
    color: rgba(224, 214, 188, 0.78);
    font-size: 0.72rem;
    line-height: 1.35;
  }

  .loading-packets {
    color: rgba(236, 225, 196, 0.86);
  }

  .loading-diagnosis {
    color: rgba(244, 232, 203, 0.92);
  }

  .loading-scene-debug {
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  }

  .loading-trace {
    max-height: none;
    overflow: visible;
    color: rgba(217, 207, 182, 0.72);
    white-space: normal;
    word-break: break-word;
  }
</style>
