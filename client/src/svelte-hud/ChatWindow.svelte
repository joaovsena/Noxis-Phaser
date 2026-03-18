<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { tick } from 'svelte';
  import Window from './components/Window.svelte';
  import { chatStore, sendChatMessage } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();
  let scope: 'local' | 'map' | 'global' = 'local';
  let message = '';
  let logEl: HTMLDivElement | null = null;

  function formatTime(at: unknown) {
    const raw = Number(at || 0);
    if (!Number.isFinite(raw) || raw <= 0) return '--:--';
    return new Date(raw).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  $: visibleMessages = $chatStore.messages
    .filter((entry) => entry?.type === 'system' || String(entry?.scope || 'local') === scope)
    .slice(-60);

  $: if (logEl && visibleMessages) {
    tick().then(() => {
      if (!logEl) return;
      logEl.scrollTop = logEl.scrollHeight;
    });
  }

  function submitMessage() {
    const text = message.trim();
    if (!text) return;
    sendChatMessage(scope, text);
    message = '';
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    submitMessage();
  }
</script>

<Window title="Chat" subtitle="Canal da aventura" width="420px" on:close={() => dispatch('close')}>
  <div class="chat-scopes">
    {#each ['local', 'map', 'global'] as entry}
      <button class:active={scope === entry} type="button" on:click={() => scope = entry as typeof scope}>
        {entry}
      </button>
    {/each}
  </div>

  <div bind:this={logEl} class="chat-log">
    {#if visibleMessages.length}
      {#each visibleMessages as entry (entry.id || `${entry.at}-${entry.text}`)}
        <div class={`chat-line ${entry.type === 'system' ? 'system' : ''}`}>
          <span class="time">{formatTime(entry.at)}</span>
          <span class="tag">[{entry.type === 'system' ? 'system' : (entry.scope || 'local')}]</span>
          {#if entry.type === 'system'}
            <span>{entry.text}</span>
          {:else}
            <span class="author">{entry.from || 'Anon'}:</span>
            <span>{entry.text}</span>
          {/if}
        </div>
      {/each}
    {:else}
      <div class="empty-state">Nenhuma mensagem neste canal.</div>
    {/if}
  </div>

  <div class="chat-entry">
    <input bind:value={message} type="text" placeholder="Escreva e pressione Enter..." on:keydown={onKeydown} />
    <button type="button" on:click={submitMessage}>Enviar</button>
  </div>
</Window>

<style>
  .chat-scopes,
  .chat-entry {
    display: grid;
    gap: 10px;
  }

  .chat-scopes {
    grid-template-columns: repeat(3, 1fr);
    margin-bottom: 12px;
  }

  .chat-scopes button,
  .chat-entry button,
  .chat-entry input {
    min-height: 40px;
    border: 1px solid rgba(201, 168, 106, 0.28);
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
  }

  .chat-scopes button,
  .chat-entry button {
    background: linear-gradient(180deg, rgba(33, 24, 14, 0.96), rgba(12, 10, 8, 0.98));
    color: #ecdcb8;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .chat-scopes button.active {
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.14), 0 0 16px rgba(201, 168, 106, 0.14);
  }

  .chat-log {
    min-height: 190px;
    max-height: 190px;
    overflow-y: auto;
    display: grid;
    gap: 8px;
    padding: 12px;
    margin-bottom: 12px;
    clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px);
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: linear-gradient(180deg, rgba(8, 10, 12, 0.92), rgba(4, 5, 7, 0.98));
  }

  .chat-line {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    color: rgba(234, 224, 202, 0.8);
    font-size: 0.78rem;
    line-height: 1.35;
  }

  .chat-line.system {
    color: #eacb83;
  }

  .tag,
  .time,
  .author {
    color: #c9a86a;
  }

  .author {
    font-weight: 600;
  }

  .empty-state {
    color: rgba(214, 202, 177, 0.5);
    font-size: 0.8rem;
  }

  .chat-entry {
    grid-template-columns: minmax(0, 1fr) 104px;
  }

  .chat-entry input {
    background: linear-gradient(180deg, rgba(8, 9, 10, 0.96), rgba(4, 6, 7, 0.98));
    color: #f2e7c6;
    padding: 0 12px;
  }

  .chat-entry input::placeholder {
    color: rgba(194, 181, 157, 0.38);
  }

  .chat-entry input:focus {
    outline: none;
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.14), 0 0 16px rgba(201, 168, 106, 0.1);
  }
</style>
