import Phaser from 'phaser';
import './style.css';
import { BootScene } from './game/scenes/BootScene';
import { WorldScene } from './game/scenes/WorldScene';
import { GameStore } from './game/state/GameStore';
import { GameSocket } from './game/net/GameSocket';
import { mountHudApp } from './svelte-hud';
import { clearPersistedLoadingDebugSnapshot, getPersistedLoadingDebugSnapshot, traceLoadingStep } from './svelte-hud/stores/gameUi';

const store = new GameStore();
const socket = new GameSocket(store);
const gameRoot = document.getElementById('game-root');
const uiRoot = document.getElementById('ui-root');
let game: Phaser.Game | null = null;

function isWorldRuntimeReady() {
  const state = store.getState();
  return state.connectionPhase === 'in_game'
    && Boolean(state.playerId)
    && Boolean(state.worldState)
    && Boolean(state.inventoryState)
    && Boolean(state.resolvedWorld);
}

function syncPhaserKeyboardCapture() {
  const keyboard = game?.input.keyboard;
  if (!keyboard) return;
  const inGame = isWorldRuntimeReady();
  keyboard.enabled = inGame;
  if (inGame) keyboard.enableGlobalCapture();
  else keyboard.disableGlobalCapture();
}

function createGame() {
  if (game) return game;
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game-root',
    backgroundColor: '#08111b',
    fps: { target: 60, min: 30, smoothStep: false },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: innerWidth,
      height: innerHeight
    },
    scene: [new BootScene(), new WorldScene({ store, socket })]
  });
  game.input.keyboard?.disableGlobalCapture();
  if (game.input.keyboard) game.input.keyboard.enabled = false;
  syncPhaserKeyboardCapture();
  return game;
}

function destroyGame() {
  if (!game) return;
  game.destroy(true);
  game = null;
}

function syncRuntimeShell() {
  const startedAt = performance.now();
  const state = store.getState();
  traceLoadingStep(
    `main.syncRuntimeShell start | phase ${state.connectionPhase} | worldStatic ${state.worldStatic ? 'ok' : 'no'} | worldState ${state.worldState ? 'ok' : 'no'} | inventory ${state.inventoryState ? 'ok' : 'no'} | ready ${isWorldRuntimeReady() ? 'yes' : 'no'}.`
  );
  const inGame = isWorldRuntimeReady();
  if (gameRoot) {
    gameRoot.setAttribute('aria-hidden', inGame ? 'false' : 'true');
  }
  if (inGame) {
    createGame();
  } else {
    destroyGame();
  }
  syncPhaserKeyboardCapture();
  const elapsed = Math.max(0, Math.round((performance.now() - startedAt) * 100) / 100);
  traceLoadingStep(`main.syncRuntimeShell done em ${elapsed}ms | phase ${state.connectionPhase}.`);
}

function bindSvelteHudBridge() {
  window.addEventListener('noxis:svelte-minimap-move', (event) => {
    const detail = (event as CustomEvent<{ x: number; y: number }>).detail;
    if (!detail) return;
    socket.send({
      type: 'move',
      reqId: Date.now(),
      x: Number(detail.x || 0),
      y: Number(detail.y || 0)
    });
  });

  window.addEventListener('noxis:svelte-worldmap-move', (event) => {
    const detail = (event as CustomEvent<{ x: number; y: number }>).detail;
    if (!detail) return;
    socket.send({
      type: 'move',
      reqId: Date.now(),
      x: Number(detail.x || 0),
      y: Number(detail.y || 0)
    });
  });
}

bindSvelteHudBridge();
syncRuntimeShell();
store.addEventListener('change', syncRuntimeShell as EventListener);

const svelteHudRuntime = mountHudApp({
  store,
  socket,
  target: uiRoot,
  enableHud: true
});

socket.connect();

if (!svelteHudRuntime && uiRoot) {
  uiRoot.classList.remove('hidden');
  uiRoot.setAttribute('aria-hidden', 'false');
  uiRoot.innerHTML = '<div style="position:fixed;inset:0;display:grid;place-items:center;padding:24px;background:#05080bcc;color:#f4e7c6;font:600 16px Segoe UI,Tahoma,sans-serif;z-index:1000">Falha ao montar a interface Svelte.</div>';
}

(window as any).__NOXIS_DEBUG__ = {
  store,
  socket,
  getGame: () => game,
  getState: () => store.getState(),
  getLoadingDebug: () => getPersistedLoadingDebugSnapshot(),
  clearLoadingDebug: () => clearPersistedLoadingDebugSnapshot(),
  downloadLoadingDebug: () => {
    const snapshot = getPersistedLoadingDebugSnapshot();
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `noxis-loading-debug-${Date.now()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  getSceneDebug: () => {
    const worldScene = game?.scene?.getScene?.('world') as (WorldScene & { getDebugState?: () => unknown }) | undefined;
    return typeof worldScene?.getDebugState === 'function' ? worldScene.getDebugState() : null;
  }
};

window.addEventListener('beforeunload', () => {
  store.removeEventListener('change', syncRuntimeShell as EventListener);
  svelteHudRuntime?.destroy();
  destroyGame();
});
