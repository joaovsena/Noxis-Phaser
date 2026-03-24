<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let title = 'Janela';
  export let subtitle = '';
  export let visible = true;
  export let width = '360px';
  export let maxWidth = '1120px';
  export let showClose = true;
  export let minimizable = true;
  export let scrollable = true;
  export let defaultCollapsed = false;
  export let maxBodyHeight = 'min(72vh, 760px)';

  const dispatch = createEventDispatcher<{ close: void }>();
  let collapsed = defaultCollapsed;
</script>

{#if visible}
  <section class="window-shell" style={`--window-width:${width}; --window-max-width:${maxWidth};`}>
    <header class="window-header" data-window-drag-handle="true">
      <div class="title-block">
        <div class="subtitle-chip">{subtitle || 'Noxis UI'}</div>
        <h2>{title}</h2>
      </div>
      <div class="header-actions">
        <slot name="actions" />
        {#if minimizable}
          <button
            class="chrome-btn"
            type="button"
            aria-label={collapsed ? `Expandir ${title}` : `Minimizar ${title}`}
            on:click={() => collapsed = !collapsed}
          >
            {collapsed ? '+' : '-'}
          </button>
        {/if}
        {#if showClose}
          <button class="chrome-btn close-btn" type="button" aria-label={`Fechar ${title}`} on:click={() => dispatch('close')}>x</button>
        {/if}
      </div>
    </header>

    {#if !collapsed}
      <div class={`window-body ${scrollable ? 'scrollable' : ''}`} style={`--window-body-max:${maxBodyHeight};`}>
        <slot />
      </div>

      {#if $$slots.footer}
        <footer class="window-footer">
          <slot name="footer" />
        </footer>
      {/if}
    {/if}
  </section>
{/if}

<style>
  .window-shell {
    pointer-events: auto;
    position: relative;
    width: min(var(--window-width), calc(100vw - 24px));
    max-width: min(calc(100vw - 24px), var(--window-max-width));
    border: 1px solid rgba(201, 168, 106, 0.34);
    border-radius: 18px;
    background:
      radial-gradient(circle at top, rgba(201, 168, 106, 0.11), transparent 30%),
      linear-gradient(180deg, rgba(18, 15, 13, 0.98), rgba(8, 8, 8, 0.99));
    box-shadow:
      inset 0 0 0 1px rgba(255, 236, 194, 0.03),
      inset 0 10px 24px rgba(255, 220, 150, 0.02),
      0 24px 52px rgba(0, 0, 0, 0.36);
    overflow: hidden;
    backdrop-filter: blur(4px);
  }

  .window-shell::before {
    content: '';
    position: absolute;
    inset: 8px;
    border: 1px solid rgba(201, 168, 106, 0.1);
    border-radius: 14px;
    pointer-events: none;
  }

  .window-shell::after {
    content: '';
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.08;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent 18%),
      radial-gradient(circle at 12% 0%, rgba(201, 168, 106, 0.28), transparent 28%);
  }

  .window-header,
  .window-body,
  .window-footer {
    position: relative;
    z-index: 1;
  }

  .window-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 15px 18px 13px;
    border-bottom: 1px solid rgba(201, 168, 106, 0.14);
    cursor: grab;
  }

  .window-header:active {
    cursor: grabbing;
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .title-block {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .subtitle-chip {
    font-family: var(--hud-font-display);
    font-size: 0.6rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(201, 168, 106, 0.78);
  }

  h2 {
    margin: 0;
    font-family: var(--hud-font-display);
    font-size: 1rem;
    letter-spacing: 0.08em;
    color: #f0dfbc;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chrome-btn {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    border: 1px solid rgba(201, 168, 106, 0.24);
    background: linear-gradient(180deg, rgba(28, 22, 15, 0.94), rgba(10, 8, 7, 0.98));
    color: #e8d5aa;
    line-height: 1;
    font-family: var(--hud-font-display);
    transition: transform 140ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .chrome-btn:hover {
    transform: translateY(-1px);
    border-color: rgba(201, 168, 106, 0.4);
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.08), 0 0 12px rgba(201, 168, 106, 0.14);
  }

  .close-btn {
    color: #efc3b9;
  }

  .window-body {
    padding: 16px 18px 18px;
    min-width: 0;
  }

  .window-body.scrollable {
    max-height: min(var(--window-body-max), calc(100vh - 148px));
    overflow: auto;
    overscroll-behavior: contain;
    padding-right: 12px;
  }

  .window-body :global(*) {
    box-sizing: border-box;
    min-width: 0;
  }

  .window-body.scrollable::-webkit-scrollbar {
    width: 10px;
  }

  .window-body.scrollable::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(201, 168, 106, 0.28), rgba(98, 76, 41, 0.46));
  }

  .window-body.scrollable::-webkit-scrollbar-track {
    background: rgba(6, 8, 10, 0.42);
  }

  .window-footer {
    padding: 0 18px 18px;
  }

  @media (max-width: 760px) {
    .window-header {
      padding: 13px 14px 11px;
    }

    .window-body {
      padding: 14px;
    }

    .window-body.scrollable {
      padding-right: 8px;
    }

    .window-footer {
      padding: 0 14px 14px;
    }
  }
</style>
