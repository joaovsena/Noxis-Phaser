<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import { adminStore, sendAdminCommand, setInteractionDebugEnabled, setMobPeacefulEnabled, setPathDebugEnabled } from './stores/gameUi';

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
  <Window title="Admin" subtitle="Controle e depuracao" width="420px" on:close={() => dispatch('close')}>
    <section class="stack">
      <label class="field">
        <span>Comando</span>
        <div class="row">
          <input bind:value={command} type="text" placeholder="dungeon.debug" on:keydown={(event) => event.key === 'Enter' && submitCommand()} />
          <button type="button" on:click={submitCommand}>Enviar</button>
        </div>
      </label>

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

      {#if $adminStore.result?.message}
        <div class:danger={$adminStore.result?.ok === false} class="result">{$adminStore.result.message}</div>
      {/if}
    </section>
  </Window>
{/if}

<style>
  .stack {
    display: grid;
    gap: 14px;
  }

  .field,
  .toggle-grid {
    display: grid;
    gap: 8px;
  }

  .field span {
    font-family: 'Cinzel', serif;
    color: #f0dfbc;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }

  input,
  button,
  .result {
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
  }

  input {
    min-height: 40px;
    border: 1px solid rgba(201, 168, 106, 0.26);
    background: linear-gradient(180deg, rgba(8, 9, 10, 0.96), rgba(4, 6, 7, 0.98));
    color: #f2e7c6;
    padding: 0 12px;
  }

  button {
    min-height: 40px;
    border: 1px solid rgba(201, 168, 106, 0.3);
    background: linear-gradient(180deg, rgba(57, 41, 20, 0.96), rgba(27, 20, 11, 0.98));
    color: #f3e2bc;
    padding: 0 14px;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    color: rgba(233, 223, 200, 0.82);
    font-size: 0.82rem;
  }

  .result {
    padding: 10px 12px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(10, 10, 10, 0.68);
    color: rgba(233, 223, 200, 0.82);
  }

  .danger {
    border-color: rgba(205, 116, 100, 0.24);
    color: #efc1b5;
  }
</style>
