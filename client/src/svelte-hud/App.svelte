<script lang="ts">
  import { afterUpdate, onMount } from 'svelte';
  import Auth from './Auth.svelte';
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
  import AdminWindow from './AdminWindow.svelte';
  import NpcDialogWindow from './NpcDialogWindow.svelte';
  import NotificationsPanel from './NotificationsPanel.svelte';
  import PartyFramesPanel from './PartyFramesPanel.svelte';
  import StatusHud from './StatusHud.svelte';
  import TooltipOverlay from './TooltipOverlay.svelte';
  import ReviveOverlay from './ReviveOverlay.svelte';
  import WorldLoadingOverlay from './WorldLoadingOverlay.svelte';
  import ProgressBar from './components/ProgressBar.svelte';
  import IconButton from './components/IconButton.svelte';
  import Slot from './components/Slot.svelte';
  import { activateHotbarBinding, adminStore, appStore, attributesStore, beginDrag, clearHotbarBinding, closeAllPanels, closeNpcDialog, commitHotbarBindings, cycleSelectedAutoAttack, dragStore, endDrag, hideTooltip, hotbarBindingsStore, hotbarSlots, hudTransformStyle, loadingStore, mapSettingsStore, npcStore, panelStore, playerMetaStore, returnToCharacterSelect, selectedAutoAttackLabelStore, sendUiMessage, setHotbarBinding, setPvpMode, toggleAfk, togglePanel, traceLoadingStep, worldStore } from './stores/gameUi';

  export let enableHud = false;

  let uiHost: HTMLElement | null = null;
  let nextPanelZ = 40;
  let chatVisible = true;
  let minimapVisible = true;
  let pvpMenuOpen = false;
  let lastUiMode = '';
  let pendingUiCommitTrace = '';

  $: inGame = $appStore.connectionPhase === 'in_game';
  $: showAuth = !inGame;
  $: hudReady = inGame && enableHud && $loadingStore.ready;
  $: showHud = hudReady;
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
  $: uiMode = showAuth ? 'auth' : showLoading ? 'loading' : showHud ? 'hud' : showInGameFallback ? 'fallback' : 'none';
  $: if (uiMode !== lastUiMode) {
    traceLoadingStep(`App.svelte modo -> ${uiMode} | phase ${$appStore.connectionPhase} | loading ${$loadingStore.active ? 'on' : 'off'} | ready ${$loadingStore.ready ? 'yes' : 'no'}.`);
    lastUiMode = uiMode;
    pendingUiCommitTrace = uiMode;
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

  function handleShortcut(event: KeyboardEvent) {
    if (!showHud) return;
    const target = event.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    const key = event.key.toLowerCase();
    if (event.key === '.') {
      event.preventDefault();
      toggleAfk();
      return;
    }
    if (['q', 'w', 'e', 'r', 'a', 's', 'd', 'f', '1', '2', '3', '4', '5', '6', '7', '8'].includes(key)) {
      event.preventDefault();
      activateHotbarBinding(key);
      return;
    }
    if (!['b', 'c', 'v', 'm', 'j', 'g', 'o', 'h', 'escape'].includes(key)) return;
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
    };
  });

  afterUpdate(() => {
    if (!pendingUiCommitTrace) return;
    traceLoadingStep(`App.svelte commit concluido para modo ${pendingUiCommitTrace}.`);
    pendingUiCommitTrace = '';
  });
</script>

{#if showAuth}
  <Auth />
{:else if showLoading}
  <WorldLoadingOverlay />
{:else if showHud}
  <div class="hud-root" style={$hudTransformStyle}>
    <div class="player-panel">
      <div class="player-topline">
        <div>
          <div class="player-label">Status do Heroi</div>
          <div class="player-title">{$attributesStore.player?.name || 'Aventureiro'}</div>
        </div>
        <div class="player-actions">
          <button class="player-chip" type="button" on:click={returnToCharacterSelect}>Trocar</button>
          <button class="player-chip" type="button" on:click={() => pvpMenuOpen = !pvpMenuOpen}>
            {$playerMetaStore.pvpMode === 'peace' ? 'Paz' : $playerMetaStore.pvpMode === 'group' ? 'Grupo' : 'Mal'}
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
      <div class="player-subline">
        <span>{$playerMetaStore.currentInstance}</span>
        <button class="player-chip ghost" type="button" on:click={cycleSelectedAutoAttack}>
          {($mapSettingsStore.autoAttackEnabled ? 'Auto' : 'Manual')} / {$selectedAutoAttackLabelStore}
        </button>
      </div>
    </div>

    <div class="target-wrap">
      <PlayerTargetPanel />
      <MobTargetPanel />
    </div>

    <div class="notify-wrap">
      <StatusHud />
      <NotificationsPanel />
    </div>

    <div class="party-frames-wrap">
      <PartyFramesPanel />
    </div>

    {#if minimapVisible}
    <div class="minimap-wrap" use:draggablePanel>
      <MinimapPanel on:close={() => minimapVisible = false} />
    </div>
    {/if}

    {#if chatVisible}
    <div class="chat-wrap window-wrap" use:draggablePanel>
      <ChatWindow on:close={() => chatVisible = false} />
    </div>
    {/if}

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

    <div class="actionbar-wrap">
      <div class="actionbar-title">Barra de Skills</div>
      <div class="actionbar actionbar-top">
        {#each $hotbarSlots.slice(0, 8) as slot}
          <div class="hotbar-slot-shell" role="group" aria-label={`Slot ${slot.key.toUpperCase()}`} on:dragover|preventDefault on:drop={(event) => dropOnHotbar(slot.key, event)}>
            <Slot
              item={slot.binding?.type === 'item' ? { ...slot.binding, iconUrl: slot.iconUrl, name: slot.label } : (slot.iconUrl ? { iconUrl: slot.iconUrl, name: slot.label } : null)}
              hotkey={slot.key.toUpperCase()}
              size={42}
              on:dragstart={() => slot.binding && beginDrag({ source: 'hotbar', key: slot.key })}
            />
            {#if slot.binding}
              <button class="hotbar-clear" type="button" on:click={() => clearHotbarBinding(slot.key)}>x</button>
            {/if}
          </div>
        {/each}
      </div>
      <div class="actionbar actionbar-bottom">
        {#each $hotbarSlots.slice(8, 16) as slot}
          <div class="hotbar-slot-shell" role="group" aria-label={`Slot ${slot.key.toUpperCase()}`} on:dragover|preventDefault on:drop={(event) => dropOnHotbar(slot.key, event)}>
            <Slot
              item={slot.binding?.type === 'item' ? { ...slot.binding, iconUrl: slot.iconUrl, name: slot.label } : (slot.iconUrl ? { iconUrl: slot.iconUrl, name: slot.label } : null)}
              hotkey={slot.key.toUpperCase()}
              size={42}
              on:dragstart={() => slot.binding && beginDrag({ source: 'hotbar', key: slot.key })}
            />
            {#if slot.binding}
              <button class="hotbar-clear" type="button" on:click={() => clearHotbarBinding(slot.key)}>x</button>
            {/if}
          </div>
        {/each}
      </div>
    </div>

    <div class="dock">
      <IconButton icon="character" label="Personagem" hotkey="C" active={$panelStore.character} on:press={() => togglePanel('character')} />
      <IconButton icon="inventory" label="Inventario" hotkey="B" active={$panelStore.inventory} on:press={() => togglePanel('inventory')} />
      <IconButton icon="skills" label="Habilidades" hotkey="V" active={$panelStore.skills} on:press={() => togglePanel('skills')} />
      <IconButton icon="map" label="Mapa" hotkey="M" active={$panelStore.map} on:press={() => togglePanel('map')} />
      <IconButton icon="quests" label="Quests" hotkey="J" active={$panelStore.quests} on:press={() => togglePanel('quests')} />
      <IconButton icon="party" label="Grupo" hotkey="G" active={$panelStore.party} on:press={() => { togglePanel('party'); sendUiMessage({ type: 'party.requestAreaParties' }); }} />
      <IconButton icon="friends" label="Amigos" hotkey="O" active={$panelStore.friends} on:press={() => { togglePanel('friends'); sendUiMessage({ type: 'friend.list' }); }} />
      {#if $adminStore.isAdmin}
        <IconButton icon="admin" label="Admin" hotkey="H" active={$panelStore.admin} on:press={() => togglePanel('admin')} />
      {/if}
      <IconButton icon="minimap" label="Minimapa" active={minimapVisible} on:press={() => minimapVisible = !minimapVisible} />
      <IconButton icon="chat" label="Chat" active={chatVisible} on:press={() => chatVisible = !chatVisible} />
    </div>

    <ReviveOverlay />
    <TooltipOverlay />
  </div>
{:else if showInGameFallback}
  <div class="hud-fallback-debug" style={$hudTransformStyle}>
    <div class="hud-fallback-card">
      <div class="hud-fallback-title">HUD em estado intermediario</div>
      <div class="hud-fallback-copy">A autenticacao terminou, mas a interface principal ainda nao foi liberada.</div>
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
    --ui-surface: rgba(8, 11, 14, 0.96);
    --ui-panel: rgba(14, 18, 22, 0.98);
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
    clip-path: polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px);
    box-shadow: 0 18px 34px rgba(0, 0, 0, 0.28);
  }

  .hud-fallback-title {
    font-family: 'Cinzel', serif;
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

  .player-panel,
  .actionbar-wrap,
  .dock,
  .target-wrap,
  .minimap-wrap,
  .chat-wrap,
  .notify-wrap,
  .window-wrap,
  .hotbar-clear {
    pointer-events: auto;
  }

  .player-panel,
  .actionbar-wrap,
  .dock {
    position: relative;
    overflow: hidden;
    clip-path: polygon(16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px), 0 16px);
    border: 1px solid rgba(201, 168, 106, 0.34);
    background:
      radial-gradient(circle at top, rgba(201, 168, 106, 0.08), transparent 34%),
      linear-gradient(180deg, rgba(17, 15, 12, 0.97), rgba(8, 8, 8, 0.98));
    box-shadow:
      0 18px 34px rgba(0, 0, 0, 0.28),
      inset 0 0 0 1px rgba(255, 239, 206, 0.03);
  }

  .player-panel::before,
  .actionbar-wrap::before,
  .dock::before {
    content: '';
    position: absolute;
    inset: 8px;
    clip-path: inherit;
    border: 1px solid rgba(201, 168, 106, 0.1);
    pointer-events: none;
  }

  .player-panel {
    position: absolute;
    top: 20px;
    left: 20px;
    width: 340px;
    padding: 16px;
  }

  .player-topline,
  .player-subline,
  .player-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .player-actions {
    position: relative;
  }

  .player-topline,
  .player-subline {
    justify-content: space-between;
  }

  .player-label,
  .actionbar-title {
    font-family: 'Cinzel', serif;
    font-size: 0.62rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(201, 168, 106, 0.78);
  }

  .player-title {
    margin: 4px 0 12px;
    font-family: 'Cinzel', serif;
    color: #f0dfbc;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    font-size: 1.12rem;
  }

  .player-chip {
    min-height: 30px;
    padding: 0 10px;
    border: 1px solid rgba(201, 168, 106, 0.24);
    background: linear-gradient(180deg, rgba(28, 22, 15, 0.94), rgba(10, 8, 7, 0.98));
    color: #e8d5aa;
    font-family: 'Cinzel', serif;
    font-size: 0.64rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px);
  }

  .player-chip.ghost {
    background: rgba(12, 12, 12, 0.68);
  }

  .player-pvp-menu {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    display: grid;
    gap: 6px;
    min-width: 118px;
    padding: 8px;
    border: 1px solid rgba(201, 168, 106, 0.22);
    background: linear-gradient(180deg, rgba(14, 12, 10, 0.98), rgba(8, 8, 8, 0.99));
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
    box-shadow: 0 18px 30px rgba(0, 0, 0, 0.28);
    z-index: 4;
  }

  .player-pvp-menu button {
    min-height: 32px;
    border: 1px solid rgba(201, 168, 106, 0.22);
    background: rgba(18, 15, 12, 0.96);
    color: #ecdcb8;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px);
  }

  .player-pvp-menu button.active {
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.16), 0 0 12px rgba(201, 168, 106, 0.18);
  }

  .player-subline {
    margin-top: 10px;
    color: rgba(234, 224, 202, 0.72);
    font-size: 0.74rem;
  }

  .window-wrap {
    position: absolute;
  }

  .character-wrap {
    left: 24px;
    top: 102px;
  }

  .inventory-wrap {
    right: 24px;
    top: 88px;
  }

  .skills-wrap {
    left: 50%;
    top: 82px;
    transform: translateX(-50%);
  }

  .map-wrap {
    left: 50%;
    top: 82px;
    transform: translateX(-50%);
  }

  .quests-wrap {
    left: 24px;
    top: 120px;
  }

  .npc-wrap {
    right: 24px;
    top: 120px;
  }

  .party-wrap {
    right: 24px;
    top: 120px;
  }

  .friends-wrap {
    left: 24px;
    top: 140px;
  }

  .admin-wrap {
    right: 30px;
    top: 92px;
  }

  .target-wrap {
    position: absolute;
    top: 18px;
    left: 50%;
    transform: translateX(-50%);
  }

  .minimap-wrap {
    position: absolute;
    top: 20px;
    right: 20px;
  }

  .chat-wrap {
    position: absolute;
    left: 20px;
    bottom: 20px;
  }

  .notify-wrap {
    position: absolute;
    right: 20px;
    bottom: 20px;
    display: grid;
    gap: 10px;
  }

  .party-frames-wrap {
    position: absolute;
    left: 20px;
    top: 214px;
    display: grid;
    gap: 8px;
  }

  .actionbar-wrap {
    position: absolute;
    left: 50%;
    bottom: 74px;
    transform: translateX(-50%);
    display: grid;
    gap: 10px;
    padding: 10px 12px 12px;
  }

  .actionbar {
    display: flex;
    gap: 6px;
  }

  .hotbar-slot-shell {
    position: relative;
  }

  .hotbar-clear {
    position: absolute;
    right: -4px;
    top: -4px;
    width: 18px;
    height: 18px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(201, 168, 106, 0.24);
    background: rgba(10, 10, 10, 0.92);
    color: #e3c98f;
    border-radius: 999px;
    font-size: 0.65rem;
    line-height: 1;
  }

  .dock {
    position: absolute;
    left: 50%;
    bottom: 18px;
    transform: translateX(-50%);
    display: flex;
    gap: 10px;
    padding: 8px 12px 8px;
  }

  @media (max-width: 1280px) {
    .skills-wrap,
    .map-wrap {
      left: auto;
      right: 24px;
      transform: none;
    }

    .target-wrap {
      left: auto;
      right: 24px;
      top: 214px;
      transform: none;
    }
  }
</style>
