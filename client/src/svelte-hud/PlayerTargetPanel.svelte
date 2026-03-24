<script lang="ts">
  import ProgressBar from './components/ProgressBar.svelte';
  import { addSelectedPlayerFriend, appStore, attackSelectedPlayer, clearCurrentTarget, combatContextStore, inviteSelectedPlayer, selectedPlayerStore } from './stores/gameUi';

  $: target = $selectedPlayerStore;
  $: selfId = Number($appStore.playerId || 0);
  $: hp = Number(target?.hp || 0);
  $: maxHp = Math.max(1, Number(target?.maxHp || 1));
  $: role = String(target?.role || '').toLowerCase();
  $: avatarLabel = role === 'adm' ? 'A' : String(target?.class || 'knight').slice(0, 1).toUpperCase();
  $: hostile = Boolean(target && Number(target.id || 0) !== selfId && !target.dead && Number(target.hp || 0) > 0 && String(target.pvpMode || 'peace') !== 'peace');
</script>

{#if target}
  <section class="target-panel player">
    <div class="target-top">
      <div class={`avatar ${role === 'adm' ? 'admin' : ''}`}>{avatarLabel}</div>
      <div class="meta">
        <div class="eyebrow">Jogador alvo</div>
        <div class="name">{role === 'adm' ? '[ADM] ' : ''}{target.name || 'Aventureiro'} Lv.{Number(target.level || 1)}</div>
        <div class="meta-row">
          <span class={`pill ${hostile ? 'danger' : 'neutral'}`}>{hostile ? 'Hostil' : 'Neutro'}</span>
          <span class="pill neutral">PvP {String(target.pvpMode || 'peace')}</span>
          <span class={`pill ${$combatContextStore.inRange ? 'positive' : 'warning'}`}>{Math.round($combatContextStore.targetDistance)}px</span>
        </div>
      </div>
    </div>

    <ProgressBar value={hp} max={maxHp} label={`HP ${hp} / ${maxHp}`} tone="health" />

    <div class="actions">
      {#if Number(target.id || 0) !== selfId}
        {#if hostile}
          <button type="button" on:click={() => attackSelectedPlayer(Number(target.id || 0))}>Atacar</button>
        {/if}
        <button type="button" class="ghost" on:click={() => inviteSelectedPlayer(String(target.name || ''))}>Grupo</button>
        <button type="button" class="ghost" on:click={() => addSelectedPlayerFriend(String(target.name || ''))}>Amigo</button>
      {/if}
      <button type="button" class="ghost" on:click={clearCurrentTarget}>Limpar</button>
    </div>
  </section>
{/if}

<style>
  .target-panel {
    width: 100%;
    padding: 8px 10px;
    border-radius: 16px;
    border: 1px solid rgba(201, 168, 106, 0.24);
    background: rgba(8, 11, 15, 0.7);
  }

  .target-top,
  .meta-row,
  .actions {
    display: flex;
    gap: 10px;
  }

  .target-top {
    align-items: center;
    margin-bottom: 6px;
  }

  .avatar {
    width: 28px;
    height: 28px;
    display: grid;
    place-items: center;
    border-radius: 12px;
    background: rgba(22, 58, 92, 0.9);
    border: 1px solid rgba(109, 168, 222, 0.35);
    color: #fff2d8;
    font-family: var(--hud-font-display);
  }

  .avatar.admin {
    background: rgba(88, 48, 18, 0.92);
    border-color: rgba(230, 188, 118, 0.35);
  }

  .meta {
    min-width: 0;
    flex: 1;
  }

  .eyebrow {
    font-family: var(--hud-font-display);
    font-size: 0.58rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(201, 168, 106, 0.72);
  }

  .name {
    margin-top: 4px;
    color: #f0dfbc;
    font-family: var(--hud-font-display);
    font-size: 0.68rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .meta-row {
    flex-wrap: wrap;
    margin-top: 5px;
  }

  .pill {
    min-height: 18px;
    padding: 0 6px;
    border-radius: 999px;
    border: 1px solid rgba(201, 168, 106, 0.16);
    display: inline-flex;
    align-items: center;
    font-size: 0.54rem;
    text-transform: uppercase;
  }

  .pill.neutral { color: rgba(233, 223, 200, 0.78); }
  .pill.positive { color: var(--hud-positive); }
  .pill.warning { color: var(--hud-warning); }
  .pill.danger { color: var(--hud-danger); }

  .actions button {
    border-radius: 10px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(20, 16, 13, 0.92);
    color: var(--hud-gold);
  }

  .actions {
    flex-wrap: wrap;
    justify-content: flex-end;
    margin-top: 6px;
  }

  .actions button {
    min-height: 24px;
    padding: 0 8px;
    font-family: var(--hud-font-display);
    font-size: 0.56rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .actions .ghost {
    background: rgba(16, 20, 24, 0.95);
  }
</style>
