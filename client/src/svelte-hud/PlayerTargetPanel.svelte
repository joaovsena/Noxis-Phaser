<script lang="ts">
  import ProgressBar from './components/ProgressBar.svelte';
  import { addSelectedPlayerFriend, appStore, attackSelectedPlayer, clearCurrentTarget, inviteSelectedPlayer, selectedPlayerStore } from './stores/gameUi';

  let actionsOpen = false;
  $: target = $selectedPlayerStore;
  $: selfId = Number($appStore.playerId || 0);
  $: hp = Number(target?.hp || 0);
  $: maxHp = Math.max(1, Number(target?.maxHp || 1));
  $: role = String(target?.role || '').toLowerCase();
  $: avatarLabel = role === 'adm' ? 'A' : String(target?.class || 'knight').slice(0, 1).toUpperCase();
  $: hostile = Boolean(target && Number(target.id || 0) !== selfId && !target.dead && Number(target.hp || 0) > 0 && String(target.pvpMode || 'peace') !== 'peace');
  $: if (!target) actionsOpen = false;
</script>

{#if target}
  <section class="target-panel player">
    <div class="target-top">
      <div class={`avatar ${role === 'adm' ? 'admin' : ''}`}>{avatarLabel}</div>
      <div class="meta">
        <div class="eyebrow">Jogador alvo</div>
        <div class="name">{role === 'adm' ? '[ADM] ' : ''}{target.name || 'Aventureiro'} Lv.{Number(target.level || 1)}</div>
      </div>
      <button class="close-btn" type="button" on:click={() => actionsOpen = !actionsOpen}>&#9662;</button>
    </div>

    <ProgressBar value={hp} max={maxHp} label={`HP ${hp} / ${maxHp}`} tone="health" />

    {#if actionsOpen}
      <div class="actions">
        {#if Number(target.id || 0) !== selfId}
          {#if hostile}
            <button type="button" on:click={() => attackSelectedPlayer(Number(target.id || 0))}>Atacar</button>
          {/if}
          <button type="button" on:click={() => inviteSelectedPlayer(String(target.name || ''))}>Convidar</button>
          <button type="button" class="ghost" on:click={() => addSelectedPlayerFriend(String(target.name || ''))}>Amigo</button>
        {/if}
        <button type="button" class="ghost" on:click={clearCurrentTarget}>Limpar alvo</button>
      </div>
    {/if}
  </section>
{/if}

<style>
  .target-panel {
    pointer-events: auto;
    width: 280px;
    padding: 14px;
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

  .target-panel::before {
    content: '';
    position: absolute;
    inset: 8px;
    clip-path: inherit;
    border: 1px solid rgba(201, 168, 106, 0.1);
    pointer-events: none;
  }

  .target-top,
  .actions {
    position: relative;
    z-index: 1;
  }

  .target-top {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr) 20px;
    gap: 10px;
    align-items: center;
    margin-bottom: 12px;
  }

  .avatar,
  .close-btn,
  .actions button {
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
  }

  .avatar {
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    background: radial-gradient(circle at 30% 30%, rgba(255, 221, 171, 0.2), transparent 42%), rgba(22, 58, 92, 0.9);
    border: 1px solid rgba(109, 168, 222, 0.35);
    color: #fff2d8;
    font-family: 'Cinzel', serif;
  }

  .avatar.admin {
    background: radial-gradient(circle at 30% 30%, rgba(255, 221, 171, 0.24), transparent 42%), rgba(88, 48, 18, 0.92);
    border-color: rgba(230, 188, 118, 0.35);
  }

  .eyebrow {
    font-family: 'Cinzel', serif;
    font-size: 0.58rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: rgba(201, 168, 106, 0.72);
  }

  .name {
    margin-top: 4px;
    color: #f0dfbc;
    font-family: 'Cinzel', serif;
    font-size: 0.82rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .close-btn,
  .actions button {
    border: 1px solid rgba(201, 168, 106, 0.26);
    background: linear-gradient(180deg, rgba(30, 20, 13, 0.96), rgba(10, 8, 6, 0.98));
    color: #ecdcb8;
  }

  .close-btn {
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    font-size: 0.68rem;
    line-height: 1;
  }

  .actions {
    display: grid;
    gap: 8px;
    margin-top: 12px;
  }

  .actions button {
    min-height: 34px;
    padding: 0 12px;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    text-align: left;
  }

  .actions .ghost {
    background: rgba(16, 20, 24, 0.95);
  }
</style>
