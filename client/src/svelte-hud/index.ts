import { mount } from 'svelte';
import App from './App.svelte';
import { bindHudRuntime } from './stores/gameUi';
import type { GameStore } from '../game/state/GameStore';
import type { GameSocket } from '../game/net/GameSocket';

export function mountHudApp(options: {
  store: GameStore;
  socket: GameSocket;
  target?: HTMLElement | null;
  enableHud?: boolean;
}) {
  const target = options.target || document.getElementById('ui-container');
  if (!target) return null;
  const host = document.createElement('div');
  host.id = 'svelte-hud-root';
  target.appendChild(host);
  const disposeRuntime = bindHudRuntime(options.store, options.socket);
  const app = mount(App, {
    target: host,
    props: {
      enableHud: Boolean(options.enableHud)
    }
  });
  return {
    app,
    destroy() {
      disposeRuntime();
      host.remove();
    }
  };
}
