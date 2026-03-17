<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let label = 'Menu';
  export let hotkey = '';
  export let icon = 'inventory';
  export let active = false;

  const dispatch = createEventDispatcher<{ press: void }>();
</script>

<button class:active type="button" on:click={() => dispatch('press')}>
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
      {:else}
        <path d="M16 6l10 10-10 10L6 16Z" />
      {/if}
    </svg>
  </span>
  <span class="label">{label}</span>
  {#if hotkey}<span class="hotkey">({hotkey})</span>{/if}
</button>

<style>
  button {
    pointer-events: auto;
    min-width: 72px;
    border: 0;
    background: transparent;
    display: grid;
    justify-items: center;
    gap: 4px;
    color: #ead9b2;
    transition: transform 140ms ease, filter 160ms ease;
  }

  button:hover {
    transform: translateY(-1px) scale(1.035);
    filter: drop-shadow(0 0 12px rgba(201, 168, 106, 0.24));
  }

  .icon-frame {
    width: 36px;
    height: 36px;
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
    width: 18px;
    height: 18px;
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
    font-size: 0.62rem;
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
</style>
