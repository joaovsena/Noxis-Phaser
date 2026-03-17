<script lang="ts">
  export let title = 'Janela';
  export let subtitle = '';
  export let visible = true;
  export let width = '360px';
</script>

{#if visible}
  <section class="window-shell" style={`width:${width};`}>
    <header class="window-header">
      <div class="title-block">
        <div class="subtitle-chip">{subtitle || 'Noxis UI'}</div>
        <h2>{title}</h2>
      </div>
      <slot name="actions" />
    </header>
    <div class="window-body">
      <slot />
    </div>
  </section>
{/if}

<style>
  .window-shell {
    pointer-events: auto;
    position: relative;
    max-width: calc(100vw - 24px);
    clip-path: polygon(18px 0, calc(100% - 18px) 0, 100% 18px, 100% calc(100% - 18px), calc(100% - 18px) 100%, 18px 100%, 0 calc(100% - 18px), 0 18px);
    background:
      radial-gradient(circle at top, rgba(201, 168, 106, 0.09), transparent 34%),
      linear-gradient(180deg, rgba(17, 14, 12, 0.98), rgba(8, 8, 8, 0.99));
    border: 1px solid rgba(201, 168, 106, 0.38);
    box-shadow:
      inset 0 0 0 1px rgba(255, 236, 194, 0.04),
      inset 0 12px 26px rgba(255, 220, 150, 0.03),
      0 22px 48px rgba(0, 0, 0, 0.35);
    overflow: hidden;
  }

  .window-shell::before {
    content: '';
    position: absolute;
    inset: 8px;
    clip-path: inherit;
    border: 1px solid rgba(201, 168, 106, 0.1);
    pointer-events: none;
  }

  .window-shell::after {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0.1;
    background-image:
      radial-gradient(rgba(255, 255, 255, 0.18) 0.6px, transparent 0.8px),
      linear-gradient(135deg, transparent 0 48%, rgba(201, 168, 106, 0.18) 50%, transparent 52%);
    background-size: 18px 18px, 100% 100%;
    pointer-events: none;
    mix-blend-mode: soft-light;
  }

  .window-header {
    position: relative;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 16px 18px 12px;
    border-bottom: 1px solid rgba(201, 168, 106, 0.14);
  }

  .title-block {
    display: grid;
    gap: 4px;
  }

  .subtitle-chip {
    font-family: 'Cinzel', serif;
    font-size: 0.62rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(201, 168, 106, 0.78);
  }

  h2 {
    margin: 0;
    font-family: 'Cinzel', serif;
    font-size: 1rem;
    letter-spacing: 0.08em;
    color: #f0dfbc;
    text-transform: uppercase;
  }

  .window-body {
    position: relative;
    z-index: 1;
    padding: 16px 18px 18px;
  }
</style>
