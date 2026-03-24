<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { bootDiagnostics } from '../game/debug/BootDiagnostics';
  import { chatStore, sendChatMessage } from './stores/gameUi';

  type ChatScope = 'local' | 'map' | 'global';
  type ChatEntry = {
    id?: string | number;
    at?: number;
    from?: string;
    scope?: ChatScope | string;
    text?: string;
    type?: string;
  };

  const dispatch = createEventDispatcher<{ close: void }>();
  const scopes: Array<{ id: ChatScope; label: string }> = [
    { id: 'local', label: 'Local' },
    { id: 'map', label: 'Mapa' },
    { id: 'global', label: 'Global' }
  ];

  let scope: ChatScope = 'local';
  let message = '';
  let logEl: HTMLDivElement | null = null;
  let visibleMessages: ChatEntry[] = [];
  let scrollRaf = 0;
  let lastScrollSignature = '';

  function formatTime(at: unknown) {
    const raw = Number(at || 0);
    if (!Number.isFinite(raw) || raw <= 0) return '--:--';
    return new Date(raw).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  }

  function scheduleScroll() {
    if (typeof window === 'undefined') return;
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      if (!logEl) return;
      logEl.scrollTop = logEl.scrollHeight;
    });
  }

  function submitMessage() {
    const text = message.trim();
    if (!text) return;
    sendChatMessage(scope, text);
    message = '';
    scheduleScroll();
  }

  $: visibleMessages = $chatStore.messages
    .filter((entry) => entry?.type === 'system' || String(entry?.scope || 'local') === scope)
    .slice(-60) as ChatEntry[];

  $: {
    const lastEntry = visibleMessages[visibleMessages.length - 1];
    const nextSignature = `${scope}|${visibleMessages.length}|${String(lastEntry?.id || lastEntry?.at || lastEntry?.text || '-')}`;
    if (logEl && nextSignature !== lastScrollSignature) {
      lastScrollSignature = nextSignature;
      scheduleScroll();
    }
  }

  onMount(() => {
    bootDiagnostics.log('hud', 'chat-mounted', 'ChatWindow montado.');
  });

  onDestroy(() => {
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
  });
</script>

<section class="chat-shell">
  <div class="chat-header" data-window-drag-handle="true">
    <div class="title-block">
      <div class="eyebrow">Comunicacao</div>
      <h2>Chat</h2>
    </div>
    <button class="close-btn" type="button" aria-label="Fechar chat" on:click={() => dispatch('close')}>x</button>
  </div>

  <div class="chat-scopes" role="tablist" aria-label="Escopo do chat">
    {#each scopes as entry}
      <button
        class:active={scope === entry.id}
        class="scope-btn"
        type="button"
        on:click={() => scope = entry.id}
      >
        {entry.label}
      </button>
    {/each}
  </div>

  <div bind:this={logEl} class="chat-log" role="log" aria-live="polite">
    {#if visibleMessages.length}
      {#each visibleMessages as entry (entry.id || `${entry.at}-${entry.text}`)}
        <div class={`chat-line ${entry.type === 'system' ? 'system' : ''}`}>
          <span class="time">{formatTime(entry.at)}</span>
          <span class="tag">[{entry.type === 'system' ? 'sistema' : (entry.scope || 'local')}]</span>
          {#if entry.type === 'system'}
            <span class="text">{entry.text}</span>
          {:else}
            <span class="author">{entry.from || 'Anon'}:</span>
            <span class="text">{entry.text}</span>
          {/if}
        </div>
      {/each}
    {:else}
      <div class="empty-state">Nenhuma mensagem neste canal.</div>
    {/if}
  </div>

  <form class="chat-entry" on:submit|preventDefault={submitMessage}>
    <input
      bind:value={message}
      type="text"
      maxlength="180"
      autocomplete="off"
      spellcheck="false"
      placeholder="Escreva e pressione Enter..."
    />
    <button class="submit-btn" type="submit">Enviar</button>
  </form>
</section>

<style>
  .chat-shell {
    pointer-events: auto;
    width: min(420px, calc(100vw - 24px));
    display: grid;
    gap: 10px;
    padding: 14px;
    position: relative;
    overflow: hidden;
    contain: layout paint;
    border: 1px solid rgba(201, 168, 106, 0.3);
    border-radius: 12px;
    background:
      radial-gradient(circle at top, rgba(201, 168, 106, 0.08), transparent 32%),
      linear-gradient(180deg, rgba(16, 13, 11, 0.97), rgba(8, 8, 8, 0.98));
    box-shadow:
      0 18px 34px rgba(0, 0, 0, 0.28),
      inset 0 0 0 1px rgba(255, 239, 206, 0.03);
  }

  .chat-shell::before {
    content: '';
    position: absolute;
    inset: 8px;
    border: 1px solid rgba(201, 168, 106, 0.08);
    border-radius: 8px;
    pointer-events: none;
  }

  .chat-header,
  .chat-scopes,
  .chat-log,
  .chat-entry {
    position: relative;
    z-index: 1;
  }

  .chat-header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 12px;
    cursor: grab;
  }

  .chat-header:active {
    cursor: grabbing;
  }

  .title-block {
    display: grid;
    gap: 4px;
  }

  .eyebrow {
    font-family: 'Cinzel', serif;
    font-size: 0.58rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(201, 168, 106, 0.72);
  }

  h2 {
    margin: 0;
    color: #f0dfbc;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.96rem;
  }

  .chat-scopes {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }

  .scope-btn,
  .close-btn,
  .submit-btn,
  .chat-entry input {
    min-height: 38px;
    border: 1px solid rgba(201, 168, 106, 0.22);
    border-radius: 8px;
  }

  .scope-btn,
  .close-btn,
  .submit-btn {
    background: linear-gradient(180deg, rgba(28, 22, 15, 0.94), rgba(10, 8, 7, 0.98));
    color: #ecdcb8;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .scope-btn.active {
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.14), 0 0 16px rgba(201, 168, 106, 0.12);
  }

  .close-btn {
    width: 24px;
    min-height: 24px;
    height: 24px;
    display: grid;
    place-items: center;
    line-height: 1;
  }

  .chat-log {
    min-height: 190px;
    max-height: 190px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 7px;
    padding: 10px 12px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    border-radius: 10px;
    background: rgba(7, 9, 11, 0.84);
  }

  .chat-line {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    color: rgba(234, 224, 202, 0.8);
    font-size: 0.78rem;
    line-height: 1.38;
    word-break: break-word;
  }

  .chat-line.system {
    color: #eacb83;
  }

  .time,
  .tag,
  .author {
    color: #c9a86a;
  }

  .author {
    font-weight: 600;
  }

  .text {
    min-width: 0;
  }

  .empty-state {
    color: rgba(214, 202, 177, 0.5);
    font-size: 0.8rem;
  }

  .chat-entry {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 104px;
    gap: 10px;
  }

  .chat-entry input {
    padding: 0 12px;
    background: rgba(8, 10, 12, 0.96);
    color: #f2e7c6;
  }

  .chat-entry input::placeholder {
    color: rgba(194, 181, 157, 0.38);
  }

  .chat-entry input:focus {
    outline: none;
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.14), 0 0 16px rgba(201, 168, 106, 0.1);
  }
</style>
