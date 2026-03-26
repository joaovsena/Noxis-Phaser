<script lang="ts">
  import { appStore, selectedPlayerStore } from './stores/gameUi';

  $: target = $selectedPlayerStore;
  $: selfId = Number($appStore.playerId || 0);
  $: hp = Number(target?.hp || 0);
  $: maxHp = Math.max(1, Number(target?.maxHp || 1));
  $: hpRatio = Math.max(0, Math.min(1, hp / maxHp));
  $: role = String(target?.role || '').toLowerCase();
  $: pvpMode = String(target?.pvpMode || 'peace').toLowerCase();
  $: hostile = Boolean(target && Number(target.id || 0) !== selfId && !target.dead && hp > 0 && pvpMode !== 'peace');
  $: targetName = `${role === 'adm' ? '[ADM] ' : ''}${target?.name || 'Aventureiro'}`;
  $: glyph = String(target?.name || 'A').slice(0, 1).toUpperCase() || 'A';
  $: accentFill = hostile ? 0.84 : pvpMode === 'group' ? 0.62 : 0.36;
</script>

{#if target}
  <section class="target-panel player">
    <div class="portrait-shell">
      <div class="portrait-core">{glyph}</div>
      <span class="level-badge">{Math.max(1, Number(target.level || 1))}</span>
    </div>

    <div class="target-copy">
      <div class="target-name">{targetName}</div>

      <div class="target-bars">
        <div class="target-bar health">
          <div class="fill health-fill" style={`transform: scaleX(${hpRatio});`}></div>
          <span>HP {hp} / {maxHp}</span>
        </div>

        <div class="target-bar aura">
          <div class="fill aura-fill" style={`transform: scaleX(${accentFill});`}></div>
          <span>{hostile ? 'Hostil' : pvpMode === 'group' ? 'Grupo' : 'Neutro'}</span>
        </div>
      </div>
    </div>
  </section>
{/if}

<style>
  .target-panel {
    width: min(236px, calc(100vw - 36px));
    min-height: 64px;
    padding: 7px 9px;
    border: 1px solid rgba(212, 189, 132, 0.48);
    border-radius: 14px;
    background:
      radial-gradient(circle at top left, rgba(255, 255, 255, 0.08), transparent 34%),
      linear-gradient(180deg, rgba(44, 33, 19, 0.96), rgba(11, 10, 12, 0.98));
    box-shadow:
      inset 0 1px 0 rgba(255, 234, 188, 0.14),
      inset 0 0 0 1px rgba(70, 53, 26, 0.72),
      0 10px 20px rgba(0, 0, 0, 0.28);
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
  }

  .portrait-shell {
    position: relative;
    width: 42px;
    height: 42px;
    padding: 2px;
    border-radius: 10px;
    border: 1px solid rgba(226, 209, 156, 0.52);
    background:
      linear-gradient(180deg, rgba(61, 42, 20, 0.98), rgba(24, 17, 11, 0.98));
    box-shadow: inset 0 0 0 1px rgba(56, 40, 18, 0.9);
  }

  .portrait-core {
    width: 100%;
    height: 100%;
    border-radius: 7px;
    display: grid;
    place-items: center;
    background:
      radial-gradient(circle at 50% 28%, rgba(164, 225, 255, 0.42), transparent 38%),
      linear-gradient(180deg, #314a67, #11161f 88%);
    color: #f0f6ff;
    font-family: var(--hud-font-display);
    font-size: 1rem;
    text-transform: uppercase;
    text-shadow: 0 1px 4px rgba(0, 0, 0, 0.75);
  }

  .level-badge {
    position: absolute;
    left: -4px;
    bottom: -8px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: 999px;
    border: 1px solid rgba(222, 204, 150, 0.56);
    background: linear-gradient(180deg, #352813, #0f0c0c);
    color: #f4e2bd;
    font-size: 0.58rem;
    font-weight: 700;
    display: grid;
    place-items: center;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.32);
  }

  .target-copy {
    min-width: 0;
    display: grid;
    gap: 4px;
  }

  .target-name {
    color: #f4ebd8;
    font-family: var(--hud-font-display);
    font-size: 0.76rem;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.78);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .target-bars {
    display: grid;
    gap: 3px;
  }

  .target-bar {
    position: relative;
    height: 12px;
    overflow: hidden;
    border-radius: 999px;
    border: 1px solid rgba(227, 208, 151, 0.34);
    background:
      linear-gradient(180deg, rgba(18, 16, 18, 0.96), rgba(5, 5, 6, 0.98));
    box-shadow: inset 0 1px 4px rgba(0, 0, 0, 0.48);
  }

  .fill {
    position: absolute;
    inset: 0;
    transform-origin: left center;
  }

  .health-fill {
    background: linear-gradient(90deg, #6f1510, #cf362b 56%, #f0a05d);
  }

  .aura-fill {
    background: linear-gradient(90deg, #31548e, #5b9af1 55%, #9ee4ff);
  }

  .target-bar::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.16), transparent 58%);
    pointer-events: none;
  }

  .target-bar span {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    font-size: 0.54rem;
    color: #f7f0de;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
    letter-spacing: 0.02em;
  }

  .aura span {
    font-size: 0.5rem;
    text-transform: uppercase;
  }
</style>
