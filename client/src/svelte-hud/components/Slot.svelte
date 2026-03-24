<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let item: any = null;
  export let hotkey = '';
  export let size = 52;
  export let searchHidden = false;
  export let pressed = false;
  export let unavailable = false;
  export let cooldownRemainingMs = 0;
  export let cooldownTotalMs = 0;
  export let variant: 'default' | 'bottom-bar' = 'default';

  const dispatch = createEventDispatcher<{
    activate: any;
    dblactivate: any;
    ctrlclick: any;
    contextaction: any;
    dragstart: any;
    inspect: { item: any; x: number; y: number };
    inspectend: void;
  }>();

  function rarityClass() {
    const rarity = String(item?.rarity || 'common').toLowerCase();
    return ['rare', 'epic', 'legendary'].includes(rarity) ? `rarity-${rarity}` : 'rarity-common';
  }

  function handleClick(event: MouseEvent) {
    if (event.ctrlKey && Number(item?.quantity || 1) > 1) {
      dispatch('ctrlclick', item);
      return;
    }
    if (event.detail >= 2) {
      dispatch('dblactivate', item);
      return;
    }
    dispatch('activate', item);
  }

  function handleDragStart(event: DragEvent) {
    const slot = event.currentTarget as HTMLElement | null;
    const icon = slot?.querySelector<HTMLImageElement>('img');
    if (event.dataTransfer && icon) {
      const ghost = icon.cloneNode(true) as HTMLImageElement;
      ghost.style.width = `${Math.max(24, size - 14)}px`;
      ghost.style.height = `${Math.max(24, size - 14)}px`;
      ghost.style.opacity = '0.72';
      ghost.style.position = 'fixed';
      ghost.style.left = '-9999px';
      ghost.style.top = '-9999px';
      ghost.style.filter = 'drop-shadow(0 0 12px rgba(201, 168, 106, 0.28))';
      document.body.appendChild(ghost);
      event.dataTransfer.setDragImage(ghost, ghost.width / 2, ghost.height / 2);
      setTimeout(() => ghost.remove(), 0);
    }
    dispatch('dragstart', item);
  }

  function handleContextMenu(event: MouseEvent) {
    event.preventDefault();
    dispatch('contextaction', item);
  }

  function handlePointerMove(event: MouseEvent) {
    if (!item) return;
    dispatch('inspect', { item, x: event.clientX, y: event.clientY });
  }

  $: safeCooldownRemainingMs = Math.max(0, Number(cooldownRemainingMs || 0));
  $: safeCooldownTotalMs = Math.max(0, Number(cooldownTotalMs || 0));
  $: cooldownRatio = safeCooldownRemainingMs > 0
    ? Math.max(0, Math.min(1, safeCooldownRemainingMs / Math.max(1, safeCooldownTotalMs || safeCooldownRemainingMs)))
    : 0;
  $: cooldownLabel = safeCooldownRemainingMs >= 10000
    ? `${Math.ceil(safeCooldownRemainingMs / 1000)}`
    : safeCooldownRemainingMs > 0
      ? `${(safeCooldownRemainingMs / 1000).toFixed(safeCooldownRemainingMs >= 3000 ? 0 : 1)}`
      : '';
</script>

<button
  class={`slot-shell ${variant} ${rarityClass()} ${searchHidden ? 'search-hidden' : ''} ${pressed ? 'pressed' : ''} ${unavailable ? 'unavailable' : ''}`}
  style={`width:${size}px;height:${size}px;`}
  draggable={Boolean(item)}
  on:click={handleClick}
  on:contextmenu={handleContextMenu}
  on:dragstart={handleDragStart}
  on:mousemove={handlePointerMove}
  on:mouseleave={() => dispatch('inspectend')}
  type="button"
>
  <div class="slot-chrome"></div>
  {#if safeCooldownRemainingMs > 0}
    <div class="cooldown-mask" style={`transform: scaleY(${cooldownRatio});`}></div>
    <span class="cooldown-label">{cooldownLabel}</span>
  {/if}
  {#if item}
    {#if item.iconUrl}
      <img src={item.iconUrl} alt={item.name || 'Item'} />
    {:else}
      <span class="fallback-mark">{String(item.name || 'SK').slice(0, 2).toUpperCase()}</span>
    {/if}
    {#if item.quantity > 1}<span class="qty">{item.quantity}</span>{/if}
  {/if}
  {#if hotkey}<span class="hotkey">{hotkey}</span>{/if}
</button>

<style>
  .slot-shell {
    pointer-events: auto;
    position: relative;
    display: grid;
    place-items: center;
    border: 1px solid rgba(201, 168, 106, 0.32);
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
    background:
      radial-gradient(circle at top, rgba(255, 231, 183, 0.06), transparent 34%),
      linear-gradient(180deg, rgba(23, 18, 13, 0.98), rgba(9, 9, 10, 0.98));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
    overflow: hidden;
    transition: transform 140ms ease, box-shadow 160ms ease, filter 160ms ease, border-color 160ms ease;
  }

  .slot-shell:hover {
    transform: translateY(-1px) scale(1.03);
    border-color: rgba(226, 190, 121, 0.52);
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.16), 0 0 12px rgba(201, 168, 106, 0.18);
  }

  .slot-shell.pressed {
    transform: translateY(1px) scale(0.985);
    border-color: rgba(255, 225, 168, 0.66);
    box-shadow:
      inset 0 0 0 1px rgba(255, 240, 206, 0.08),
      0 0 14px rgba(201, 168, 106, 0.16);
  }

  .slot-shell.unavailable {
    filter: grayscale(0.12) saturate(0.7);
  }

  .slot-shell.bottom-bar {
    border-color: rgba(201, 168, 106, 0.18);
    background:
      radial-gradient(circle at top, rgba(255, 231, 183, 0.04), transparent 38%),
      linear-gradient(180deg, rgba(20, 16, 12, 0.84), rgba(8, 8, 10, 0.9));
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.03);
  }

  .slot-shell.bottom-bar:hover {
    transform: translateY(-1px);
    border-color: rgba(226, 190, 121, 0.34);
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.08), 0 0 10px rgba(201, 168, 106, 0.12);
  }

  .slot-shell.bottom-bar.pressed {
    transform: translateY(1px) scale(0.99);
  }

  .slot-chrome {
    position: absolute;
    inset: 4px;
    clip-path: inherit;
    border: 1px solid rgba(201, 168, 106, 0.08);
    pointer-events: none;
  }

  .cooldown-mask {
    position: absolute;
    inset: 0;
    z-index: 2;
    transform-origin: center bottom;
    background: linear-gradient(180deg, rgba(3, 5, 8, 0.12), rgba(5, 7, 10, 0.88));
    pointer-events: none;
  }

  .cooldown-label {
    position: absolute;
    inset: 0;
    z-index: 3;
    display: grid;
    place-items: center;
    font-family: 'Cinzel', serif;
    font-size: 0.74rem;
    color: #fff3d5;
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.92);
    pointer-events: none;
  }

  img {
    position: relative;
    z-index: 1;
    width: calc(100% - 12px);
    height: calc(100% - 12px);
    object-fit: contain;
    filter: drop-shadow(0 3px 6px rgba(0, 0, 0, 0.38));
  }

  .fallback-mark {
    position: relative;
    z-index: 1;
    font-family: 'Cinzel', serif;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    color: #e6d2a1;
  }

  .qty,
  .hotkey {
    position: absolute;
    z-index: 4;
    font-size: 0.66rem;
    color: #f5e8c8;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.92);
    font-family: 'Cinzel', serif;
  }

  .qty {
    right: 4px;
    bottom: 3px;
  }

  .hotkey {
    left: 4px;
    top: 3px;
    color: rgba(244, 224, 181, 0.82);
  }

  .rarity-rare {
    filter: drop-shadow(0 0 8px rgba(99, 164, 255, 0.22));
    box-shadow: 0 0 0 1px rgba(99, 164, 255, 0.22), 0 0 12px rgba(99, 164, 255, 0.14);
  }

  .rarity-epic {
    filter: drop-shadow(0 0 10px rgba(190, 121, 255, 0.3));
    animation: epicPulse 1.8s ease-in-out infinite;
  }

  .rarity-legendary {
    filter: drop-shadow(0 0 12px rgba(255, 177, 72, 0.32));
    animation: legendaryPulse 2.2s ease-in-out infinite;
  }

  .search-hidden {
    opacity: 0.14;
    filter: grayscale(1);
  }

  @keyframes epicPulse {
    0%, 100% { box-shadow: 0 0 0 1px rgba(190, 121, 255, 0.24), 0 0 12px rgba(190, 121, 255, 0.18); }
    50% { box-shadow: 0 0 0 1px rgba(190, 121, 255, 0.34), 0 0 18px rgba(190, 121, 255, 0.28); }
  }

  @keyframes legendaryPulse {
    0%, 100% { box-shadow: 0 0 0 1px rgba(255, 177, 72, 0.26), 0 0 16px rgba(255, 177, 72, 0.2); }
    50% { box-shadow: 0 0 0 1px rgba(255, 200, 110, 0.36), 0 0 24px rgba(255, 177, 72, 0.3); }
  }
</style>
