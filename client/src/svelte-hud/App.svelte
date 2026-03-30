<script lang="ts">
  import { onMount } from 'svelte';
  import Auth from './Auth.svelte';
  import BuffStrip from './BuffStrip.svelte';
  import CharacterWindow from './CharacterWindow.svelte';
  import Inventory from './Inventory.svelte';
  import SkillsWindow from './SkillsWindow.svelte';
  import MapWindow from './MapWindow.svelte';
  import ChatWindow from './ChatWindow.svelte';
  import MinimapPanel from './MinimapPanel.svelte';
  import MobTargetPanel from './MobTargetPanel.svelte';
  import PlayerTargetPanel from './PlayerTargetPanel.svelte';
  import QuestWindow from './QuestWindow.svelte';
  import PartyWindow from './PartyWindow.svelte';
  import FriendsWindow from './FriendsWindow.svelte';
  import GuildWindow from './GuildWindow.svelte';
  import PetWindow from './PetWindow.svelte';
  import TradeWindow from './TradeWindow.svelte';
  import StorageWindow from './StorageWindow.svelte';
  import AdminWindow from './AdminWindow.svelte';
  import NpcDialogWindow from './NpcDialogWindow.svelte';
  import NotificationsPanel from './NotificationsPanel.svelte';
  import PartyFramesPanel from './PartyFramesPanel.svelte';
  import StatusHud from './StatusHud.svelte';
  import TooltipOverlay from './TooltipOverlay.svelte';
  import ReviveOverlay from './ReviveOverlay.svelte';
  import WorldLoadingOverlay from './WorldLoadingOverlay.svelte';
  import QuestTrackerPanel from './QuestTrackerPanel.svelte';
  import WorldEventsPanel from './WorldEventsPanel.svelte';
  import BottomBar from './BottomBar.svelte';
  import {
    activateHotbarBinding,
    activeEventsStore,
    adminStore,
    appStore,
    attributesStore,
    cancelSkillAim,
    clearCurrentTarget,
    closeAllPanels,
    closeNpcDialog,
    closeStoragePanel,
    closeTradePanel,
    hideTooltip,
    hudTransformStyle,
    loadingStore,
    npcStore,
    panelStore,
    playerBuffsStore,
    playerMetaStore,
    playerStats,
    questTrackerStore,
    selectedMobStore,
    selectedPlayerStore,
    sendUiMessage,
    selectNearestTarget,
    setPvpMode,
    skillAimStore,
    toggleAfk,
    togglePanel,
    worldStore
  } from './stores/gameUi';

  export let enableHud = false;

  let uiHost: HTMLElement | null = null;
  let nextPanelZ = 40;
  let pvpMenuOpen = false;
  let hotkeyPulse: Record<string, boolean> = {};
  let hotbarNow = Date.now();
  const hotkeyTimers = new Map<string, number>();
  const diagnosticParams = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const minimalInGameHud = diagnosticParams.get('diag_ingame_hud') === 'minimal';
  const hideMinimap = diagnosticParams.get('diag_hide_minimap') === '1';
  const hideChat = diagnosticParams.get('diag_hide_chat') === '1';
  const forceDebugHud = diagnosticParams.get('diag_debug_hud') === '1';

  $: inGame = $appStore.connectionPhase === 'in_game';
  $: showAuth = !inGame;
  $: hudReady = inGame && enableHud && $loadingStore.ready;
  $: showHud = hudReady && !minimalInGameHud;
  $: showLoading = inGame && enableHud && $loadingStore.active && !showHud;
  $: showInGameFallback = inGame && enableHud && !showAuth && !showLoading && !showHud;
  $: mapCode = $worldStore.mapCode;
  $: mapId = $worldStore.mapId;
  $: runtimeFlags = [
    `phase:${$appStore.connectionPhase}`,
    `loading:${$loadingStore.active ? 'on' : 'off'}`,
    `ready:${$loadingStore.ready ? 'yes' : 'no'}`,
    `player:${$attributesStore.player ? 'yes' : 'no'}`,
    `map:${mapCode}/${mapId}`,
    `ws:${$adminStore.socketConnected ? 'on' : 'off'}`
  ].join(' | ');
  $: showDebugHud = forceDebugHud;
  $: showPlayerBuffs = $playerBuffsStore.length > 0;
  $: showQuestTracker = $questTrackerStore.length > 0;
  $: showActiveEvents = $activeEventsStore.length > 0;
  $: hasActiveTarget = Boolean($selectedMobStore || $selectedPlayerStore);
  $: hasActiveSkillAim = Boolean($skillAimStore.active);
  $: playerModeLabel = $playerMetaStore.pvpMode === 'peace' ? 'Paz' : $playerMetaStore.pvpMode === 'group' ? 'Grupo' : 'Mal';
  $: playerClassToken = String($playerStats.className || 'knight').toLowerCase();
  $: playerPortraitMark = playerClassToken.slice(0, 1).toUpperCase() || 'A';
  $: playerPrimaryValue = Number($attributesStore.player?.hp || 0);
  $: playerPrimaryMax = Math.max(1, Number($attributesStore.player?.maxHp || 1));
  $: playerPrimaryRatio = Math.max(0, Math.min(1, playerPrimaryValue / playerPrimaryMax));
  $: playerManaValue = Number($attributesStore.player?.mp || $attributesStore.player?.mana || $attributesStore.player?.energy || 0);
  $: playerManaMax = Number($attributesStore.player?.maxMp || $attributesStore.player?.maxMana || $attributesStore.player?.maxEnergy || 0);
  $: playerUsesXpFallback = playerManaMax <= 0 && Number($playerStats.xpToNext || 0) > 0;
  $: playerSecondaryValue = playerUsesXpFallback ? Number($playerStats.xp || 0) : playerManaValue;
  $: playerSecondaryMax = Math.max(1, playerUsesXpFallback ? Number($playerStats.xpToNext || 1) : (playerManaMax || 1));
  $: playerSecondaryDisplayMax = playerUsesXpFallback ? Number($playerStats.xpToNext || 0) : Number(playerManaMax || 0);
  $: playerSecondaryRatio = Math.max(0, Math.min(1, playerSecondaryValue / playerSecondaryMax));
  $: playerSecondaryTone = playerUsesXpFallback ? 'xp' : 'mana';
  $: playerSecondaryLabel = playerUsesXpFallback
    ? `XP ${playerSecondaryValue} / ${playerSecondaryDisplayMax}`
    : `MP ${playerSecondaryValue} / ${playerSecondaryDisplayMax}`;
  $: isNecromancer = playerClassToken === 'necromancer';
  $: graveCharges = Math.max(0, Number($attributesStore.player?.graveCharges || 0));
  $: activeSummonCount = Math.max(0, Number($attributesStore.player?.activeSummonCount || 0));
  $: showPlayerMetaGrid = Boolean($attributesStore.player?.afkActive || isNecromancer);

  function pulseHotkey(key: string) {
    const safeKey = String(key || '').toLowerCase();
    hotkeyPulse = { ...hotkeyPulse, [safeKey]: true };
    const currentTimer = hotkeyTimers.get(safeKey);
    if (currentTimer) window.clearTimeout(currentTimer);
    const timeoutId = window.setTimeout(() => {
      hotkeyTimers.delete(safeKey);
      hotkeyPulse = { ...hotkeyPulse, [safeKey]: false };
    }, 140);
    hotkeyTimers.set(safeKey, timeoutId);
  }

  function handleShortcut(event: KeyboardEvent) {
    if (!showHud) return;
    const key = event.key.toLowerCase();
    if (key === 'escape') {
      event.preventDefault();
      event.stopPropagation();
      if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
      if (hasActiveSkillAim) {
        cancelSkillAim();
        return;
      }
      clearCurrentTarget();
      closeAllPanels();
      hideTooltip();
      pvpMenuOpen = false;
      return;
    }
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    if (event.code === 'Quote' || event.key === "'" || event.key === '"') {
      event.preventDefault();
      selectNearestTarget();
      return;
    }
    if (event.key === '.') {
      event.preventDefault();
      toggleAfk();
      return;
    }
    if (event.code === 'Space') {
      event.preventDefault();
      if (hasActiveSkillAim) return;
      window.dispatchEvent(new CustomEvent('noxis:pickup-nearest-ground-item'));
      return;
    }
    if (['q', 'w', 'e', 'r', 'a', 's', 'd', 'f', '1', '2', '3', '4', '5', '6', '7', '8'].includes(key)) {
      event.preventDefault();
      pulseHotkey(key);
      activateHotbarBinding(key);
      return;
    }
    if (!['b', 'c', 'v', 'm', 'j', 'g', 'o', 'l', 'x', 'h'].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    if (key === 'b') togglePanel('inventory');
    if (key === 'c') togglePanel('character');
    if (key === 'v') togglePanel('skills');
    if (key === 'm') togglePanel('map');
    if (key === 'j') togglePanel('quests');
    if (key === 'g') {
      togglePanel('party');
      sendUiMessage({ type: 'party.requestAreaParties' });
    }
    if (key === 'o') {
      togglePanel('friends');
      sendUiMessage({ type: 'friend.list' });
    }
    if (key === 'l') {
      togglePanel('guild');
      sendUiMessage({ type: 'guild.state' });
    }
    if (key === 'x') togglePanel('pets');
    if (key === 'h' && $adminStore.isAdmin) togglePanel('admin');
  }

  function draggablePanel(node: HTMLElement) {
    let pointerId: number | null = null;
    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;
    const interactiveSelector = 'button, input, textarea, select, a, label, [role="button"], [data-no-drag="true"], [draggable="true"], [contenteditable="true"]';

    const bringToFront = () => {
      node.style.zIndex = String(nextPanelZ);
      nextPanelZ += 1;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      bringToFront();
      if ((event.target as HTMLElement | null)?.closest(interactiveSelector)) return;
      const rect = node.getBoundingClientRect();
      event.preventDefault();
      dragging = true;
      pointerId = event.pointerId;
      node.style.left = `${rect.left}px`;
      node.style.top = `${rect.top}px`;
      node.style.right = 'auto';
      node.style.bottom = 'auto';
      node.style.transform = 'none';
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      node.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || pointerId !== event.pointerId) return;
      event.preventDefault();
      node.style.left = `${Math.round(event.clientX - offsetX)}px`;
      node.style.top = `${Math.round(event.clientY - offsetY)}px`;
    };

    const stopDrag = () => {
      dragging = false;
      pointerId = null;
    };

    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointermove', onPointerMove);
    node.addEventListener('pointerup', stopDrag);
    node.addEventListener('pointercancel', stopDrag);
    node.addEventListener('lostpointercapture', stopDrag);
    return {
      destroy() {
        node.removeEventListener('pointerdown', onPointerDown);
        node.removeEventListener('pointermove', onPointerMove);
        node.removeEventListener('pointerup', stopDrag);
        node.removeEventListener('pointercancel', stopDrag);
        node.removeEventListener('lostpointercapture', stopDrag);
      }
    };
  }

  onMount(() => {
    uiHost = document.getElementById('ui-root');
    uiHost?.classList.add('svelte-ui-mounted');
    window.addEventListener('keydown', handleShortcut, true);
    const hotbarClock = window.setInterval(() => {
      hotbarNow = Date.now();
    }, 100);
    const handleWindowPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('.player-mode-control')) return;
      pvpMenuOpen = false;
    };
    window.addEventListener('pointerdown', handleWindowPointerDown);
    return () => {
      uiHost?.classList.remove('svelte-ui-mounted');
      window.removeEventListener('keydown', handleShortcut, true);
      window.removeEventListener('pointerdown', handleWindowPointerDown);
      window.clearInterval(hotbarClock);
      hotkeyTimers.forEach((timerId) => window.clearTimeout(timerId));
      hotkeyTimers.clear();
    };
  });
</script>

{#if showAuth}
  <Auth />
{:else if showLoading}
  <WorldLoadingOverlay />
{:else if showHud}
  <div class="hud-root" style={$hudTransformStyle}>
    <div class="top-left-zone">
      <section class={`player-unit class-${playerClassToken}`}>
        <div class="player-frame-main">
          <div class="player-portrait-shell">
            <div class="player-portrait-core">{playerPortraitMark}</div>
            <span class="player-level-badge">{$playerStats.level}</span>
          </div>

          <div class="player-frame-body">
            <div class="player-frame-header">
              <div class="player-headline">
                <div class="player-name-row">
                  <div class="player-nameplate">{$attributesStore.player?.name || 'Aventureiro'}</div>
                  <div class="player-mode-control">
                    <button class="player-mode-trigger" type="button" aria-label="Trocar modo PvP" on:click={() => pvpMenuOpen = !pvpMenuOpen}>
                      {playerModeLabel}
                    </button>
                    {#if pvpMenuOpen}
                      <div class="player-pvp-menu">
                        {#each [
                          { id: 'peace', label: 'Paz' },
                          { id: 'group', label: 'Grupo' },
                          { id: 'evil', label: 'Mal' }
                        ] as mode}
                          <button
                            class:active={$playerMetaStore.pvpMode === mode.id}
                            type="button"
                            on:click={() => {
                              setPvpMode(mode.id as 'peace' | 'group' | 'evil');
                              pvpMenuOpen = false;
                            }}
                          >
                            {mode.label}
                          </button>
                        {/each}
                      </div>
                    {/if}
                  </div>
                </div>
              </div>

              <div class="player-status-cluster">
                <span class={`player-status-dot ${$adminStore.socketConnected ? 'active' : ''}`}></span>
                <span class={`player-status-dot ${$loadingStore.ready ? 'active' : ''}`}></span>
                <div class="player-orb"></div>
              </div>
            </div>

            <div class="player-bar-stack">
              <div class="player-bar health">
                <div class="player-bar-fill health-fill" style={`transform: scaleX(${playerPrimaryRatio});`}></div>
                <span>HP {playerPrimaryValue} / {playerPrimaryMax}</span>
              </div>

              <div class={`player-bar ${playerSecondaryTone}`}>
                <div class={`player-bar-fill ${playerSecondaryTone}-fill`} style={`transform: scaleX(${playerSecondaryRatio});`}></div>
                <span>{playerSecondaryLabel}</span>
              </div>
            </div>
          </div>
        </div>

        {#if showPlayerMetaGrid}
          <div class="player-meta-grid">
            {#if $attributesStore.player?.afkActive}
              <span class="hud-pill">AFK</span>
            {/if}
            {#if isNecromancer}
              <span class="hud-pill arcane">Grave {graveCharges}/10</span>
              <span class="hud-pill arcane">Invoc. {activeSummonCount}</span>
            {/if}
          </div>
        {/if}
      </section>

      {#if showPlayerBuffs}
        <BuffStrip title="Beneficios ativos" effects={$playerBuffsStore} emptyLabel="Sem buffs relevantes." />
      {/if}
    </div>

    {#if hasActiveTarget}
      <div class="combat-center">
        <div class="target-stack compact">
          <PlayerTargetPanel />
          <MobTargetPanel />
        </div>
      </div>
    {/if}

    <div class="left-zone">
      <div class="left-top-stack">
        <NotificationsPanel />
        <PartyFramesPanel />
      </div>
      {#if !hideChat}
        <div class="chat-zone">
          <ChatWindow fixed showClose={false} showCollapse={false} />
        </div>
      {/if}
    </div>

    <div class="right-zone">
      {#if !hideMinimap}
        <div class="minimap-zone">
          <MinimapPanel fixed showClose={false} />
        </div>
      {/if}
      {#if showQuestTracker}
        <QuestTrackerPanel />
      {/if}
      {#if showActiveEvents}
        <WorldEventsPanel />
      {/if}
    </div>

    <div class="bottom-hud">
      <BottomBar {hotkeyPulse} {hotbarNow} />
    </div>

    {#if $panelStore.character}
      <div class="window-wrap character-wrap" use:draggablePanel>
        <CharacterWindow on:close={() => togglePanel('character')} />
      </div>
    {/if}

    {#if $panelStore.inventory}
      <div class="window-wrap inventory-wrap" use:draggablePanel>
        <Inventory on:close={() => togglePanel('inventory')} />
      </div>
    {/if}

    {#if $panelStore.skills}
      <div class="window-wrap skills-wrap" use:draggablePanel>
        <SkillsWindow on:close={() => togglePanel('skills')} />
      </div>
    {/if}

    {#if $panelStore.map}
      <div class="window-wrap map-wrap" use:draggablePanel>
        <MapWindow on:close={() => togglePanel('map')} />
      </div>
    {/if}

    {#if $panelStore.quests}
      <div class="window-wrap quests-wrap" use:draggablePanel>
        <QuestWindow on:close={() => togglePanel('quests')} />
      </div>
    {/if}

    {#if $panelStore.party}
      <div class="window-wrap party-wrap" use:draggablePanel>
        <PartyWindow on:close={() => togglePanel('party')} />
      </div>
    {/if}

    {#if $panelStore.friends}
      <div class="window-wrap friends-wrap" use:draggablePanel>
        <FriendsWindow on:close={() => togglePanel('friends')} />
      </div>
    {/if}

    {#if $panelStore.guild}
      <div class="window-wrap guild-wrap" use:draggablePanel>
        <GuildWindow on:close={() => togglePanel('guild')} />
      </div>
    {/if}

    {#if $panelStore.pets}
      <div class="window-wrap pets-wrap" use:draggablePanel>
        <PetWindow on:close={() => togglePanel('pets')} />
      </div>
    {/if}

    {#if $panelStore.trade}
      <div class="window-wrap trade-wrap" use:draggablePanel>
        <TradeWindow on:close={closeTradePanel} />
      </div>
    {/if}

    {#if $panelStore.storage}
      <div class="window-wrap storage-wrap" use:draggablePanel>
        <StorageWindow on:close={closeStoragePanel} />
      </div>
    {/if}

    {#if $panelStore.admin && $adminStore.isAdmin}
      <div class="window-wrap admin-wrap" use:draggablePanel>
        <AdminWindow on:close={() => togglePanel('admin')} />
      </div>
    {/if}

    {#if $npcStore.dialog}
      <div class="window-wrap npc-wrap" use:draggablePanel>
        <NpcDialogWindow on:close={closeNpcDialog} />
      </div>
    {/if}

    {#if showDebugHud}
      <div class="debug-zone">
        <StatusHud />
      </div>
    {/if}

    <ReviveOverlay />
    <TooltipOverlay />
  </div>
{:else if showInGameFallback}
  <div class="hud-fallback-debug" style={$hudTransformStyle}>
    <div class="hud-fallback-card">
      <div class="hud-fallback-title">{minimalInGameHud ? 'HUD reduzida para diagnostico' : 'HUD em estado intermediario'}</div>
      <div class="hud-fallback-copy">
        {#if minimalInGameHud}
          A autenticacao terminou e a HUD principal foi omitida por `diag_ingame_hud=minimal`.
        {:else}
          A autenticacao terminou, mas a interface principal ainda nao foi liberada.
        {/if}
      </div>
      <div class="hud-fallback-flags">{runtimeFlags}</div>
    </div>
  </div>
{/if}

<style>
  :global(:root) {
    --hud-left-reserve: 324px;
    --bottom-hud-width: min(980px, calc(100vw - 72px), calc(100vw - var(--hud-left-reserve) - 48px));
    --xp-bar-top: 26px;
    --hud-menu-top: 104px;
    --hud-skill-top: 104px;
    --hud-bottom-bar-height: 132px;
    --hud-responsive-scale: 1;
  }

  .hud-root {
    position: fixed;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    transform-origin: top center;
    padding: 12px;
  }

  .hud-root > * {
    pointer-events: auto;
  }

  .top-left-zone,
  .combat-center,
  .left-zone,
  .right-zone,
  .bottom-hud,
  .debug-zone {
    position: absolute;
  }

  .top-left-zone {
    top: 12px;
    left: 12px;
    width: min(332px, calc(100vw - 24px));
    display: grid;
    gap: 6px;
    z-index: 15;
  }

  .combat-center {
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    width: min(238px, calc(100vw - 700px));
    padding: 0;
    display: grid;
    gap: 6px;
    z-index: 15;
    pointer-events: none;
  }

  .left-zone {
    left: 12px;
    bottom: 12px;
    width: min(320px, calc(100vw - 24px));
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 6px;
    max-height: calc(100vh - var(--hud-menu-top, 146px) - 18px);
    pointer-events: none;
    z-index: 10;
  }

  .left-top-stack {
    display: grid;
    gap: 8px;
    align-content: end;
    overflow: auto;
    padding-right: 2px;
    pointer-events: auto;
  }

  .chat-zone {
    padding-bottom: 8px;
    pointer-events: none;
  }

  .right-zone {
    top: 12px;
    right: 12px;
    width: min(248px, calc(100vw - 24px));
    display: grid;
    gap: 6px;
    align-content: start;
    z-index: 15;
  }

  .bottom-hud {
    left: max(50%, calc(var(--hud-left-reserve) + 24px + (var(--bottom-hud-width) / 2)));
    bottom: 12px;
    transform: translateX(-50%);
    width: var(--bottom-hud-width);
    max-width: var(--bottom-hud-width);
    padding: 0;
    display: grid;
    justify-items: center;
    gap: 6px;
    z-index: 20;
  }

  .player-unit {
    padding: 8px 10px 10px;
    border: 1px solid rgba(215, 188, 129, 0.52);
    border-radius: 18px;
    background:
      radial-gradient(circle at top left, rgba(255, 255, 255, 0.08), transparent 34%),
      linear-gradient(180deg, rgba(41, 29, 17, 0.96), rgba(8, 8, 10, 0.98));
    box-shadow:
      inset 0 1px 0 rgba(255, 233, 188, 0.14),
      inset 0 0 0 1px rgba(85, 62, 30, 0.82),
      0 14px 26px rgba(0, 0, 0, 0.28);
    display: grid;
    gap: 8px;
  }

  .player-unit.class-knight {
    --player-accent: #5ea8ff;
    --player-accent-soft: #c6e3ff;
    --player-portrait-bg: linear-gradient(180deg, #426ca9, #121b2d 88%);
  }

  .player-unit.class-archer {
    --player-accent: #7dd4ff;
    --player-accent-soft: #d9f5ff;
    --player-portrait-bg: linear-gradient(180deg, #5a4b9e, #1c1833 88%);
  }

  .player-unit.class-druid {
    --player-accent: #72d8b4;
    --player-accent-soft: #dbfff3;
    --player-portrait-bg: linear-gradient(180deg, #3a7f61, #11221d 88%);
  }

  .player-unit.class-assassin {
    --player-accent: #e786be;
    --player-accent-soft: #fde4f3;
    --player-portrait-bg: linear-gradient(180deg, #73466c, #1c111b 88%);
  }

  .player-unit.class-necromancer {
    --player-accent: #aa8fff;
    --player-accent-soft: #efe6ff;
    --player-portrait-bg: linear-gradient(180deg, #5d4692, #171127 88%);
  }

  .player-frame-main {
    display: grid;
    grid-template-columns: 72px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
  }

  .player-portrait-shell {
    position: relative;
    width: 70px;
    height: 70px;
    padding: 3px;
    border-radius: 18px 18px 14px 14px;
    border: 1px solid rgba(233, 214, 169, 0.58);
    background:
      linear-gradient(180deg, rgba(74, 53, 27, 0.98), rgba(24, 17, 11, 0.98));
    box-shadow:
      inset 0 0 0 1px rgba(85, 61, 29, 0.88),
      0 8px 16px rgba(0, 0, 0, 0.24);
  }

  .player-portrait-core {
    width: 100%;
    height: 100%;
    border-radius: 14px 14px 10px 10px;
    display: grid;
    place-items: center;
    background:
      radial-gradient(circle at 45% 22%, rgba(255, 255, 255, 0.28), transparent 30%),
      var(--player-portrait-bg, linear-gradient(180deg, #52637b, #11141a 88%));
    color: var(--player-accent-soft, #ecf5ff);
    font-family: var(--hud-font-display);
    font-size: 1.5rem;
    text-transform: uppercase;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.82);
  }

  .player-level-badge {
    position: absolute;
    left: -8px;
    bottom: -7px;
    min-width: 26px;
    height: 26px;
    padding: 0 7px;
    border-radius: 999px;
    border: 1px solid rgba(236, 220, 173, 0.62);
    background: linear-gradient(180deg, #2f2313, #0b0909);
    color: #f6e3bc;
    font-weight: 700;
    font-size: 0.8rem;
    display: grid;
    place-items: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.34);
  }

  .player-frame-body {
    min-width: 0;
    display: grid;
    gap: 4px;
  }

  .player-frame-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .player-headline {
    min-width: 0;
    flex: 1 1 auto;
  }

  .player-name-row {
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 7px;
  }

  .player-nameplate {
    min-width: 0;
    flex: 1 1 auto;
    color: #fff5e6;
    font-family: var(--hud-font-display);
    font-size: 0.88rem;
    text-shadow: 0 1px 3px rgba(0, 0, 0, 0.82);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .player-mode-control {
    position: relative;
    flex-shrink: 0;
  }

  .player-mode-trigger {
    min-height: 22px;
    padding: 0 9px;
    border-radius: 999px;
    border: 1px solid rgba(220, 194, 130, 0.34);
    background: rgba(18, 16, 16, 0.78);
    color: rgba(249, 235, 191, 0.9);
    font-family: var(--hud-font-display);
    font-size: 0.58rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    box-shadow: inset 0 1px 0 rgba(255, 236, 193, 0.08);
  }

  .player-mode-trigger:hover {
    border-color: rgba(242, 211, 139, 0.5);
    color: #fff3cd;
  }

  .player-status-cluster {
    display: flex;
    align-items: center;
    gap: 5px;
    flex-shrink: 0;
  }

  .player-status-dot {
    width: 8px;
    height: 8px;
    border-radius: 999px;
    border: 1px solid rgba(218, 236, 188, 0.42);
    background: rgba(39, 64, 29, 0.48);
    box-shadow: inset 0 0 0 1px rgba(8, 13, 9, 0.5);
  }

  .player-status-dot.active {
    background: radial-gradient(circle at 35% 35%, #cbff87, #26bc38);
    box-shadow: 0 0 10px rgba(111, 230, 111, 0.42);
  }

  .player-orb {
    width: 28px;
    height: 28px;
    margin-left: 3px;
    border-radius: 999px;
    border: 1px solid rgba(223, 207, 160, 0.58);
    background:
      radial-gradient(circle at 35% 30%, rgba(255, 255, 255, 0.48), transparent 24%),
      radial-gradient(circle at 50% 55%, color-mix(in srgb, var(--player-accent, #77bbff) 58%, transparent), rgba(24, 40, 58, 0.88) 62%),
      linear-gradient(180deg, rgba(47, 67, 93, 0.98), rgba(8, 13, 17, 0.98));
    box-shadow:
      inset 0 0 0 1px rgba(46, 63, 83, 0.92),
      0 0 14px color-mix(in srgb, var(--player-accent, #77bbff) 34%, transparent);
  }

  .player-bar-stack {
    display: grid;
    gap: 3px;
  }

  .player-bar {
    position: relative;
    height: 13px;
    overflow: hidden;
    border-radius: 999px;
    border: 1px solid rgba(229, 209, 156, 0.34);
    background:
      linear-gradient(180deg, rgba(18, 16, 18, 0.96), rgba(5, 5, 6, 0.98));
    box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.48);
  }

  .player-bar-fill {
    position: absolute;
    inset: 0;
    transform-origin: left center;
  }

  .health-fill {
    background: linear-gradient(90deg, #7d120f, #d3312a 58%, #ef9c57);
  }

  .mana-fill {
    background: linear-gradient(90deg, #214d89, #488af3 56%, #9ce5ff);
  }

  .xp-fill {
    background: linear-gradient(90deg, #7e5a14, #d39d29 54%, #f3d986);
  }

  .player-bar::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.18), transparent 58%);
    pointer-events: none;
  }

  .player-bar span {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 0.56rem;
    color: #fbf3e1;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.82);
    letter-spacing: 0.02em;
  }

  .player-pvp-menu {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    min-width: 112px;
    padding: 8px;
    border-radius: 12px;
    border: 1px solid rgba(201, 168, 106, 0.22);
    background: rgba(8, 10, 14, 0.96);
    box-shadow: 0 16px 28px rgba(0, 0, 0, 0.34);
    display: grid;
    gap: 8px;
    z-index: 5;
  }

  .player-pvp-menu button {
    min-height: 28px;
    border-radius: 8px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(16, 19, 24, 0.92);
    color: var(--hud-gold);
    font-family: var(--hud-font-display);
    font-size: 0.64rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .player-pvp-menu button.active {
    border-color: rgba(201, 168, 106, 0.42);
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.12), 0 0 16px rgba(201, 168, 106, 0.12);
  }

  .player-meta-grid {
    flex-wrap: wrap;
  }

  .player-meta-grid {
    display: flex;
    align-items: center;
    gap: 6px;
    justify-content: flex-end;
  }

  .target-stack {
    display: grid;
    gap: 6px;
    pointer-events: auto;
  }

  .window-wrap,
  .npc-wrap,
  .debug-zone {
    pointer-events: auto;
  }

  .window-wrap {
    position: absolute;
    z-index: 40;
  }

  .character-wrap { top: 92px; left: 146px; }
  .inventory-wrap { top: 118px; left: 212px; }
  .skills-wrap { top: 84px; left: 286px; }
  .map-wrap { top: 110px; left: 360px; }
  .quests-wrap { top: 142px; right: 352px; }
  .party-wrap { top: 166px; right: 280px; }
  .friends-wrap { top: 196px; right: 212px; }
  .guild-wrap { top: 132px; right: 430px; }
  .pets-wrap { top: 114px; right: 520px; }
  .trade-wrap { bottom: 150px; left: 50%; transform: translateX(-50%); }
  .storage-wrap { top: 140px; left: 50%; transform: translateX(-50%); }
  .admin-wrap { top: 74px; right: 40px; }
  .npc-wrap { top: 108px; left: 50%; transform: translateX(-50%); }

  .debug-zone {
    right: 12px;
    bottom: 12px;
    z-index: 25;
  }

  .hud-fallback-debug {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: start center;
    padding-top: 20px;
    pointer-events: none;
    transform-origin: top center;
  }

  .hud-fallback-card {
    width: min(560px, calc(100vw - 32px));
    padding: 14px 16px;
    border: 1px solid rgba(201, 168, 106, 0.32);
    background: linear-gradient(180deg, rgba(17, 15, 12, 0.97), rgba(8, 8, 8, 0.98));
    color: #f1e5c8;
    border-radius: 16px;
    box-shadow: 0 18px 34px rgba(0, 0, 0, 0.28);
  }

  .hud-fallback-title {
    font-family: var(--hud-font-display);
    font-size: 0.88rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #f0dfbc;
  }

  .hud-fallback-copy {
    margin-top: 6px;
    font-size: 0.82rem;
    color: rgba(233, 223, 200, 0.78);
  }

  .hud-fallback-flags {
    margin-top: 10px;
    font-size: 0.72rem;
    color: rgba(214, 201, 173, 0.72);
    letter-spacing: 0.03em;
  }

  @media (max-width: 1440px) {
    .combat-center {
      width: min(232px, calc(100vw - 590px));
    }

    .top-left-zone {
      width: 300px;
    }

    .right-zone {
      width: 236px;
    }

    .left-zone {
      width: 304px;
    }
  }

  @media (max-width: 1180px) {
    :global(:root) {
      --hud-responsive-scale: clamp(0.72, calc(100vw / 1180), 1);
    }

    .hud-root {
      padding: 10px;
    }

    .top-left-zone,
    .combat-center,
    .left-zone,
    .right-zone,
    .bottom-hud,
    .debug-zone {
      position: absolute;
    }

    .top-left-zone {
      top: 10px;
      left: 10px;
      width: min(284px, calc(100vw - 20px));
    }

    .combat-center {
      top: 10px;
    }

    .left-zone {
      left: 10px;
      bottom: 10px;
    }

    .right-zone {
      top: 10px;
      right: 10px;
    }

    .bottom-hud {
      bottom: 10px;
    }

    .debug-zone {
      right: 10px;
      bottom: 10px;
    }

    .window-wrap,
    .npc-wrap {
      position: fixed;
      left: 50% !important;
      right: auto !important;
      top: 70px !important;
      transform: translateX(-50%) !important;
      z-index: 60;
    }
  }

  @media (max-width: 760px) {
    .player-frame-main {
      grid-template-columns: 58px minmax(0, 1fr);
      gap: 8px;
    }

    .player-portrait-shell {
      width: 56px;
      height: 56px;
    }

    .player-level-badge {
      min-width: 22px;
      height: 22px;
      font-size: 0.7rem;
    }

    .player-frame-header {
      align-items: flex-start;
    }

    .player-meta-grid {
      justify-content: flex-start;
    }
  }

</style>
