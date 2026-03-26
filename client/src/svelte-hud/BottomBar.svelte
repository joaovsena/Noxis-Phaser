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
    hideTooltip,
    hotbarBindingsStore,
    hotbarSlots,
    panelStore,
    playerStats,
    sendUiMessage,
    setHotbarBinding,
    showTooltip,
    skillsStore,
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

  function formatSeconds(ms: number) {
    const safe = Math.max(0, Number(ms || 0));
    if (!safe) return 'Instantaneo';
    return `${safe >= 10000 ? Math.round(safe / 1000) : (safe / 1000).toFixed(1)}s`;
  }

  function castModeLabel(mode: string | null | undefined) {
    switch (String(mode || 'direct')) {
      case 'ground':
        return 'Area no chao';
      case 'self_aoe':
        return 'Area ao redor';
      case 'cone':
        return 'Cone frontal';
      case 'line':
        return 'Linha';
      case 'summon':
        return 'Invocacao';
      default:
        return 'Alvo unico';
    }
  }

  function impactLabel(entry: any, isBasicAttack: boolean) {
    if (isBasicAttack) return 'Dano basico continuo';
    const role = String(entry?.role || '');
    const mode = String(entry?.castMode || 'direct');
    if (role === 'Cura') return 'Cura e sustain';
    if (role === 'Buff') return 'Fortalecimento utilitario';
    if (role === 'Controle') return mode === 'ground' ? 'Controle de area' : 'Controle de alvo';
    if (role === 'Execucao') return 'Dano alto contra alvo ferido';
    if (role === 'Area') {
      if (mode === 'self_aoe') return 'Dano em area ao redor';
      if (mode === 'ground') return 'Dano em area no ponto alvo';
      if (mode === 'cone') return 'Dano em cone frontal';
      if (mode === 'line') return 'Dano em linha';
      return 'Dano em area';
    }
    return mode === 'direct' ? 'Dano direto no alvo' : 'Dano ofensivo';
  }

  function inspectHotbarSkill(slot: any, x: number, y: number) {
    const skillId = String(slot?.skillId || '');
    if (!skillId) {
      hideTooltip();
      return;
    }
    const entry = $skillsStore.entries.find((candidate) => candidate.id === skillId) || null;
    const isBasicAttack = String(slot?.binding?.actionId || '') === 'basic_attack' || skillId === 'class_primary';
    const payload = {
      kind: 'skill',
      id: skillId,
      label: String(entry?.label || slot?.label || (isBasicAttack ? 'Ataque Basico' : 'Habilidade')),
      iconUrl: String(entry?.iconUrl || slot?.iconUrl || ''),
      summary: String(
        entry?.summary
          || (isBasicAttack
            ? 'Ataque principal da classe usado para manter pressao basica quando nao ha outra habilidade melhor.'
            : 'Sem descricao.')
      ),
      role: String(entry?.role || (isBasicAttack ? 'Ataque' : 'Habilidade')),
      impactText: impactLabel(entry, isBasicAttack),
      level: Math.max(0, Number(entry?.level || (isBasicAttack ? 1 : 0))),
      maxPoints: Math.max(1, Number(entry?.maxPoints || 1)),
      cooldownMs: Math.max(0, Number(slot?.cooldownMs || entry?.cooldownMs || 0)),
      castTimeMs: 0,
      castMode: String(entry?.castMode || 'direct'),
      castModeLabel: castModeLabel(entry?.castMode || 'direct'),
      range: Math.max(0, Number(entry?.range || (isBasicAttack ? 100 : 0))),
      aoeRadius: Math.max(0, Number(entry?.aoeRadius || 0)),
      coneAngleDeg: Math.max(0, Number(entry?.coneAngleDeg || 0)),
      lineLength: Math.max(0, Number(entry?.lineLength || 0)),
      lineWidth: Math.max(0, Number(entry?.lineWidth || 0)),
      autoAttackEligible: Boolean(entry?.autoAttackEligible || isBasicAttack),
      cooldownLabel: formatSeconds(Number(slot?.cooldownMs || entry?.cooldownMs || 0)),
      castTimeLabel: 'Instantaneo'
    };
    showTooltip(payload, x, y);
  }

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

  function handleHotbarDragEnd(slotKey: string, event: CustomEvent<{ x: number; y: number }>) {
    if (!bottomBarEl) return;
    const rect = bottomBarEl.getBoundingClientRect();
    const x = Number(event.detail?.x || 0);
    const y = Number(event.detail?.y || 0);
    if (!x && !y) return;
    const withinBar = x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
    if (!withinBar) clearHotbarBinding(slotKey);
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
      <div class="hotbar-shell">
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
                on:dragend={(event) => handleHotbarDragEnd(slot.key, event)}
                on:contextaction={() => slot.binding && clearHotbarBinding(slot.key)}
                on:inspect={(event) => inspectHotbarSkill(slot, event.detail.x, event.detail.y)}
                on:inspectend={hideTooltip}
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
                on:dragend={(event) => handleHotbarDragEnd(slot.key, event)}
                on:contextaction={() => slot.binding && clearHotbarBinding(slot.key)}
                on:inspect={(event) => inspectHotbarSkill(slot, event.detail.x, event.detail.y)}
                on:inspectend={hideTooltip}
              />
            </div>
          {/each}
        </div>
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
    min-height: 154px;
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
    bottom: 44px;
    transform: translateX(-50%);
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
    align-items: flex-end;
    gap: 16px;
    width: 100%;
    max-width: 100%;
    z-index: 25;
  }

  .menu-strip {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    padding: 0;
    pointer-events: auto;
  }

  .menu-strip.left {
    justify-content: flex-end;
    justify-self: end;
  }

  .menu-strip.right {
    justify-content: flex-start;
    justify-self: start;
  }

  .xp-layer {
    left: 50%;
    bottom: -18px;
    transform: translateX(-50%);
    width: max(260px, min(560px, calc(100% - 220px)));
    z-index: 20;
    pointer-events: none;
    display: grid;
    justify-items: center;
    gap: 1px;
  }

  .xp-line {
    position: relative;
    width: 100%;
    height: 16px;
    overflow: hidden;
    border-radius: 999px;
    border: 1px solid rgba(201, 168, 106, 0.34);
    background:
      radial-gradient(circle at top, rgba(255, 251, 234, 0.08), transparent 44%),
      linear-gradient(180deg, rgba(49, 36, 18, 0.96), rgba(14, 11, 8, 0.98));
    box-shadow:
      0 10px 22px rgba(0, 0, 0, 0.2),
      inset 0 1px 0 rgba(255, 243, 215, 0.08),
      inset 0 0 0 1px rgba(88, 62, 26, 0.48);
  }

  .xp-line-fill {
    width: 100%;
    height: 100%;
    transform-origin: left center;
    background: linear-gradient(90deg, rgba(141, 55, 255, 0.96), rgba(214, 87, 242, 0.98) 55%, rgba(255, 191, 239, 0.94));
  }

  .xp-readout,
  .map-readout {
    position: relative;
    bottom: auto;
    color: rgba(243, 226, 187, 0.9);
    font-family: var(--hud-font-display);
    font-size: 0.58rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9);
  }

  .xp-readout {
    left: auto;
    transform: none;
  }

  .map-readout {
    right: auto;
    opacity: 0.84;
  }

  .hotbar-cluster {
    display: grid;
    justify-items: center;
    justify-self: center;
    padding: 0;
    pointer-events: auto;
    z-index: 30;
  }

  .hotbar-shell {
    display: grid;
    gap: 5px;
  }

  .hotbar-row {
    display: grid;
    grid-template-columns: repeat(8, 36px);
    gap: 5px;
  }

  .slot-wrapper {
    width: 36px;
    height: 36px;
    display: grid;
    place-items: center;
  }

  @media (max-width: 1360px) {
    .bottom-bar {
      min-height: 146px;
    }

    .action-layer {
      bottom: 40px;
      gap: 10px;
    }
  }

  @media (max-width: 1120px) {
    .bottom-bar {
      min-height: 138px;
    }

    .action-layer {
      bottom: 34px;
      gap: 8px;
    }

    .hotbar-row {
      grid-template-columns: repeat(8, 34px);
      gap: 4px;
    }

    .slot-wrapper {
      width: 34px;
      height: 34px;
    }

    .menu-strip {
      gap: 4px;
    }
  }

  @media (max-width: 760px) {
    .bottom-bar {
      min-height: 124px;
    }

    .action-layer {
      bottom: 28px;
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

    .xp-layer {
      bottom: -14px;
      width: min(360px, calc(100% - 80px));
    }
  }
</style>
