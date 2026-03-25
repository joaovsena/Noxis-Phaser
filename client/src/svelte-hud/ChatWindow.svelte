<script lang="ts">
  import { fade } from 'svelte/transition';
  import { onDestroy, onMount } from 'svelte';
  import { bootDiagnostics } from '../game/debug/BootDiagnostics';
  import {
    chatStore,
    sendChatMessage,
    setChatActiveChannel,
    type ChatChannel,
    type ChatInputChannel,
    type ChatUiMessage
  } from './stores/gameUi';

  export let fixed = false;
  export let showCollapse = false;
  export let showClose = false;

  const channelTabs: Array<{ id: ChatInputChannel; label: string }> = [
    { id: 'local', label: 'Local' },
    { id: 'whisper', label: 'Privado' },
    { id: 'group', label: 'Grupo' },
    { id: 'guild', label: 'Guilda' },
    { id: 'world', label: 'Mundo' },
    { id: 'trade', label: 'Troca' }
  ];

  let message = '';
  let focused = false;
  let chatAnchorEl: HTMLDivElement | null = null;
  let inputEl: HTMLInputElement | null = null;
  let logEl: HTMLDivElement | null = null;
  let visibleMessages: ChatUiMessage[] = [];
  let scrollRaf = 0;
  let lastScrollSignature = '';
  let stickToBottom = true;

  $: void showCollapse;
  $: void showClose;
  $: void fixed;

  function channelClass(channel: ChatChannel) {
    return `channel-${channel}`;
  }

  function updateStickiness() {
    if (!logEl) return;
    const distanceToBottom = logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight;
    stickToBottom = distanceToBottom <= 18;
  }

  function scheduleScroll(force = false) {
    if (typeof window === 'undefined') return;
    if (!force && !stickToBottom) return;
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      if (!logEl) return;
      logEl.scrollTo({
        top: logEl.scrollHeight,
        behavior: force ? 'auto' : 'smooth'
      });
    });
  }

  function submitMessage() {
    const text = message.trim();
    if (!text) return;
    sendChatMessage($chatStore.activeChannel, text);
    message = '';
    stickToBottom = true;
    scheduleScroll(true);
  }

  function focusInput() {
    if (!inputEl) return;
    inputEl.focus();
    const cursorAt = inputEl.value.length;
    inputEl.setSelectionRange(cursorAt, cursorAt);
  }

  function blurInput() {
    inputEl?.blur();
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    event.preventDefault();
    focusInput();
  }

  function handleInputKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    if (message.trim()) submitMessage();
    blurInput();
  }

  function handleWindowPointerDown(event: PointerEvent) {
    if (!inputEl || document.activeElement !== inputEl) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('.chat-controls-layer')) return;
    blurInput();
  }

  function placeholderFor(channel: ChatInputChannel, lastWhisperTarget: string | null) {
    if (channel === 'whisper') {
      return lastWhisperTarget
        ? `Responder para ${lastWhisperTarget}...`
        : 'Use /w Nome mensagem...';
    }
    if (channel === 'group') return 'Falar com o grupo...';
    if (channel === 'guild') return 'Falar com a guilda...';
    if (channel === 'world') return 'Falar no mundo...';
    if (channel === 'trade') return 'Anunciar na troca...';
    return 'Falar no local...';
  }

  $: visibleMessages = ($chatStore.messages || []).slice(-120);

  $: {
    const lastEntry = visibleMessages[visibleMessages.length - 1];
    const nextSignature = `${visibleMessages.length}|${String(lastEntry?.id || '-')}`;
    if (logEl && nextSignature !== lastScrollSignature) {
      lastScrollSignature = nextSignature;
      scheduleScroll();
    }
  }

  onMount(() => {
    bootDiagnostics.log('hud', 'chat-mounted', 'ChatWindow montado.');
    scheduleScroll(true);
    window.addEventListener('keydown', handleWindowKeydown);
    window.addEventListener('pointerdown', handleWindowPointerDown);
  });

  onDestroy(() => {
    if (scrollRaf) cancelAnimationFrame(scrollRaf);
    window.removeEventListener('keydown', handleWindowKeydown);
    window.removeEventListener('pointerdown', handleWindowPointerDown);
  });
</script>

<div class="chat-anchor" bind:this={chatAnchorEl}>
  {#if $chatStore.lastTradeMessage}
    <div class="trade-highlight-wrap">
      {#key $chatStore.lastTradeMessage.id}
        <div class="trade-highlight" transition:fade={{ duration: 220 }}>
          <span class="trade-message">[{$chatStore.lastTradeMessage.player}]: {$chatStore.lastTradeMessage.content}</span>
        </div>
      {/key}
    </div>
  {/if}

  <div class="chat-history-layer">
    <div
      bind:this={logEl}
      class="chat-log hud-scroll"
      role="log"
      aria-live="polite"
      on:scroll={updateStickiness}
    >
      {#if visibleMessages.length}
        {#each visibleMessages as entry (entry.id)}
          <div class={`chat-line ${channelClass(entry.channel)}`}>
            <span class="chat-text">[{entry.player}]: {entry.content}</span>
          </div>
        {/each}
      {:else}
        <div class="chat-empty">Nenhuma mensagem por enquanto.</div>
      {/if}
    </div>
  </div>

  <div class="chat-controls-layer">
    <div class="channel-tabs" role="tablist" aria-label="Canal do chat">
      {#each channelTabs as tab}
        <button
          class:active={$chatStore.activeChannel === tab.id}
          class="tab-btn"
          type="button"
          on:click={() => setChatActiveChannel(tab.id)}
        >
          {tab.label}
        </button>
      {/each}
    </div>

    <form class="chat-entry" on:submit|preventDefault={submitMessage}>
      <input
        bind:value={message}
        bind:this={inputEl}
        class="chat-input"
        type="text"
        maxlength="180"
        autocomplete="off"
        spellcheck="false"
        placeholder={placeholderFor($chatStore.activeChannel, $chatStore.lastWhisperTarget)}
        on:keydown={handleInputKeydown}
        on:focus={() => focused = true}
        on:blur={() => focused = false}
      />
    </form>
  </div>
</div>

<style>
  .chat-anchor {
    width: min(336px, calc(100vw - 24px));
    min-height: 196px;
    height: clamp(196px, 28vh, 248px);
    max-height: min(268px, calc(100vh - 112px));
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    gap: 5px;
    overflow: hidden;
    pointer-events: none;
  }

  .trade-highlight-wrap {
    width: 100%;
    display: flex;
    justify-content: center;
    pointer-events: none;
  }

  .trade-highlight {
    width: calc(100% - 20px);
    min-height: 24px;
    padding: 5px 9px;
    border-radius: 5px;
    background: rgba(8, 9, 10, 0.52);
    border: 1px solid rgba(255, 140, 0, 0.18);
    box-shadow: 0 0 10px rgba(255, 140, 0, 0.08);
  }

  .trade-message {
    color: #ff8c00;
    font-size: 0.57rem;
    line-height: 1.28;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.88);
    word-break: break-word;
  }

  .chat-history-layer {
    min-height: 0;
    pointer-events: none;
  }

  .chat-log {
    min-height: 110px;
    height: 100%;
    max-height: none;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 1px;
    padding: 8px 8px 6px;
    background: linear-gradient(180deg, rgba(7, 10, 12, 0.18), rgba(7, 10, 12, 0.06));
    border: 1px solid rgba(255, 255, 255, 0.035);
    border-radius: 5px;
    pointer-events: none;
  }

  .chat-line {
    font-size: 0.58rem;
    line-height: 1.22;
    word-break: break-word;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  }

  .chat-text {
    display: inline;
  }

  .channel-system { color: #ff4d4d; }
  .channel-local { color: #ffffff; }
  .channel-world { color: #ffd700; }
  .channel-whisper { color: #c77dff; }
  .channel-guild { color: #4da6ff; }
  .channel-group { color: #90d98f; }
  .channel-trade { color: #ff8c00; }

  .chat-empty {
    padding: 18px 0;
    color: rgba(229, 223, 210, 0.56);
    font-size: 0.56rem;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
  }

  .chat-controls-layer {
    display: grid;
    gap: 4px;
    pointer-events: none;
  }

  .channel-tabs {
    display: grid;
    grid-template-columns: 0.95fr 1.18fr 0.95fr 1fr 1fr 1.26fr;
    gap: 2px;
    pointer-events: auto;
  }

  .tab-btn {
    box-sizing: border-box;
    min-width: 0;
    min-height: 20px;
    padding: 0 3px;
    border: 1px solid rgba(255, 255, 255, 0.07);
    border-radius: 4px;
    background: rgba(5, 8, 10, 0.5);
    color: rgba(237, 231, 217, 0.74);
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0;
    line-height: 1.05;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
    transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
    pointer-events: auto;
  }

  .tab-btn:hover {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(255, 255, 255, 0.11);
    color: rgba(255, 245, 227, 0.92);
  }

  .tab-btn.active {
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(244, 222, 180, 0.18);
    color: #f7e9c4;
  }

  .chat-entry {
    display: block;
    pointer-events: auto;
  }

  .chat-input {
    width: 100%;
    min-height: 26px;
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    padding: 0 9px;
    background: rgba(5, 8, 10, 0.56);
    color: #f5efe4;
    font-size: 0.58rem;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.85);
    outline: none;
    pointer-events: auto;
  }

  .chat-input::placeholder {
    color: rgba(219, 212, 195, 0.44);
  }

  .chat-input:focus {
    border-color: rgba(255, 255, 255, 0.09);
    background: rgba(5, 8, 10, 0.68);
  }

  @media (max-width: 760px) {
    .chat-anchor {
      width: min(312px, calc(100vw - 20px));
      min-height: 176px;
      height: clamp(176px, 26vh, 220px);
    }

    .channel-tabs {
      grid-template-columns: 0.92fr 1.16fr 0.94fr 1fr 0.98fr 1.22fr;
      gap: 2px;
    }

    .tab-btn {
      min-height: 19px;
      padding: 0 2px;
      font-size: 7px;
    }
  }
</style>
