<script lang="ts">
  import { createEventDispatcher, onDestroy, onMount } from 'svelte';
  import { bootDiagnostics } from '../game/debug/BootDiagnostics';
  import { chatStore, sendChatMessage } from './stores/gameUi';

  type ChatScope = 'local' | 'map' | 'global';
  type ChatTab = 'all' | 'system' | 'local' | 'map' | 'global';
  type ChatEntry = {
    id?: string | number;
    at?: number;
    from?: string;
    scope?: ChatScope | string;
    text?: string;
    type?: string;
  };

  const dispatch = createEventDispatcher<{ close: void }>();
  const readTabs: Array<{ id: ChatTab; label: string }> = [
    { id: 'all', label: 'Geral' },
    { id: 'system', label: 'Sistema' },
    { id: 'local', label: 'Local' },
    { id: 'map', label: 'Mapa' },
    { id: 'global', label: 'Global' }
  ];
  const sendScopes: Array<{ id: ChatScope | 'party' | 'guild' | 'whisper'; label: string; enabled: boolean }> = [
    { id: 'local', label: 'Local', enabled: true },
    { id: 'map', label: 'Mapa', enabled: true },
    { id: 'global', label: 'Global', enabled: true },
    { id: 'party', label: 'Party', enabled: false },
    { id: 'guild', label: 'Guild', enabled: false },
    { id: 'whisper', label: 'Whisper', enabled: false }
  ];

  let readTab: ChatTab = 'all';
  let sendScope: ChatScope = 'local';
  let message = '';
  let collapsed = false;
  let focused = false;
  let logEl: HTMLDivElement | null = null;
  let visibleMessages: ChatEntry[] = [];
  let scrollRaf = 0;
  let lastScrollSignature = '';
  export let fixed = false;
  export let showCollapse = true;
  export let showClose = true;

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
    sendChatMessage(sendScope, text);
    message = '';
    scheduleScroll();
  }

  $: visibleMessages = ($chatStore.messages || [])
    .filter((entry) => {
      if (readTab === 'all') return true;
      if (readTab === 'system') return entry?.type === 'system';
      return entry?.type !== 'system' && String(entry?.scope || 'local') === readTab;
    })
    .slice(-90) as ChatEntry[];

  $: {
    const lastEntry = visibleMessages[visibleMessages.length - 1];
    const nextSignature = `${readTab}|${visibleMessages.length}|${String(lastEntry?.id || lastEntry?.at || lastEntry?.text || '-')}`;
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

<div class={`chat-shell ${focused ? 'focused' : ''} ${fixed ? 'fixed' : ''}`}>
  <div class="chat-header" data-window-drag-handle={fixed ? undefined : 'true'}>
    <div class="title-block">
      <div class="hud-kicker">Comunicacao</div>
      <h2>Chat</h2>
    </div>
    <div class="header-actions">
      <div class="message-count">{visibleMessages.length}</div>
      {#if showCollapse}
        <button class="mini-btn" type="button" aria-label={collapsed ? 'Expandir chat' : 'Minimizar chat'} on:click={() => collapsed = !collapsed}>
          {collapsed ? '+' : '-'}
        </button>
      {/if}
      {#if showClose}
        <button class="mini-btn close-btn" type="button" aria-label="Fechar chat" on:click={() => dispatch('close')}>x</button>
      {/if}
    </div>
  </div>

  {#if !collapsed}
    <div class="read-tabs" role="tablist" aria-label="Filtros do chat">
      {#each readTabs as entry}
        <button
          class:active={readTab === entry.id}
          class="tab-btn"
          type="button"
          on:click={() => readTab = entry.id}
        >
          {entry.label}
        </button>
      {/each}
    </div>

    <div bind:this={logEl} class="chat-log hud-scroll" role="log" aria-live="polite">
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
        <div class="hud-empty">Nenhuma mensagem neste filtro.</div>
      {/if}
    </div>

    <div class="send-tabs" aria-label="Canal de envio">
      {#each sendScopes as entry}
        <button
          class:active={sendScope === entry.id}
          class={`scope-btn ${!entry.enabled ? 'disabled' : ''}`}
          type="button"
          disabled={!entry.enabled}
          on:click={() => entry.enabled && (sendScope = entry.id as ChatScope)}
        >
          {entry.label}
        </button>
      {/each}
    </div>

    <form class="chat-entry" on:submit|preventDefault={submitMessage}>
      <input
        bind:value={message}
        class="hud-input"
        type="text"
        maxlength="180"
        autocomplete="off"
        spellcheck="false"
        placeholder={`Falar em ${sendScope}...`}
        on:focus={() => focused = true}
        on:blur={() => focused = false}
      />
      <button class="hud-btn" type="submit">Enviar</button>
    </form>
  {/if}
</div>

<style>
  .chat-shell {
    width: min(292px, calc(100vw - 24px));
    display: grid;
    gap: 6px;
    padding: 10px;
    position: relative;
    overflow: hidden;
    contain: layout paint;
    border: 1px solid rgba(201, 168, 106, 0.28);
    border-radius: 16px;
    background:
      radial-gradient(circle at top, rgba(201, 168, 106, 0.08), transparent 32%),
      linear-gradient(180deg, rgba(16, 13, 11, 0.97), rgba(8, 8, 8, 0.98));
    box-shadow:
      0 18px 34px rgba(0, 0, 0, 0.28),
      inset 0 0 0 1px rgba(255, 239, 206, 0.03);
    transition: opacity 180ms ease, transform 180ms ease;
  }

  .chat-shell:not(:hover):not(.focused) {
    opacity: 0.62;
  }

  .chat-shell.fixed {
    box-shadow:
      0 12px 24px rgba(0, 0, 0, 0.24),
      inset 0 0 0 1px rgba(255, 239, 206, 0.03);
  }

  .chat-shell::before {
    content: '';
    position: absolute;
    inset: 8px;
    border: 1px solid rgba(201, 168, 106, 0.08);
    border-radius: 12px;
    pointer-events: none;
  }

  .chat-header,
  .read-tabs,
  .chat-log,
  .send-tabs,
  .chat-entry {
    position: relative;
    z-index: 1;
  }

  .chat-header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 8px;
    cursor: grab;
  }

  .chat-header:active {
    cursor: grabbing;
  }

  .chat-shell.fixed .chat-header,
  .chat-shell.fixed .chat-header:active {
    cursor: default;
  }

  .title-block {
    display: grid;
    gap: 4px;
  }

  h2 {
    margin: 0;
    color: #f0dfbc;
    font-family: var(--hud-font-display);
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 0.76rem;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .message-count {
    color: var(--hud-text-soft);
    font-size: 0.68rem;
  }

  .mini-btn {
    width: 22px;
    height: 22px;
    display: grid;
    place-items: center;
    border-radius: 9px;
    border: 1px solid rgba(201, 168, 106, 0.22);
    background: rgba(18, 14, 12, 0.92);
    color: #e8d5aa;
    line-height: 1;
  }

  .close-btn {
    color: #efc1b5;
  }

  .read-tabs,
  .send-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .tab-btn,
  .scope-btn {
    min-height: 24px;
    padding: 0 8px;
    border-radius: 999px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(11, 14, 18, 0.76);
    color: var(--hud-text-soft);
    font-size: 0.58rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .tab-btn.active,
  .scope-btn.active {
    color: var(--hud-gold);
    border-color: rgba(201, 168, 106, 0.42);
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.12), 0 0 12px rgba(201, 168, 106, 0.1);
  }

  .scope-btn.disabled {
    opacity: 0.42;
  }

  .chat-log {
    min-height: 124px;
    max-height: 156px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 5px;
    padding: 8px 9px;
    border: 1px solid rgba(201, 168, 106, 0.16);
    border-radius: 12px;
    background: rgba(7, 9, 11, 0.84);
  }

  .chat-line {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    color: rgba(234, 224, 202, 0.8);
    font-size: 0.68rem;
    line-height: 1.38;
    word-break: break-word;
  }

  .chat-line.system .tag,
  .chat-line.system .text {
    color: var(--hud-warning);
  }

  .time {
    color: rgba(188, 175, 152, 0.7);
  }

  .tag {
    color: #88c9ff;
    text-transform: uppercase;
    font-size: 0.56rem;
  }

  .author {
    color: #f0dfbc;
    font-weight: 600;
  }

  .text {
    color: rgba(239, 231, 215, 0.84);
  }

  .chat-entry {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px;
  }
</style>
