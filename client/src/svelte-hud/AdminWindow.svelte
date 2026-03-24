<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import StatusHud from './StatusHud.svelte';
  import { adminStore, hudScaleStore, resetHudScale, sendAdminCommand, setHudScale, setInteractionDebugEnabled, setMobPeacefulEnabled, setPathDebugEnabled } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();
  let command = '';

  function submitCommand() {
    const safeCommand = command.trim();
    if (!safeCommand) return;
    sendAdminCommand(safeCommand);
    command = '';
  }
</script>

{#if $adminStore.isAdmin}
  <Window title="Admin" subtitle="Ferramentas internas" width="clamp(460px, 42vw, 540px)" maxWidth="540px" maxBodyHeight="min(80vh, 840px)" on:close={() => dispatch('close')}>
    <div class="admin-shell">
      <section class="hud-section compact">
        <div class="section-title">Estado da sessao</div>
        <StatusHud />
      </section>

      <section class="hud-section compact">
        <div class="section-title">Console</div>
        <div class="command-row">
          <input bind:value={command} class="hud-input" type="text" placeholder="dungeon.debug" on:keydown={(event) => event.key === 'Enter' && submitCommand()} />
          <button class="hud-btn" type="button" on:click={submitCommand}>Enviar</button>
        </div>
      </section>

      <section class="hud-section compact">
        <div class="section-title">Ferramentas</div>
        <div class="toggle-grid">
          <label class="toggle">
            <input type="checkbox" checked={$adminStore.pathDebugEnabled} on:change={(event) => setPathDebugEnabled((event.currentTarget as HTMLInputElement).checked)} />
            <span>Debug de caminho</span>
          </label>
          <label class="toggle">
            <input type="checkbox" checked={$adminStore.interactionDebugEnabled} on:change={(event) => setInteractionDebugEnabled((event.currentTarget as HTMLInputElement).checked)} />
            <span>Debug de interacao</span>
          </label>
          <label class="toggle">
            <input type="checkbox" checked={$adminStore.mobPeacefulEnabled} on:change={(event) => setMobPeacefulEnabled((event.currentTarget as HTMLInputElement).checked)} />
            <span>Mobs pacificos</span>
          </label>
        </div>
      </section>

      <section class="hud-section compact">
        <div class="section-title">Escala da HUD</div>
        <div class="scale-row">
          <input type="range" min="70" max="140" step="1" value={Math.round($hudScaleStore * 100)} on:input={(event) => setHudScale(Number((event.currentTarget as HTMLInputElement).value) / 100)} />
          <span>{Math.round($hudScaleStore * 100)}%</span>
          <button class="hud-btn mini ghost" type="button" on:click={resetHudScale}>Reset</button>
        </div>
      </section>

      {#if $adminStore.result?.message}
        <section class={`hud-section compact ${$adminStore.result?.ok === false ? 'danger' : ''}`}>
          <div class="section-title">Resultado</div>
          <div class="result">{$adminStore.result.message}</div>
        </section>
      {/if}
    </div>
  </Window>
{/if}

<style>
  .admin-shell {
    display: grid;
    gap: 12px;
  }

  .compact {
    padding: 12px 14px;
  }

  .section-title {
    margin-bottom: 10px;
    color: var(--hud-gold);
    font-family: var(--hud-font-display);
    font-size: 0.74rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .command-row,
  .scale-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
  }

  .scale-row {
    grid-template-columns: minmax(0, 1fr) auto auto;
  }

  .toggle-grid {
    display: grid;
    gap: 8px;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    color: rgba(233, 223, 200, 0.82);
    font-size: 0.82rem;
  }

  .result {
    color: rgba(233, 223, 200, 0.82);
  }

  .danger {
    border-color: rgba(205, 116, 100, 0.24);
  }

  @media (max-width: 640px) {
    .command-row,
    .scale-row {
      grid-template-columns: 1fr;
    }
  }
</style>
