<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let label = 'Menu';
  export let hotkey = '';
  export let icon = 'inventory';
  export let active = false;
  export let variant: 'default' | 'bottom-bar' | 'bottom-float' = 'default';
  export let showHotkey = true;
  export let showLabel = true;

  const dispatch = createEventDispatcher<{ press: void }>();
</script>

<button class={`icon-button ${variant} ${showLabel ? '' : 'icon-only'}`} class:active aria-label={label} title={label} type="button" on:click={() => dispatch('press')}>
  <span class="icon-frame" aria-hidden="true">
    <svg viewBox="0 0 32 32" role="img">
      {#if icon === 'character'}
        <path d="M16 8a4 4 0 1 1 0 8a4 4 0 0 1 0-8Z" />
        <path d="M9 24c1.2-3.7 4-5.5 7-5.5s5.8 1.8 7 5.5" />
      {:else if icon === 'inventory'}
        <path d="M10 10h12l1 3v9H9v-9Z" />
        <path d="M13 10V8.8c0-1.1.9-1.8 2-1.8h2c1.1 0 2 .7 2 1.8V10" />
      {:else if icon === 'skills'}
        <path d="M16 6l2.8 6.2L25 15l-6.2 2.8L16 24l-2.8-6.2L7 15l6.2-2.8Z" />
      {:else if icon === 'map'}
        <path d="M8 9l5-2l6 2l5-2v16l-5 2l-6-2l-5 2Z" />
        <path d="M13 7v16" />
        <path d="M19 9v16" />
      {:else if icon === 'quests'}
        <path d="M10 7h12v18H10Z" />
        <path d="M13 12h6" />
        <path d="M13 16h6" />
        <path d="M13 20h4" />
      {:else if icon === 'chat'}
        <path d="M8 9h16v10H14l-4 4v-4H8Z" />
      {:else if icon === 'minimap'}
        <circle cx="16" cy="16" r="8" />
        <path d="M16 6v3" />
        <path d="M16 23v3" />
        <path d="M6 16h3" />
        <path d="M23 16h3" />
        <path d="M16 16l3-3" />
      {:else if icon === 'party'}
        <circle cx="11" cy="14" r="4" />
        <circle cx="21" cy="14" r="4" />
        <path d="M6 24c1.2-3.5 3.8-5 5-5" />
        <path d="M16 24c1.2-3.5 3.8-5 5-5" />
      {:else if icon === 'friends'}
        <circle cx="12" cy="13" r="4" />
        <circle cx="20" cy="18" r="3.5" />
        <path d="M7 24c1.2-3.5 3.8-5 5-5" />
        <path d="M16 24c.8-2.5 2.4-4 4-4" />
      {:else if icon === 'guild'}
        <path d="M16 6l8 3v6c0 5-3.2 9.2-8 11-4.8-1.8-8-6-8-11V9Z" />
        <path d="M12.5 16l2.5 2.5 4.5-5" />
      {:else if icon === 'admin'}
        <path d="M16 6l7 4v8c0 4.3-2.8 7.6-7 9-4.2-1.4-7-4.7-7-9v-8Z" />
        <path d="M12 13h8" />
        <path d="M12 17h8" />
        <path d="M14 21h4" />
      {:else}
        <path d="M16 6l10 10-10 10L6 16Z" />
      {/if}
    </svg>
  </span>
  {#if showLabel}
    <span class="label">{label}</span>
  {/if}
  {#if showHotkey && hotkey}<span class="hotkey">({hotkey})</span>{/if}
</button>

<style>
  .icon-button {
    pointer-events: auto;
    min-width: 54px;
    border: 0;
    background: transparent;
    display: grid;
    justify-items: center;
    gap: 2px;
    color: #ead9b2;
    transition: transform 140ms ease, filter 160ms ease;
  }

  .icon-button:hover {
    transform: translateY(-1px) scale(1.035);
    filter: drop-shadow(0 0 12px rgba(201, 168, 106, 0.24));
  }

  .icon-frame {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
    border: 1px solid rgba(201, 168, 106, 0.42);
    background:
      radial-gradient(circle at top, rgba(201, 168, 106, 0.18), transparent 36%),
      linear-gradient(180deg, rgba(24, 18, 13, 0.96), rgba(10, 8, 6, 0.98));
    box-shadow: inset 0 0 0 1px rgba(255, 241, 210, 0.04);
  }

  svg {
    width: 14px;
    height: 14px;
    fill: none;
    stroke: #d8bb82;
    stroke-width: 1.8;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 6px rgba(201, 168, 106, 0.16));
  }

  .label,
  .hotkey {
    font-family: 'Cinzel', serif;
    font-size: 0.5rem;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .hotkey {
    color: rgba(222, 205, 164, 0.75);
  }

  .active .icon-frame {
    border-color: rgba(230, 194, 126, 0.56);
    box-shadow:
      0 0 0 1px rgba(201, 168, 106, 0.18),
      0 0 16px rgba(201, 168, 106, 0.24),
      inset 0 0 0 1px rgba(255, 241, 210, 0.05);
  }

  .icon-button.bottom-bar {
    min-width: 52px;
    gap: 3px;
    padding: 0;
  }

  .icon-button.bottom-bar .icon-frame {
    width: 22px;
    height: 22px;
    clip-path: none;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  .icon-button.bottom-bar svg {
    width: 14px;
    height: 14px;
    stroke: rgba(228, 200, 139, 0.92);
  }

  .icon-button.bottom-bar .label,
  .icon-button.bottom-bar .hotkey {
    font-size: 0.46rem;
    letter-spacing: 0.06em;
    color: rgba(235, 219, 183, 0.86);
  }

  .icon-button.bottom-bar.active .icon-frame {
    border: 0;
    box-shadow: none;
  }

  .icon-button.bottom-bar.active svg {
    stroke: #f6ddb0;
    filter: drop-shadow(0 0 8px rgba(201, 168, 106, 0.32));
  }

  .icon-button.bottom-float {
    min-width: 22px;
    gap: 0;
    padding: 0 1px;
  }

  .icon-button.bottom-float .icon-frame {
    width: 20px;
    height: 20px;
    clip-path: none;
    border: 0;
    background: transparent;
    box-shadow: none;
  }

  .icon-button.bottom-float svg {
    width: 15px;
    height: 15px;
    stroke: rgba(233, 209, 154, 0.94);
    filter: drop-shadow(0 0 6px rgba(201, 168, 106, 0.18));
  }

  .icon-button.bottom-float.active svg {
    stroke: #ffe3ad;
    filter: drop-shadow(0 0 10px rgba(201, 168, 106, 0.32));
  }

  .icon-button.icon-only .label,
  .icon-button.icon-only .hotkey {
    display: none;
  }
</style>
