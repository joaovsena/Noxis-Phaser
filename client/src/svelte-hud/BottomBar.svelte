<script lang="ts">
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
    { id: 'character', label: 'Personagem', icon: 'character' },
    { id: 'inventory', label: 'Inventario', icon: 'inventory' },
    { id: 'skills', label: 'Habilidades', icon: 'skills' },
    { id: 'map', label: 'Mapa', icon: 'map' }
  ] as const;

  const menuRight = [
    { id: 'quests', label: 'Quests', icon: 'quests' },
    { id: 'party', label: 'Grupo', icon: 'party' },
    { id: 'friends', label: 'Amigos', icon: 'friends' },
    { id: 'guild', label: 'Guilda', icon: 'guild' },
    { id: 'admin', label: 'Admin', icon: 'admin', adminOnly: true }
  ] as const;

  $: xpCurrent = Number($playerStats.xp || 0);
  $: xpMax = Math.max(1, Number($playerStats.xpToNext || 1));
  $: xpRatio = Math.max(0, Math.min(1, xpCurrent / xpMax));
  $: topRow = $hotbarSlots.slice(0, 8);
  $: bottomRow = $hotbarSlots.slice(8, 16);

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
    togglePanel(id as 'character' | 'inventory' | 'skills' | 'map' | 'quests' | 'guild');
  }

  function menuActive(id: string) {
    if (id === 'admin') return Boolean($adminStore.isAdmin && $panelStore.admin);
    return Boolean($panelStore[id as keyof typeof $panelStore]);
  }
</script>

<section class="bottom-bar">
  <div class="content-layer">
    <div class="menu-strip left" aria-label="Menus principais">
      {#each menuLeft as item}
        <IconButton
          variant="bottom-float"
          label={item.label}
          icon={item.icon}
          active={menuActive(item.id)}
          showHotkey={false}
          showLabel={false}
          on:press={() => pressMenu(item.id)}
        />
      {/each}
    </div>

    <div class="hotbar-cluster" aria-label="Hotbar principal">
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
        {#if !item.adminOnly || $adminStore.isAdmin}
          <IconButton
            variant="bottom-float"
            label={item.label}
            icon={item.icon}
            active={menuActive(item.id)}
            showHotkey={false}
            showLabel={false}
            on:press={() => pressMenu(item.id)}
          />
        {/if}
      {/each}
    </div>
  </div>

  <div class="xp-line">
    <div class="xp-line-fill" style={`transform: scaleX(${xpRatio});`}></div>
  </div>
  <div class="xp-readout">XP {xpCurrent} / {xpMax}</div>
  <div class="map-readout">{$worldStore.mapCode}/{$worldStore.mapId}</div>
</section>

<style>
  .bottom-bar {
    position: relative;
    width: 100%;
    min-height: 84px;
    padding: 0 8px 18px;
    pointer-events: none;
  }

  .content-layer,
  .xp-line,
  .xp-readout,
  .map-readout {
    position: absolute;
    pointer-events: none;
  }

  .content-layer {
    left: 0;
    right: 0;
    bottom: 18px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: end;
    gap: 8px;
  }

  .menu-strip,
  .hotbar-cluster {
    pointer-events: auto;
  }

  .menu-strip {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    min-width: 0;
  }

  .menu-strip.right {
    justify-content: flex-end;
  }

  .hotbar-cluster {
    display: grid;
    gap: 4px;
    justify-items: center;
    align-self: start;
    transform: translateY(-7px);
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

  .xp-line {
    left: 0;
    right: 0;
    bottom: 0;
    height: 14px;
    overflow: hidden;
    border-radius: 999px;
    border: 1px solid rgba(201, 168, 106, 0.26);
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

  @media (max-width: 1360px) {
    .bottom-bar {
      min-height: 80px;
    }

    .content-layer {
      gap: 6px;
    }

    .menu-strip {
      gap: 3px;
    }

    .hotbar-row {
      grid-template-columns: repeat(8, 34px);
      gap: 4px;
    }

    .slot-wrapper {
      width: 34px;
      height: 34px;
    }
  }

  @media (max-width: 1120px) {
    .content-layer {
      gap: 4px;
    }

    .menu-strip {
      gap: 2px;
    }
  }

  @media (max-width: 760px) {
    .bottom-bar {
      min-height: 72px;
    }

    .content-layer {
      bottom: 16px;
      gap: 3px;
    }

    .menu-strip {
      gap: 1px;
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
