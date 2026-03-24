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
  import ProgressBar from './components/ProgressBar.svelte';
  import {
    activateHotbarBinding,
    activeEventsStore,
    adminStore,
    appStore,
    attributesStore,
    closeAllPanels,
    closeNpcDialog,
    combatContextStore,
    friendStore,
    hideTooltip,
    hudTransformStyle,
    loadingStore,
    npcStore,
    panelStore,
    partyStore,
    playerBuffsStore,
    playerMetaStore,
    playerStats,
    questTrackerStore,
    returnToCharacterSelect,
    selectedMobStore,
    selectedPlayerStore,
    sendUiMessage,
    selectNearestTarget,
    setPvpMode,
    targetBuffsStore,
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
  $: pendingSocialCount =
    ($partyStore.invites?.length || 0)
    + ($partyStore.joinRequests?.length || 0)
    + (Array.isArray($friendStore.state?.incoming) ? $friendStore.state.incoming.length : 0)
    + ($partyStore.dungeonReady ? 1 : 0);
  $: showDebugHud = forceDebugHud;
  $: showPlayerBuffs = $playerBuffsStore.length > 0;
  $: showTargetBuffs = $targetBuffsStore.length > 0;
  $: showQuestTracker = $questTrackerStore.length > 0;
  $: showActiveEvents = $activeEventsStore.length > 0;
  $: hasActiveTarget = Boolean($selectedMobStore || $selectedPlayerStore);

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
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    const key = event.key.toLowerCase();
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
    if (['q', 'w', 'e', 'r', 'a', 's', 'd', 'f', '1', '2', '3', '4', '5', '6', '7', '8'].includes(key)) {
      event.preventDefault();
      pulseHotkey(key);
      activateHotbarBinding(key);
      return;
    }
    if (!['b', 'c', 'v', 'm', 'j', 'g', 'o', 'l', 'h', 'escape'].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    if (key === 'escape') {
      closeAllPanels();
      hideTooltip();
      pvpMenuOpen = false;
      return;
    }
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
    if (key === 'l') togglePanel('guild');
    if (key === 'h' && $adminStore.isAdmin) togglePanel('admin');
  }

  function draggablePanel(node: HTMLElement) {
    let pointerId: number | null = null;
    let offsetX = 0;
    let offsetY = 0;
    let dragging = false;

    const header = node.querySelector<HTMLElement>('[data-window-drag-handle="true"]');
    if (!header) return { destroy() {} };

    const bringToFront = () => {
      node.style.zIndex = String(nextPanelZ);
      nextPanelZ += 1;
    };

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      if ((event.target as HTMLElement | null)?.closest('button, input, textarea, select, a')) return;
      const rect = node.getBoundingClientRect();
      event.preventDefault();
      dragging = true;
      pointerId = event.pointerId;
      bringToFront();
      node.style.left = `${rect.left}px`;
      node.style.top = `${rect.top}px`;
      node.style.right = 'auto';
      node.style.bottom = 'auto';
      node.style.transform = 'none';
      offsetX = event.clientX - rect.left;
      offsetY = event.clientY - rect.top;
      header.setPointerCapture?.(event.pointerId);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!dragging || pointerId !== event.pointerId) return;
      event.preventDefault();
      node.style.left = `${Math.max(8, Math.min(window.innerWidth - node.offsetWidth - 8, event.clientX - offsetX))}px`;
      node.style.top = `${Math.max(8, Math.min(window.innerHeight - node.offsetHeight - 8, event.clientY - offsetY))}px`;
    };

    const stopDrag = () => {
      dragging = false;
      pointerId = null;
    };

    header.addEventListener('pointerdown', onPointerDown);
    header.addEventListener('pointermove', onPointerMove);
    header.addEventListener('pointerup', stopDrag);
    header.addEventListener('pointercancel', stopDrag);
    header.addEventListener('lostpointercapture', stopDrag);
    node.addEventListener('pointerdown', bringToFront);

    return {
      destroy() {
        header.removeEventListener('pointerdown', onPointerDown);
        header.removeEventListener('pointermove', onPointerMove);
        header.removeEventListener('pointerup', stopDrag);
        header.removeEventListener('pointercancel', stopDrag);
        header.removeEventListener('lostpointercapture', stopDrag);
        node.removeEventListener('pointerdown', bringToFront);
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
      if (target?.closest('.player-actions')) return;
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
      <section class="player-unit hud-section">
        <div class="player-head">
          <div class="player-identity">
            <div class="hud-kicker">Personagem</div>
            <div class="player-name">{$attributesStore.player?.name || 'Aventureiro'}</div>
            <div class="player-subtitle">
              <span>{$playerStats.className}</span>
              <span>Nv. {$playerStats.level}</span>
              <span>{$playerMetaStore.currentInstance}</span>
            </div>
          </div>

          <div class="player-actions">
            <button class="hud-btn mini ghost" type="button" on:click={returnToCharacterSelect}>Trocar</button>
            <button class="hud-btn mini" type="button" on:click={() => pvpMenuOpen = !pvpMenuOpen}>
              PvP {$playerMetaStore.pvpMode === 'peace' ? 'Paz' : $playerMetaStore.pvpMode === 'group' ? 'Grupo' : 'Mal'}
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

        <ProgressBar
          value={$attributesStore.player?.hp || 0}
          max={$attributesStore.player?.maxHp || 1}
          label={`HP ${$attributesStore.player?.hp || 0} / ${$attributesStore.player?.maxHp || 0}`}
          tone="health"
        />

        <div class="player-meta-row">
          <div class="player-meta-grid">
            {#if $playerStats.unspentPoints > 0}
              <span class="hud-pill warning">Atributos {$playerStats.unspentPoints}</span>
            {/if}
            {#if Number($attributesStore.player?.skillPointsAvailable || 0) > 0}
              <span class="hud-pill positive">Skills {Number($attributesStore.player?.skillPointsAvailable || 0)}</span>
            {/if}
            {#if $attributesStore.player?.afkActive}
              <span class="hud-pill">AFK</span>
            {/if}
          </div>
        </div>
      </section>

      {#if showPlayerBuffs}
        <BuffStrip title="Beneficios ativos" effects={$playerBuffsStore} emptyLabel="Sem buffs relevantes." />
      {/if}
    </div>

    {#if hasActiveTarget}
      <section class="combat-center hud-section">
        <div class="combat-head compact">
          <div>
            <div class="hud-kicker">Alvo atual</div>
            <div class="hud-title">Combate</div>
          </div>
          <div class="combat-pills">
            <span class={`hud-pill ${$combatContextStore.inRange ? 'positive' : 'warning'}`}>
              Alcance {Math.round($combatContextStore.targetDistance)}/{Math.round($combatContextStore.preferredRange)}
            </span>
            {#if pendingSocialCount > 0}
              <span class="hud-pill warning">Solicitacoes {pendingSocialCount}</span>
            {/if}
          </div>
        </div>

        <div class="target-stack">
          <PlayerTargetPanel />
          <MobTargetPanel />
        </div>

        {#if showTargetBuffs}
          <div class="target-buffs">
            <BuffStrip title="Efeitos no alvo" effects={$targetBuffsStore} emptyLabel="Sem efeitos observados." />
          </div>
        {/if}
      </section>
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
  .hud-root {
    position: fixed;
    inset: 0;
    pointer-events: none;
    transform-origin: center center;
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
    width: min(264px, calc(100vw - 24px));
    display: grid;
    gap: 6px;
  }

  .combat-center {
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    width: min(244px, calc(100vw - 660px));
    padding: 10px 12px;
    display: grid;
    gap: 8px;
  }

  .left-zone {
    left: 12px;
    bottom: 12px;
    width: min(300px, calc(100vw - 24px));
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    gap: 6px;
    max-height: calc(100vh - 228px);
  }

  .left-top-stack {
    display: grid;
    gap: 8px;
    align-content: end;
    overflow: auto;
    padding-right: 2px;
  }

  .right-zone {
    top: 12px;
    right: 12px;
    width: min(248px, calc(100vw - 24px));
    display: grid;
    gap: 6px;
    align-content: start;
  }

  .bottom-hud {
    left: 50%;
    bottom: 12px;
    transform: translateX(-50%);
    width: min(940px, calc(100vw - 72px));
    max-width: min(940px, calc(100vw - 72px));
    padding: 0;
    display: grid;
    justify-items: center;
    gap: 6px;
  }

  .player-head,
  .combat-head,
  .player-meta-row,
  .player-subtitle,
  .combat-pills,
  .xp-head,
  .dock-label-row,
  .actionbar-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .player-head {
    align-items: flex-start;
    margin-bottom: 8px;
  }

  .player-unit {
    padding: 10px 12px;
  }

  .player-identity {
    min-width: 0;
    display: grid;
    gap: 4px;
  }

  .player-actions {
    position: relative;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .player-pvp-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    min-width: 150px;
    padding: 10px;
    border-radius: 14px;
    border: 1px solid rgba(201, 168, 106, 0.22);
    background: rgba(8, 10, 14, 0.96);
    box-shadow: 0 16px 28px rgba(0, 0, 0, 0.34);
    display: grid;
    gap: 8px;
    z-index: 5;
  }

  .player-pvp-menu button {
    min-height: 34px;
    border-radius: 10px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(16, 19, 24, 0.92);
    color: var(--hud-gold);
    font-family: var(--hud-font-display);
    text-transform: uppercase;
  }

  .player-pvp-menu button.active {
    border-color: rgba(201, 168, 106, 0.42);
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.12), 0 0 16px rgba(201, 168, 106, 0.12);
  }

  .player-name {
    font-family: var(--hud-font-display);
    color: var(--hud-gold);
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: 0.84rem;
  }

  .player-subtitle,
  .combat-pills,
  .player-meta-grid {
    flex-wrap: wrap;
  }

  .player-subtitle {
    color: var(--hud-text-soft);
    font-size: 0.62rem;
    text-transform: uppercase;
    justify-content: flex-start;
  }

  .player-meta-row {
    margin-top: 8px;
    align-items: start;
  }

  .player-meta-grid {
    display: flex;
    gap: 6px;
  }

  .combat-head {
    align-items: start;
    margin-bottom: 0;
  }

  .combat-center .hud-title {
    font-size: 0.84rem;
  }

  .combat-pills {
    justify-content: flex-end;
  }

  .target-stack {
    display: grid;
    gap: 6px;
  }

  .target-empty {
    min-height: 54px;
    display: grid;
    place-items: center;
    font-size: 0.74rem;
  }

  .target-buffs {
    margin-top: 2px;
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
      width: min(232px, calc(100vw - 560px));
    }

    .top-left-zone,
    .right-zone {
      width: 236px;
    }

    .left-zone {
      width: 280px;
    }
  }

  @media (max-width: 1180px) {
    .hud-root {
      padding: 12px;
    }

    .top-left-zone,
    .combat-center,
    .left-zone,
    .right-zone,
    .bottom-hud,
    .debug-zone {
      position: static;
      transform: none;
      width: auto;
    }

    .hud-root {
      overflow: auto;
      display: grid;
      gap: 12px;
      align-content: start;
    }

    .left-zone,
    .right-zone,
    .top-left-zone {
      max-height: none;
      width: auto;
    }

    .bottom-hud {
      margin-bottom: 72px;
      max-width: none;
      width: calc(100vw - 24px);
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
    .combat-head,
    .player-head,
    .player-meta-row,
    .combat-pills {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
