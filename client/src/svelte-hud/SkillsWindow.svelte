<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import { assignSkillToHotbar, beginDrag, castSkill, hotbarBindingsStore, learnSkill, selectedAutoAttackStore, setSelectedAutoAttack, skillsStore } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();
  let activeBuild: 'buildA' | 'buildB' = 'buildA';
  let selectedSkillId = '';

  $: buildAName = $skillsStore.entries.find((entry) => entry.buildKey === 'buildA')?.buildLabel || 'Build A';
  $: buildBName = $skillsStore.entries.find((entry) => entry.buildKey === 'buildB')?.buildLabel || 'Build B';
  $: visibleSkills = $skillsStore.entries
    .filter((entry) => entry.buildKey === activeBuild)
    .sort((left, right) => left.requiredLevel - right.requiredLevel);
  $: if (!visibleSkills.find((entry) => entry.id === selectedSkillId)) {
    selectedSkillId = visibleSkills[0]?.id || '';
  }
  $: selectedSkill = visibleSkills.find((entry) => entry.id === selectedSkillId) || visibleSkills[0] || null;
  $: selectedHotbarKey = selectedSkill
    ? Object.entries($hotbarBindingsStore).find(([, binding]) => binding?.type === 'action' && binding?.skillId === selectedSkill.id)?.[0] || ''
    : '';

  function handleLearn(skillId?: string) {
    const targetSkill = (skillId ? visibleSkills.find((entry) => entry.id === skillId) : selectedSkill) || null;
    if (!targetSkill?.canLearn) return;
    learnSkill(targetSkill.id);
  }

  function handleAssign() {
    if (!selectedSkill?.learned) return;
    assignSkillToHotbar(selectedSkill.id, selectedSkill.label);
  }

  function handleUseNow() {
    if (!selectedSkill?.learned) return;
    castSkill(selectedSkill.id);
  }
</script>

<Window title="Habilidades" subtitle="Progressao de classe" width="920px" on:close={() => dispatch('close')}>
  <div class="skills-shell">
    <aside class="skills-sidebar">
      <div class="skills-summary-card">
        <div class="summary-label">Classe ativa</div>
        <div class="summary-value">{$skillsStore.classId}</div>
        <div class="summary-meta">Nivel {$skillsStore.playerLevel} • {$skillsStore.skillPoints} ponto(s)</div>
      </div>

      <div class="skills-tabs">
        <button class:active={activeBuild === 'buildA'} type="button" on:click={() => activeBuild = 'buildA'}>{buildAName}</button>
        <button class:active={activeBuild === 'buildB'} type="button" on:click={() => activeBuild = 'buildB'}>{buildBName}</button>
      </div>

      <div class="auto-attack-card">
        <div class="card-kicker">Ataque Automatico</div>
        <div class="auto-attack-list">
          {#each $skillsStore.autoAttack as entry}
            <button
              class:active={$selectedAutoAttackStore === entry.id}
              class="auto-attack-pill"
              draggable="true"
              type="button"
              on:click={() => setSelectedAutoAttack(entry.id)}
              on:dragstart={() => beginDrag(entry.id === 'class_primary' ? { source: 'basic', skillId: 'class_primary', skillName: entry.label } : { source: 'skill', skillId: entry.id, skillName: entry.label })}
            >
              {entry.label}
            </button>
          {/each}
        </div>
      </div>
    </aside>

    <section class="skills-tree-column">
      <div class="tree-header">
        <div>
          <div class="card-kicker">Trilha vertical</div>
          <div class="tree-title">{activeBuild === 'buildA' ? buildAName : buildBName}</div>
        </div>
        <div class="tree-help">Desbloqueios em niveis 1, 10, 20, 30 e 40</div>
      </div>

      <div class="vertical-tree">
        {#each visibleSkills as entry, index}
          <div class={`tree-row ${selectedSkill?.id === entry.id ? 'selected' : ''} ${entry.learned ? 'learned' : ''} ${!entry.requiredLevelMet || !entry.prereqMet ? 'locked' : ''}`}>
            <button class="tree-node" type="button" on:click={() => selectedSkillId = entry.id}>
              <div class="tier-badge">Lv {entry.requiredLevel}</div>
              <div class="tree-main">
                <div class="tree-topline">
                  <span class="skill-name">{entry.label}</span>
                  <span class={`role-chip role-${entry.role.toLowerCase()}`}>{entry.role}</span>
                </div>
                <div class="tree-summary">{entry.summary}</div>
                <div class="tree-meta">
                  <span>Rank {entry.level}/{entry.maxPoints}</span>
                  <span>{entry.target === 'self' ? 'Self cast' : `Alvo • ${entry.range || 0}px`}</span>
                  <span>CD {(entry.cooldownMs / 1000).toFixed(entry.cooldownMs % 1000 === 0 ? 0 : 1)}s</span>
                </div>
                {#if !entry.requiredLevelMet || !entry.prereqMet}
                  <div class="locked-note">{entry.lockedReason}</div>
                {/if}
              </div>
            </button>

            <div class="tree-actions">
              <button class="learn-btn" disabled={!entry.canLearn} type="button" on:click={() => handleLearn(entry.id)}>+</button>
            </div>
          </div>

          {#if index < visibleSkills.length - 1}
            <div class={`tree-link ${entry.learned ? 'lit' : ''}`}></div>
          {/if}
        {/each}
      </div>
    </section>

    <aside class="skill-detail-card">
      {#if selectedSkill}
        <div class="card-kicker">Detalhes</div>
        <div class="detail-title">{selectedSkill.label}</div>
        <div class="detail-summary">{selectedSkill.summary}</div>

        <div class="detail-grid">
          <div class="detail-cell">
            <span class="detail-label">Desbloqueio</span>
            <strong>Nivel {selectedSkill.requiredLevel}</strong>
          </div>
          <div class="detail-cell">
            <span class="detail-label">Rank</span>
            <strong>{selectedSkill.level}/{selectedSkill.maxPoints}</strong>
          </div>
          <div class="detail-cell">
            <span class="detail-label">Alvo</span>
            <strong>{selectedSkill.target === 'self' ? 'Proprio personagem' : 'Monstro selecionado'}</strong>
          </div>
          <div class="detail-cell">
            <span class="detail-label">Recarga</span>
            <strong>{(selectedSkill.cooldownMs / 1000).toFixed(selectedSkill.cooldownMs % 1000 === 0 ? 0 : 1)}s</strong>
          </div>
        </div>

        <div class="detail-status">
          {#if selectedSkill.learned}
            <span class="status-chip ok">Aprendida</span>
          {:else if selectedSkill.requiredLevelMet && selectedSkill.prereqMet}
            <span class="status-chip warm">Pronta para evoluir</span>
          {:else}
            <span class="status-chip muted">Bloqueada</span>
          {/if}

          {#if selectedHotbarKey}
            <span class="status-chip ok">Na barra {selectedHotbarKey.toUpperCase()}</span>
          {/if}

          {#if $selectedAutoAttackStore === selectedSkill.id}
            <span class="status-chip ok">Auto ataque</span>
          {/if}
        </div>

        <div class="detail-actions">
          <button class="primary" disabled={!selectedSkill.canLearn} type="button" on:click={handleLearn}>Evoluir</button>
          <button class="secondary" disabled={!selectedSkill.learned} type="button" on:click={handleAssign}>Equipar na barra</button>
          <button class="secondary" disabled={!selectedSkill.learned || selectedSkill.target !== 'mob'} type="button" on:click={() => setSelectedAutoAttack(selectedSkill.id)}>Auto ataque</button>
          <button class="ghost" disabled={!selectedSkill.learned} type="button" on:click={handleUseNow}>Usar agora</button>
        </div>

        <div class="detail-tip">
          Arraste habilidades aprendidas para a hotbar ou use os botoes para equipar rapidamente.
        </div>
      {/if}
    </aside>
  </div>
</Window>

<style>
  .skills-shell {
    display: grid;
    grid-template-columns: 240px minmax(0, 1fr) 280px;
    gap: 16px;
    min-height: 560px;
  }

  .skills-sidebar,
  .skills-tree-column,
  .skill-detail-card,
  .skills-summary-card,
  .auto-attack-card,
  .tree-row,
  .detail-cell {
    display: grid;
    gap: 10px;
  }

  .skills-sidebar,
  .skill-detail-card {
    align-content: start;
  }

  .skills-summary-card,
  .auto-attack-card,
  .skill-detail-card {
    padding: 14px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: linear-gradient(180deg, rgba(13, 11, 10, 0.96), rgba(7, 7, 8, 0.98));
    clip-path: polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px);
  }

  .card-kicker,
  .summary-label,
  .detail-label {
    font-family: 'Cinzel', serif;
    font-size: 0.64rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(201, 168, 106, 0.74);
  }

  .summary-value,
  .tree-title,
  .detail-title {
    font-family: 'Cinzel', serif;
    color: #f0dfbc;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .summary-value {
    font-size: 1rem;
  }

  .summary-meta,
  .tree-help,
  .detail-summary,
  .detail-tip {
    color: rgba(233, 223, 200, 0.74);
    font-size: 0.8rem;
    line-height: 1.45;
  }

  .skills-tabs {
    display: grid;
    gap: 8px;
  }

  .skills-tabs button,
  .auto-attack-pill,
  .learn-btn,
  .detail-actions button,
  .tree-node {
    border: 1px solid rgba(201, 168, 106, 0.24);
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
  }

  .skills-tabs button,
  .auto-attack-pill,
  .learn-btn,
  .detail-actions button {
    min-height: 40px;
    background: linear-gradient(180deg, rgba(32, 24, 15, 0.96), rgba(12, 10, 8, 0.98));
    color: #ecdcb8;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .skills-tabs button.active,
  .auto-attack-pill.active {
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.16), 0 0 16px rgba(201, 168, 106, 0.14);
  }

  .auto-attack-list {
    display: grid;
    gap: 8px;
  }

  .skills-tree-column {
    min-width: 0;
  }

  .tree-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: end;
    margin-bottom: 12px;
  }

  .vertical-tree {
    padding-right: 8px;
    max-height: 540px;
    overflow-y: auto;
  }

  .tree-row {
    grid-template-columns: minmax(0, 1fr) 54px;
    align-items: stretch;
  }

  .tree-node {
    width: 100%;
    display: grid;
    grid-template-columns: 82px minmax(0, 1fr);
    gap: 12px;
    padding: 12px;
    background: linear-gradient(180deg, rgba(15, 13, 11, 0.94), rgba(8, 8, 9, 0.98));
    text-align: left;
  }

  .tree-row.selected .tree-node {
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.16), 0 0 18px rgba(201, 168, 106, 0.16);
  }

  .tree-row.learned .tree-node {
    border-color: rgba(201, 168, 106, 0.38);
  }

  .tree-row.locked .tree-node {
    opacity: 0.78;
  }

  .tier-badge {
    min-height: 54px;
    display: grid;
    place-items: center;
    align-self: start;
    border: 1px solid rgba(201, 168, 106, 0.2);
    background: rgba(24, 18, 13, 0.92);
    color: #f0dfbc;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
  }

  .tree-main {
    display: grid;
    gap: 8px;
    min-width: 0;
  }

  .tree-topline,
  .tree-meta,
  .detail-grid,
  .detail-status,
  .detail-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .tree-topline {
    justify-content: space-between;
    align-items: center;
  }

  .skill-name {
    font-family: 'Cinzel', serif;
    color: #f0dfbc;
    font-size: 0.92rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .role-chip,
  .status-chip {
    padding: 4px 8px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(20, 18, 16, 0.92);
    color: rgba(235, 223, 196, 0.82);
    font-size: 0.66rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }

  .role-area,
  .role-execucao {
    color: #f0c790;
  }

  .role-buff,
  .role-cura {
    color: #9cdbb0;
  }

  .role-controle {
    color: #8cbdf1;
  }

  .tree-summary {
    color: rgba(233, 223, 200, 0.76);
    font-size: 0.8rem;
    line-height: 1.45;
  }

  .tree-meta,
  .locked-note {
    color: rgba(213, 202, 177, 0.68);
    font-size: 0.74rem;
  }

  .locked-note {
    color: #efc1b5;
  }

  .tree-actions {
    display: grid;
  }

  .learn-btn {
    min-height: 100%;
    font-size: 1.2rem;
  }

  .learn-btn:disabled,
  .detail-actions button:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .tree-link {
    width: 4px;
    height: 28px;
    margin: 0 auto;
    background: linear-gradient(180deg, rgba(201, 168, 106, 0.12), rgba(201, 168, 106, 0.04));
  }

  .tree-link.lit {
    background: linear-gradient(180deg, rgba(201, 168, 106, 0.38), rgba(201, 168, 106, 0.12));
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .detail-cell {
    padding: 10px;
    border: 1px solid rgba(201, 168, 106, 0.14);
    background: rgba(10, 10, 10, 0.62);
  }

  .detail-cell strong {
    color: #f0dfbc;
    font-size: 0.82rem;
  }

  .status-chip.ok {
    color: #9cdbb0;
  }

  .status-chip.warm {
    color: #f0c790;
  }

  .status-chip.muted {
    color: rgba(233, 223, 200, 0.62);
  }

  .detail-actions {
    margin-top: 4px;
  }

  .detail-actions button {
    flex: 1 1 120px;
    min-height: 42px;
    padding: 0 12px;
  }

  .primary {
    background: linear-gradient(180deg, rgba(81, 57, 27, 0.96), rgba(34, 23, 10, 0.98)) !important;
  }

  .ghost {
    background: rgba(15, 18, 22, 0.96) !important;
  }

  @media (max-width: 1100px) {
    .skills-shell {
      grid-template-columns: 1fr;
    }
  }
</style>
