<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import IconButton from './components/IconButton.svelte';
  import Slot from './components/Slot.svelte';
  import {
    adminStore,
    beginDrag,
    clearHotbarBinding,
    commitHotbarBindings,
    dragStore,
    endDrag,
    hotbarBindingsStore,
    hotbarSlots,
    panelStore,
    playerStats,
    sendUiMessage,
    setHotbarBinding,
    togglePanel,
    worldStore
  } from './stores/gameUi';

  export let hotkeyPulse: Record<string, boolean> = {};
  export let hotbarNow = Date.now();

  const menuLeft = [
    { id: 'character', label: 'Personagem', hotkey: 'C', icon: 'character' },
    { id: 'inventory', label: 'Inventario', hotkey: 'B', icon: 'inventory' },
    { id: 'skills', label: 'Habilidades', hotkey: 'V', icon: 'skills' },
    { id: 'map', label: 'Mapa', hotkey: 'M', icon: 'map' }
  ] as const;

  const menuRight = [
    { id: 'quests', label: 'Quests', hotkey: 'J', icon: 'quests' },
    { id: 'party', label: 'Grupo', hotkey: 'G', icon: 'party' },
    { id: 'friends', label: 'Amigos', hotkey: 'O', icon: 'friends' },
    { id: 'guild', label: 'Guilda', hotkey: 'L', icon: 'guild' },
    { id: 'pets', label: 'Pets', hotkey: 'X', icon: 'pets' }
  ] as const;

  let bottomBarEl: HTMLElement | null = null;
  let xpLineEl: HTMLDivElement | null = null;
  let actionLayerEl: HTMLDivElement | null = null;
  let hotbarClusterEl: HTMLDivElement | null = null;
  let layoutObserver: ResizeObserver | null = null;
  let layoutFrame = 0;

  $: xpCurrent = Number($playerStats.xp || 0);
  $: xpMax = Math.max(1, Number($playerStats.xpToNext || 1));
  $: xpRatio = Math.max(0, Math.min(1, xpCurrent / xpMax));
  $: topRow = $hotbarSlots.slice(0, 8);
  $: bottomRow = $hotbarSlots.slice(8, 16);

  function queueLayoutVarsUpdate() {
    if (typeof window === 'undefined') return;
    if (layoutFrame) cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => {
      layoutFrame = 0;
      updateLayoutVars();
    });
  }

  function updateLayoutVars() {
    if (typeof window === 'undefined') return;
    const rootStyle = document.documentElement.style;
    const viewportHeight = window.innerHeight;

    const xpTop = xpLineEl ? Math.max(0, Math.round(viewportHeight - xpLineEl.getBoundingClientRect().top)) : 118;
    const menuTop = actionLayerEl ? Math.max(0, Math.round(viewportHeight - actionLayerEl.getBoundingClientRect().top)) : xpTop + 54;
    const skillTop = hotbarClusterEl ? Math.max(0, Math.round(viewportHeight - hotbarClusterEl.getBoundingClientRect().top)) : 48;
    const bottomBarHeight = bottomBarEl ? Math.max(0, Math.round(bottomBarEl.getBoundingClientRect().height)) : 156;

    rootStyle.setProperty('--xp-bar-top', `${xpTop}px`);
    rootStyle.setProperty('--hud-menu-top', `${menuTop}px`);
    rootStyle.setProperty('--hud-skill-top', `${skillTop}px`);
    rootStyle.setProperty('--hud-bottom-bar-height', `${bottomBarHeight}px`);
  }

  function dropOnHotbar(targetKey: string, event: DragEvent) {
    event.preventDefault();
    const payload = $dragStore;
    if (!payload) return;
    if (payload.source === 'skill') setHotbarBinding(targetKey, { type: 'action', actionId: 'skill_cast', skillId: payload.skillId, skillName: payload.skillName });
    if (payload.source === 'basic') setHotbarBinding(targetKey, { type: 'action', actionId: 'basic_attack' });
    if (payload.source === 'inventory' || payload.source === 'equipment') setHotbarBinding(targetKey, { type: 'item', itemId: payload.itemId });
    if (payload.source === 'hotbar') {
      const next = { ...$hotbarBindingsStore };
      const from = next[payload.key] || null;
      next[payload.key] = next[targetKey] || null;
      next[targetKey] = from;
      commitHotbarBindings(next);
    }
    endDrag();
  }

  function pressMenu(id: string) {
    if (id === 'party') {
      togglePanel('party');
      sendUiMessage({ type: 'party.requestAreaParties' });
      return;
    }
    if (id === 'friends') {
      togglePanel('friends');
      sendUiMessage({ type: 'friend.list' });
      return;
    }
    if (id === 'admin') {
      if ($adminStore.isAdmin) togglePanel('admin');
      return;
    }
    togglePanel(id as 'character' | 'inventory' | 'skills' | 'map' | 'quests' | 'guild' | 'pets');
  }

  function menuActive(id: string) {
    if (id === 'admin') return Boolean($adminStore.isAdmin && $panelStore.admin);
    return Boolean($panelStore[id as keyof typeof $panelStore]);
  }

  onMount(() => {
    queueLayoutVarsUpdate();
    window.addEventListener('resize', queueLayoutVarsUpdate);
    if (typeof ResizeObserver !== 'undefined' && bottomBarEl) {
      layoutObserver = new ResizeObserver(() => queueLayoutVarsUpdate());
      layoutObserver.observe(bottomBarEl);
      if (actionLayerEl) layoutObserver.observe(actionLayerEl);
      if (xpLineEl) layoutObserver.observe(xpLineEl);
      if (hotbarClusterEl) layoutObserver.observe(hotbarClusterEl);
    }
  });

  onDestroy(() => {
    if (layoutFrame) cancelAnimationFrame(layoutFrame);
    window.removeEventListener('resize', queueLayoutVarsUpdate);
    layoutObserver?.disconnect();
  });
</script>

<section class="bottom-bar" bind:this={bottomBarEl}>
  <div class="action-layer" bind:this={actionLayerEl}>
    <div class="menu-strip left" aria-label="Menus principais">
      {#each menuLeft as item}
        <IconButton
          variant="bottom-bar"
          label={item.label}
          hotkey={item.hotkey}
          icon={item.icon}
          active={menuActive(item.id)}
          on:press={() => pressMenu(item.id)}
        />
      {/each}
    </div>

    <div class="hotbar-cluster" bind:this={hotbarClusterEl} aria-label="Hotbar principal">
      <div class="hotbar-row">
        {#each topRow as slot}
          <div class="slot-wrapper" role="group" aria-label={`Slot ${slot.key.toUpperCase()}`} on:dragover|preventDefault on:drop={(event) => dropOnHotbar(slot.key, event)}>
            <Slot
              variant="bottom-bar"
              item={slot.binding?.type === 'item' ? { ...slot.binding, iconUrl: slot.iconUrl, name: slot.label } : (slot.iconUrl ? { iconUrl: slot.iconUrl, name: slot.label } : slot.binding ? { name: slot.label } : null)}
              hotkey={slot.key.toUpperCase()}
              size={36}
              pressed={Boolean(hotkeyPulse[slot.key])}
              unavailable={Boolean(slot.binding && slot.cooldownEndsAt > hotbarNow)}
              cooldownRemainingMs={Math.max(0, slot.cooldownEndsAt - hotbarNow)}
              cooldownTotalMs={slot.cooldownMs}
              on:dragstart={() => slot.binding && beginDrag({ source: 'hotbar', key: slot.key })}
              on:contextaction={() => slot.binding && clearHotbarBinding(slot.key)}
            />
          </div>
        {/each}
      </div>

      <div class="hotbar-row">
        {#each bottomRow as slot}
          <div class="slot-wrapper" role="group" aria-label={`Slot ${slot.key.toUpperCase()}`} on:dragover|preventDefault on:drop={(event) => dropOnHotbar(slot.key, event)}>
            <Slot
              variant="bottom-bar"
              item={slot.binding?.type === 'item' ? { ...slot.binding, iconUrl: slot.iconUrl, name: slot.label } : (slot.iconUrl ? { iconUrl: slot.iconUrl, name: slot.label } : slot.binding ? { name: slot.label } : null)}
              hotkey={slot.key.toUpperCase()}
              size={36}
              pressed={Boolean(hotkeyPulse[slot.key])}
              unavailable={Boolean(slot.binding && slot.cooldownEndsAt > hotbarNow)}
              cooldownRemainingMs={Math.max(0, slot.cooldownEndsAt - hotbarNow)}
              cooldownTotalMs={slot.cooldownMs}
              on:dragstart={() => slot.binding && beginDrag({ source: 'hotbar', key: slot.key })}
              on:contextaction={() => slot.binding && clearHotbarBinding(slot.key)}
            />
          </div>
        {/each}
      </div>
    </div>

    <div class="menu-strip right" aria-label="Menus secundarios">
      {#each menuRight as item}
        <IconButton
          variant="bottom-bar"
          label={item.label}
          hotkey={item.hotkey}
          icon={item.icon}
          active={menuActive(item.id)}
          on:press={() => pressMenu(item.id)}
        />
      {/each}
    </div>
  </div>

  <div class="xp-layer">
    <div class="xp-line" bind:this={xpLineEl}>
      <div class="xp-line-fill" style={`transform: scaleX(${xpRatio});`}></div>
    </div>
    <div class="xp-readout">XP {xpCurrent} / {xpMax}</div>
    <div class="map-readout">{$worldStore.mapCode}/{$worldStore.mapId}</div>
  </div>
</section>

<style>
  .bottom-bar {
    position: relative;
    width: 100%;
    min-height: 132px;
    pointer-events: none;
  }

  .action-layer,
  .xp-layer,
  .xp-readout,
  .map-readout {
    position: absolute;
    pointer-events: none;
  }

  .action-layer {
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    display: flex;
    align-items: flex-end;
    gap: 10px;
    width: max-content;
    max-width: calc(100% - 12px);
    z-index: 25;
  }

  .menu-strip {
    display: flex;
    align-items: flex-end;
    gap: 5px;
    pointer-events: auto;
  }

  .menu-strip.left {
    justify-content: flex-end;
  }

  .menu-strip.right {
    justify-content: flex-start;
  }

  .xp-layer {
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 20;
    pointer-events: none;
  }

  .xp-line {
    position: relative;
    width: 100%;
    height: 14px;
    overflow: hidden;
    border-radius: 999px;
    border: 1px solid rgba(201, 168, 106, 0.24);
    background:
      linear-gradient(180deg, rgba(31, 24, 18, 0.94), rgba(10, 10, 10, 0.98));
    box-shadow:
      0 10px 22px rgba(0, 0, 0, 0.22),
      inset 0 1px 0 rgba(255, 243, 215, 0.05);
  }

  .xp-line-fill {
    width: 100%;
    height: 100%;
    transform-origin: left center;
    background: linear-gradient(90deg, rgba(141, 101, 26, 0.9), rgba(214, 163, 63, 0.98) 55%, rgba(240, 211, 141, 0.95));
  }

  .xp-readout,
  .map-readout {
    bottom: 1px;
    color: rgba(243, 226, 187, 0.9);
    font-family: var(--hud-font-display);
    font-size: 0.56rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .xp-readout {
    left: 50%;
    transform: translateX(-50%);
  }

  .map-readout {
    right: 8px;
  }

  .hotbar-cluster {
    display: grid;
    gap: 4px;
    justify-items: center;
    pointer-events: auto;
    z-index: 30;
  }

  .hotbar-row {
    display: grid;
    grid-template-columns: repeat(8, 36px);
    gap: 4px;
  }

  .slot-wrapper {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
  }

  @media (max-width: 1360px) {
    .bottom-bar {
      min-height: 128px;
    }

    .action-layer {
      bottom: 22px;
      gap: 8px;
    }
  }

  @media (max-width: 1120px) {
    .bottom-bar {
      min-height: 124px;
    }

    .action-layer {
      bottom: 20px;
      gap: 6px;
    }

    .hotbar-row {
      grid-template-columns: repeat(8, 34px);
      gap: 3px;
    }

    .slot-wrapper {
      width: 34px;
      height: 34px;
    }
  }

  @media (max-width: 760px) {
    .bottom-bar {
      min-height: 114px;
    }

    .action-layer {
      bottom: 18px;
      gap: 4px;
    }

    .hotbar-row {
      grid-template-columns: repeat(8, 30px);
      gap: 3px;
    }

    .slot-wrapper {
      width: 30px;
      height: 30px;
    }

    .xp-readout,
    .map-readout {
      font-size: 0.5rem;
    }
  }
</style>
