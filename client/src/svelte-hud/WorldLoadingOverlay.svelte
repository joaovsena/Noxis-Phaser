<script lang="ts">
  import ProgressBar from './components/ProgressBar.svelte';
  import { adminStore, appStore, loadingPacketStore, loadingStore, worldStore } from './stores/gameUi';

  $: progressPercent = Math.max(0, Math.min(100, Math.round($loadingStore.progress * 100)));
  $: packetRows = [
    { label: 'ws_open', value: $loadingPacketStore.wsOpen || 'aguardando' },
    { label: 'announced_packet', value: $loadingPacketStore.announcedPacket || 'aguardando' },
    { label: 'auth_success', value: $loadingPacketStore.authSuccess || 'aguardando' },
    { label: 'world_static', value: $loadingPacketStore.worldStatic || 'aguardando' },
    { label: 'world_state', value: $loadingPacketStore.worldState || 'aguardando' },
    { label: 'inventory_state', value: $loadingPacketStore.inventoryState || 'aguardando' },
    { label: 'ultimo pacote', value: $loadingPacketStore.lastPacket || 'nenhum' },
    { label: 'ws_error', value: $loadingPacketStore.wsError || 'nenhum' },
    { label: 'ws_close', value: $loadingPacketStore.wsClose || 'nenhum' }
  ];
</script>

<div class="loading-shell" aria-live="polite" aria-busy="true">
  <div class="loading-card">
    <div class="loading-kicker">Sincronizando</div>
    <div class="loading-title">{$loadingStore.title}</div>
    <div class="loading-detail">{$loadingStore.detail}</div>
    <ProgressBar value={progressPercent} max={100} label={`${progressPercent}%`} tone="xp" />

    <div class="loading-debug">
      Fase {$appStore.connectionPhase} | WS {$adminStore.socketConnected ? 'on' : 'off'} | mapa {$worldStore.mapCode}/{$worldStore.mapId} | player {$worldStore.player ? 'ok' : 'pendente'}
    </div>

    <div class="loading-note">
      Logs detalhados agora ficam no painel fixo <strong>NOXIS BOOT DIAG</strong> no canto inferior direito.
      Essa tela foi reduzida de proposito para nao competir com o bootstrap do cliente.
    </div>

    <div class="loading-packets">
      {#each packetRows as row}
        <div><strong>{row.label}</strong>: {row.value}</div>
      {/each}
    </div>
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
    width: min(760px, calc(100vw - 32px));
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

  .loading-note,
  .loading-packets {
    display: grid;
    gap: 4px;
    padding: 10px 12px;
    border: 1px solid rgba(201, 168, 106, 0.14);
    background: rgba(8, 10, 12, 0.62);
    color: rgba(224, 214, 188, 0.82);
    font-size: 0.74rem;
    line-height: 1.45;
  }

  .loading-packets {
    color: rgba(236, 225, 196, 0.86);
  }
</style>
