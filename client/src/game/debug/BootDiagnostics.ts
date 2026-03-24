type BootLogLevel = 'info' | 'warn' | 'error';

type BootLogEntry = {
  seq: number;
  at: string;
  relMs: number;
  scope: string;
  event: string;
  message: string;
  level: BootLogLevel;
};

type BootCounters = {
  wsMessages: number;
  worldStateMessages: number;
  storeUpdates: number;
  slowStoreUpdates: number;
  sceneSyncs: number;
  slowSceneSyncs: number;
  fetches: number;
  slowFetches: number;
  errors: number;
};

type BootSummary = {
  attempt: number;
  stage: string;
  connectionPhase: string;
  socketConnected: boolean;
  runtimeReady: boolean;
  playerId: number | null;
  worldStaticReady: boolean;
  worldStateReady: boolean;
  inventoryReady: boolean;
  resolvedWorldReady: boolean;
  localPlayerReady: boolean;
  currentMapId: string;
  lastPacket: string;
  lastRequest: string;
  lastError: string;
  lastSceneReason: string;
  sceneMapUrl: string;
  sceneLoadingMapUrl: string;
  scenePlayers: number;
  sceneMobs: number;
  sceneNpcs: number;
  sceneGroundItems: number;
};

type BootSnapshot = {
  savedAt: string;
  startedAt: string;
  uptimeMs: number;
  heartbeatGapMs: number;
  counters: BootCounters;
  summary: BootSummary;
  logs: BootLogEntry[];
};

const STORAGE_KEY = 'noxis.boot.diagnostics.v1';
const MAX_LOGS = 160;
const MAX_VISIBLE_LOGS = 14;
const PERSIST_INTERVAL_MS = 1000;
const HEARTBEAT_INTERVAL_MS = 500;
const FREEZE_GAP_MS = 1500;

function esc(value: unknown) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

class BootDiagnostics {
  private installed = false;
  private fetchPatched = false;
  private overlayMounted = false;
  private overlayRoot: HTMLDivElement | null = null;
  private summaryEl: HTMLDivElement | null = null;
  private logEl: HTMLDivElement | null = null;
  private logs: BootLogEntry[] = [];
  private counters: BootCounters = this.createCounters();
  private summary: BootSummary = this.createSummary();
  private attempt = 0;
  private seq = 0;
  private startedAtMs = performance.now();
  private startedAtIso = new Date().toISOString();
  private lastPersistAt = 0;
  private persistTimer = 0;
  private renderQueued = false;
  private heartbeatTimer = 0;
  private lastHeartbeatAt = performance.now();
  private lastHeartbeatGapMs = 0;
  private lastSceneSignature = '';
  private lastSceneReason = '';
  private lastRuntimeSignature = '';
  private lastPacketSignature = '';
  private lastRequestSignature = '';
  private lastStorePhase = '';

  install() {
    if (this.installed) return this;
    this.installed = true;
    this.mountOverlay();
    this.patchFetch();
    window.addEventListener('error', (event) => {
      this.error('window', 'error', event.error instanceof Error ? event.error.message : String(event.message || 'window error'));
    });
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason || 'unhandled rejection');
      this.error('window', 'unhandledrejection', reason);
    });
    document.addEventListener('visibilitychange', () => {
      this.log('window', 'visibility', `document.${document.visibilityState}`);
    });
    this.heartbeatTimer = window.setInterval(() => {
      const now = performance.now();
      const gap = now - this.lastHeartbeatAt;
      this.lastHeartbeatAt = now;
      this.lastHeartbeatGapMs = Math.max(0, Math.round(gap));
      if (gap >= FREEZE_GAP_MS) {
        this.warn('perf', 'heartbeat-gap', `Gap detectado na main thread: ${Math.round(gap)}ms.`);
      } else {
        this.scheduleRender();
      }
    }, HEARTBEAT_INTERVAL_MS);
    this.expose();
    this.log('boot', 'install', 'Monitor de boot instalado.');
    return this;
  }

  reset(label = 'runtime:init') {
    this.attempt += 1;
    this.seq = 0;
    this.logs = [];
    this.counters = this.createCounters();
    this.summary = this.createSummary();
    this.summary.attempt = this.attempt;
    this.summary.stage = label;
    this.startedAtMs = performance.now();
    this.startedAtIso = new Date().toISOString();
    this.lastHeartbeatAt = performance.now();
    this.lastHeartbeatGapMs = 0;
    this.lastSceneSignature = '';
    this.lastSceneReason = '';
    this.lastRuntimeSignature = '';
    this.lastPacketSignature = '';
    this.lastRequestSignature = '';
    this.lastStorePhase = '';
    this.log('boot', 'reset', `Nova tentativa de boot: ${label}.`);
    this.persist(true);
    return this;
  }

  stage(stage: string, message: string, level: BootLogLevel = 'info') {
    this.summary.stage = stage;
    this.log('stage', stage, message, level);
  }

  setConnectionPhase(phase: string) {
    const safePhase = String(phase || 'unknown');
    if (safePhase === this.summary.connectionPhase) return;
    this.summary.connectionPhase = safePhase;
    this.log('store', 'phase', `Fase alterada para ${safePhase}.`);
  }

  updateStoreState(state: any) {
    const players = state?.resolvedWorld?.players || {};
    const localPlayer = state?.playerId ? players[String(state.playerId)] || null : null;
    const nextSignature = [
      state?.connectionPhase || '-',
      state?.socketConnected ? 'ws1' : 'ws0',
      state?.playerId || 0,
      state?.worldStatic ? 'static1' : 'static0',
      state?.worldState ? 'state1' : 'state0',
      state?.inventoryState ? 'inv1' : 'inv0',
      state?.resolvedWorld ? 'resolved1' : 'resolved0',
      localPlayer ? 'player1' : 'player0',
      state?.resolvedWorld?.mapId || '-'
    ].join('|');
    this.summary.connectionPhase = String(state?.connectionPhase || 'unknown');
    this.summary.socketConnected = Boolean(state?.socketConnected);
    this.summary.runtimeReady = Boolean(
      state?.connectionPhase === 'in_game'
      && state?.playerId
      && state?.worldState
      && state?.inventoryState
      && state?.resolvedWorld
    );
    this.summary.playerId = Number.isFinite(Number(state?.playerId)) ? Number(state.playerId) : null;
    this.summary.worldStaticReady = Boolean(state?.worldStatic);
    this.summary.worldStateReady = Boolean(state?.worldState);
    this.summary.inventoryReady = Boolean(state?.inventoryState);
    this.summary.resolvedWorldReady = Boolean(state?.resolvedWorld);
    this.summary.localPlayerReady = Boolean(localPlayer);
    this.summary.currentMapId = String(state?.resolvedWorld?.mapId || state?.worldStatic?.mapId || '-');
    if (this.lastRuntimeSignature !== nextSignature) {
      this.lastRuntimeSignature = nextSignature;
      this.log(
        'store',
        'readiness',
        `Runtime ${this.summary.connectionPhase} | ws ${this.summary.socketConnected ? 'on' : 'off'} | static ${this.summary.worldStaticReady ? 'ok' : 'no'} | state ${this.summary.worldStateReady ? 'ok' : 'no'} | inv ${this.summary.inventoryReady ? 'ok' : 'no'} | resolved ${this.summary.resolvedWorldReady ? 'ok' : 'no'} | player ${this.summary.localPlayerReady ? 'ok' : 'no'} | map ${this.summary.currentMapId}.`
      );
    }
    if (this.lastStorePhase !== this.summary.connectionPhase) {
      this.lastStorePhase = this.summary.connectionPhase;
      if (this.summary.connectionPhase === 'in_game' && this.summary.worldStateReady) {
        this.summary.stage = 'store:in_game';
      }
    }
    this.scheduleRender();
    this.schedulePersist();
  }

  recordPacket(type: string, detail?: { size?: number; players?: number; mobs?: number; parseMs?: number; handleMs?: number }) {
    const safeType = String(type || 'unknown');
    this.counters.wsMessages += 1;
    if (safeType === 'world_state') this.counters.worldStateMessages += 1;
    const message = [
      safeType,
      Number.isFinite(Number(detail?.size)) ? `${Math.round(Number(detail?.size))} chars` : '',
      Number.isFinite(Number(detail?.players)) ? `players ${Math.round(Number(detail?.players))}` : '',
      Number.isFinite(Number(detail?.mobs)) ? `mobs ${Math.round(Number(detail?.mobs))}` : ''
    ].filter(Boolean).join(' | ');
    this.summary.lastPacket = message || safeType;
    const signature = `${safeType}|${detail?.size || 0}|${detail?.players || 0}|${detail?.mobs || 0}`;
    if (this.lastPacketSignature !== signature && safeType !== 'world_state' && safeType !== 'pong') {
      this.lastPacketSignature = signature;
      this.log('socket', 'packet', `Pacote ${message || safeType}.`);
    }
    const parseMs = Number(detail?.parseMs || 0);
    const handleMs = Number(detail?.handleMs || 0);
    if (parseMs >= 18 || handleMs >= 18) {
      this.warn('socket', 'slow-packet', `Pacote ${safeType} lento | parse ${parseMs.toFixed(2)}ms | handler ${handleMs.toFixed(2)}ms.`);
    }
    this.scheduleRender();
    this.schedulePersist();
  }

  recordFetch(url: string, status: string, durationMs: number) {
    const safeUrl = String(url || '-');
    const safeStatus = String(status || '-');
    this.counters.fetches += 1;
    if (durationMs >= 250) this.counters.slowFetches += 1;
    this.summary.lastRequest = `${safeStatus} ${safeUrl} em ${Math.round(durationMs)}ms`;
    const signature = `${safeStatus}|${safeUrl}`;
    if (this.lastRequestSignature !== signature || durationMs >= 250) {
      this.lastRequestSignature = signature;
      const level = durationMs >= 250 ? 'warn' : 'info';
      this.log('fetch', 'request', `Fetch ${safeStatus} ${safeUrl} em ${Math.round(durationMs)}ms.`, level);
    }
  }

  recordStoreUpdate(keys: string[], durationMs: number, state: any) {
    this.counters.storeUpdates += 1;
    this.updateStoreState(state);
    if (durationMs >= 10) {
      this.counters.slowStoreUpdates += 1;
      this.warn('store', 'slow-update', `GameStore.update lento (${durationMs.toFixed(2)}ms) [${keys.join(', ')}].`);
    }
  }

  recordScene(reason: string, detail?: any) {
    const safeReason = String(reason || '-');
    this.summary.lastSceneReason = safeReason;
    this.summary.sceneMapUrl = String(detail?.mapUrl || detail?.mapDocument?.url || detail?.mapUrl || '-');
    this.summary.sceneLoadingMapUrl = String(detail?.loadingMapUrl || '-');
    this.summary.scenePlayers = Number(detail?.playerMarkers || 0);
    this.summary.sceneMobs = Number(detail?.mobMarkers || 0);
    this.summary.sceneNpcs = Number(detail?.npcMarkers || 0);
    this.summary.sceneGroundItems = Number(detail?.groundItemMarkers || 0);
    const signature = [
      safeReason,
      this.summary.sceneMapUrl,
      this.summary.sceneLoadingMapUrl,
      this.summary.scenePlayers,
      this.summary.sceneMobs,
      this.summary.sceneNpcs,
      this.summary.sceneGroundItems,
      detail?.lastMapError || '-'
    ].join('|');
    if (this.lastSceneSignature !== signature || this.lastSceneReason !== safeReason) {
      this.lastSceneSignature = signature;
      this.lastSceneReason = safeReason;
      const suffix = detail?.lastMapError ? ` | erro ${detail.lastMapError}` : '';
      this.log('scene', safeReason, `WorldScene ${safeReason} | map ${this.summary.sceneMapUrl} | loading ${this.summary.sceneLoadingMapUrl}${suffix}.`);
    }
    this.scheduleRender();
    this.schedulePersist();
  }

  recordSceneSync(durationMs: number, detail: { players: number; mobs: number; npcs: number; groundItems: number }) {
    this.counters.sceneSyncs += 1;
    this.summary.scenePlayers = Number(detail.players || 0);
    this.summary.sceneMobs = Number(detail.mobs || 0);
    this.summary.sceneNpcs = Number(detail.npcs || 0);
    this.summary.sceneGroundItems = Number(detail.groundItems || 0);
    if (durationMs >= 18) {
      this.counters.slowSceneSyncs += 1;
      this.warn(
        'scene',
        'slow-sync',
        `WorldScene.syncFromStore lento (${durationMs.toFixed(2)}ms) | players ${detail.players} | mobs ${detail.mobs} | npcs ${detail.npcs} | itens ${detail.groundItems}.`
      );
    } else {
      this.scheduleRender();
    }
  }

  log(scope: string, event: string, message: string, level: BootLogLevel = 'info') {
    const entry: BootLogEntry = {
      seq: ++this.seq,
      at: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      relMs: Math.max(0, Math.round(performance.now() - this.startedAtMs)),
      scope: String(scope || 'app'),
      event: String(event || 'event'),
      message: String(message || ''),
      level
    };
    if (level === 'error') this.counters.errors += 1;
    this.logs = [entry, ...this.logs].slice(0, MAX_LOGS);
    this.scheduleRender();
    if (scope === 'stage' || level === 'error') {
      this.persist(true);
      return;
    }
    this.schedulePersist(level === 'error');
  }

  warn(scope: string, event: string, message: string) {
    this.log(scope, event, message, 'warn');
  }

  error(scope: string, event: string, message: string) {
    this.summary.lastError = String(message || 'erro');
    this.log(scope, event, message, 'error');
  }

  getSnapshot(): BootSnapshot {
    return {
      savedAt: new Date().toISOString(),
      startedAt: this.startedAtIso,
      uptimeMs: Math.max(0, Math.round(performance.now() - this.startedAtMs)),
      heartbeatGapMs: this.lastHeartbeatGapMs,
      counters: { ...this.counters },
      summary: { ...this.summary },
      logs: [...this.logs]
    };
  }

  clearSnapshot() {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // noop
    }
  }

  private expose() {
    (window as any).__NOXIS_BOOT_DIAG__ = {
      getSnapshot: () => this.getSnapshot(),
      clearSnapshot: () => this.clearSnapshot()
    };
  }

  private patchFetch() {
    if (this.fetchPatched || typeof window.fetch !== 'function') return;
    this.fetchPatched = true;
    const nativeFetch = window.fetch.bind(window);
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.toString()
          : 'url' in input
            ? String(input.url)
            : String(input);
      const shouldTrack = /(\.tmj|\.tsx|\.xml|\/maps\/|map)/i.test(url);
      const startedAt = performance.now();
      try {
        const response = await nativeFetch(input, init);
        if (shouldTrack) {
          this.recordFetch(url, `${response.status}`, performance.now() - startedAt);
        }
        return response;
      } catch (error) {
        if (shouldTrack) {
          this.error('fetch', 'request-failed', `${url} falhou: ${error instanceof Error ? error.message : String(error)}`);
        }
        throw error;
      }
    };
  }

  private schedulePersist(force = false) {
    if (force) {
      this.persist(true);
      return;
    }
    const now = Date.now();
    if (now - this.lastPersistAt >= PERSIST_INTERVAL_MS) {
      this.persist(true);
      return;
    }
    if (this.persistTimer) return;
    this.persistTimer = window.setTimeout(() => {
      this.persistTimer = 0;
      this.persist(true);
    }, Math.max(0, PERSIST_INTERVAL_MS - (now - this.lastPersistAt)));
  }

  private persist(force = false) {
    if (!force) return;
    this.lastPersistAt = Date.now();
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.getSnapshot()));
    } catch {
      // noop
    }
  }

  private scheduleRender() {
    if (this.renderQueued) return;
    this.renderQueued = true;
    requestAnimationFrame(() => {
      this.renderQueued = false;
      this.render();
    });
  }

  private mountOverlay() {
    if (this.overlayMounted) return;
    this.overlayMounted = true;
    const root = document.createElement('div');
    root.id = 'noxis-boot-diagnostics';
    root.style.position = 'fixed';
    root.style.right = '12px';
    root.style.bottom = '12px';
    root.style.zIndex = '2147483647';
    root.style.width = 'min(340px, calc(100vw - 24px))';
    root.style.maxHeight = '34vh';
    root.style.overflow = 'hidden';
    root.style.pointerEvents = 'none';
    root.style.fontFamily = 'Consolas, Menlo, Monaco, monospace';
    root.style.fontSize = '11px';
    root.style.lineHeight = '1.35';
    root.style.color = '#f1e5c6';
    root.style.background = 'rgba(7, 9, 12, 0.9)';
    root.style.border = '1px solid rgba(201, 168, 106, 0.28)';
    root.style.borderRadius = '10px';
    root.style.boxShadow = '0 14px 34px rgba(0, 0, 0, 0.45)';
    root.style.backdropFilter = 'blur(10px)';
    root.style.padding = '10px 12px';
    const summary = document.createElement('div');
    const logs = document.createElement('div');
    logs.style.marginTop = '8px';
    logs.style.maxHeight = '22vh';
    logs.style.overflow = 'hidden';
    root.appendChild(summary);
    root.appendChild(logs);
    document.body.appendChild(root);
    this.overlayRoot = root;
    this.summaryEl = summary;
    this.logEl = logs;
    this.render();
  }

  private render() {
    if (!this.overlayRoot || !this.summaryEl || !this.logEl) return;
    const snapshot = this.getSnapshot();
    const forceVisible = typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('diag_boot_overlay') === '1';
    const shouldShow = forceVisible || !snapshot.summary.runtimeReady || Boolean(snapshot.summary.lastError);
    this.overlayRoot.style.display = shouldShow ? 'block' : 'none';
    if (!shouldShow) return;
    const headerColor = snapshot.summary.lastError ? '#ffb0a8' : '#f4dfb0';
    this.summaryEl.innerHTML = [
      `<div style="color:${headerColor};font-weight:700;margin-bottom:4px;">NOXIS BOOT DIAG</div>`,
      `<div>attempt=${snapshot.summary.attempt} uptime=${snapshot.uptimeMs}ms gap=${snapshot.heartbeatGapMs}ms stage=${esc(snapshot.summary.stage)}</div>`,
      `<div>phase=${esc(snapshot.summary.connectionPhase)} ws=${snapshot.summary.socketConnected ? 'on' : 'off'} runtimeReady=${snapshot.summary.runtimeReady ? 'yes' : 'no'} player=${snapshot.summary.localPlayerReady ? 'ok' : 'no'}</div>`,
      `<div>static=${snapshot.summary.worldStaticReady ? 'ok' : 'no'} state=${snapshot.summary.worldStateReady ? 'ok' : 'no'} inv=${snapshot.summary.inventoryReady ? 'ok' : 'no'} resolved=${snapshot.summary.resolvedWorldReady ? 'ok' : 'no'} map=${esc(snapshot.summary.currentMapId)}</div>`,
      `<div>packet=${esc(snapshot.summary.lastPacket || '-')}</div>`,
      `<div>request=${esc(snapshot.summary.lastRequest || '-')}</div>`,
      `<div>scene=${esc(snapshot.summary.lastSceneReason || '-')} mapUrl=${esc(snapshot.summary.sceneMapUrl || '-')} loading=${esc(snapshot.summary.sceneLoadingMapUrl || '-')}</div>`,
      `<div>sceneEntities=P${snapshot.summary.scenePlayers} M${snapshot.summary.sceneMobs} N${snapshot.summary.sceneNpcs} I${snapshot.summary.sceneGroundItems} | wsMsgs=${snapshot.counters.wsMessages} worldState=${snapshot.counters.worldStateMessages} store=${snapshot.counters.storeUpdates}/${snapshot.counters.slowStoreUpdates} sync=${snapshot.counters.sceneSyncs}/${snapshot.counters.slowSceneSyncs}</div>`,
      snapshot.summary.lastError ? `<div style="color:#ffb0a8;">error=${esc(snapshot.summary.lastError)}</div>` : ''
    ].join('');
    this.logEl.innerHTML = snapshot.logs
      .slice(0, MAX_VISIBLE_LOGS)
      .map((entry) => {
        const color = entry.level === 'error' ? '#ffb0a8' : entry.level === 'warn' ? '#ffd27f' : '#d7ccb0';
        return `<div style="color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(entry.at)} +${entry.relMs}ms [${esc(entry.scope)}:${esc(entry.event)}] ${esc(entry.message)}</div>`;
      })
      .join('');
  }

  private createCounters(): BootCounters {
    return {
      wsMessages: 0,
      worldStateMessages: 0,
      storeUpdates: 0,
      slowStoreUpdates: 0,
      sceneSyncs: 0,
      slowSceneSyncs: 0,
      fetches: 0,
      slowFetches: 0,
      errors: 0
    };
  }

  private createSummary(): BootSummary {
    return {
      attempt: this.attempt,
      stage: 'idle',
      connectionPhase: 'connecting',
      socketConnected: false,
      runtimeReady: false,
      playerId: null,
      worldStaticReady: false,
      worldStateReady: false,
      inventoryReady: false,
      resolvedWorldReady: false,
      localPlayerReady: false,
      currentMapId: '-',
      lastPacket: '',
      lastRequest: '',
      lastError: '',
      lastSceneReason: '',
      sceneMapUrl: '',
      sceneLoadingMapUrl: '',
      scenePlayers: 0,
      sceneMobs: 0,
      sceneNpcs: 0,
      sceneGroundItems: 0
    };
  }
}

export const bootDiagnostics = new BootDiagnostics();
