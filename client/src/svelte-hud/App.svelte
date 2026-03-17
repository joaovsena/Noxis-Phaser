<script lang="ts">
  import { onMount } from 'svelte';
  import Auth from './Auth.svelte';
  import CharacterWindow from './CharacterWindow.svelte';
  import Inventory from './Inventory.svelte';
  import SkillsWindow from './SkillsWindow.svelte';
  import MapWindow from './MapWindow.svelte';
  import ProgressBar from './components/ProgressBar.svelte';
  import IconButton from './components/IconButton.svelte';
  import Slot from './components/Slot.svelte';
  import { appStore, attributesStore, beginDrag, clearHotbarBinding, closeAllPanels, commitHotbarBindings, dragStore, endDrag, hotbarBindingsStore, hotbarSlots, hudTransformStyle, npcStore, openPanel, panelStore, setHotbarBinding, togglePanel } from './stores/gameUi';

  export let enableHud = false;

  let uiHost: HTMLElement | null = null;

  $: inGame = $appStore.connectionPhase === 'in_game';
  $: showAuth = !inGame;
  $: showHud = inGame && enableHud;

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
    if (!['b', 'c', 'v', 'm', 'escape'].includes(key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (typeof event.stopImmediatePropagation === 'function') event.stopImmediatePropagation();
    if (key === 'escape') {
      closeAllPanels();
      return;
    }
    if (key === 'b') togglePanel('inventory');
    if (key === 'c') togglePanel('character');
    if (key === 'v') togglePanel('skills');
    if (key === 'm') togglePanel('map');
  }

  onMount(() => {
    uiHost = document.getElementById('ui-container');
    uiHost?.classList.add('svelte-ui-mounted');
    window.addEventListener('keydown', handleShortcut, true);
    return () => {
      uiHost?.classList.remove('svelte-ui-mounted');
      window.removeEventListener('keydown', handleShortcut, true);
    };
  });
</script>

{#if showAuth}
  <Auth />
{:else if showHud}
  <div class="hud-root" style={$hudTransformStyle}>
    <div class="player-panel">
      <div class="player-label">Status do Heroi</div>
      <div class="player-title">{$attributesStore.player?.name || 'Aventureiro'}</div>
      <ProgressBar
        value={$attributesStore.player?.hp || 0}
        max={$attributesStore.player?.maxHp || 1}
        label={`HP ${$attributesStore.player?.hp || 0} / ${$attributesStore.player?.maxHp || 0}`}
        tone="health"
      />
    </div>

    {#if $panelStore.character}
      <div class="window-wrap character-wrap">
        <CharacterWindow />
      </div>
    {/if}

    {#if $panelStore.inventory}
      <div class="window-wrap inventory-wrap">
        <Inventory />
      </div>
    {/if}

    {#if $panelStore.skills}
      <div class="window-wrap skills-wrap">
        <SkillsWindow />
      </div>
    {/if}

    {#if $panelStore.map}
      <div class="window-wrap map-wrap">
        <MapWindow />
      </div>
    {/if}

    <div class="actionbar-wrap">
      <div class="actionbar-title">Barra de Skills</div>
      <div class="actionbar">
        {#each $hotbarSlots.slice(0, 8) as slot}
          <div class="hotbar-slot-shell" role="group" aria-label={`Slot ${slot.key.toUpperCase()}`} on:dragover|preventDefault on:drop={(event) => dropOnHotbar(slot.key, event)}>
            <Slot
              item={slot.binding?.type === 'item' ? { ...slot.binding, iconUrl: slot.iconUrl, name: slot.label } : (slot.iconUrl ? { iconUrl: slot.iconUrl, name: slot.label } : null)}
              hotkey={slot.key.toUpperCase()}
              size={48}
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
      <IconButton icon="quests" label="NPC" hotkey="" active={$npcStore.shopOpen} on:press={() => openPanel('inventory')} />
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

  .player-panel,
  .actionbar-wrap,
  .dock,
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
    width: 300px;
    padding: 16px;
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

  .actionbar-wrap {
    position: absolute;
    left: 50%;
    bottom: 88px;
    transform: translateX(-50%);
    display: grid;
    gap: 10px;
    padding: 12px 14px 14px;
  }

  .actionbar {
    display: flex;
    gap: 8px;
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
    bottom: 20px;
    transform: translateX(-50%);
    display: flex;
    gap: 18px;
    padding: 12px 18px 10px;
  }

  @media (max-width: 1280px) {
    .skills-wrap,
    .map-wrap {
      left: auto;
      right: 24px;
      transform: none;
    }
  }
</style>
