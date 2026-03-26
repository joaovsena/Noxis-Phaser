<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import { beginDrag, learnSkill, skillsStore } from './stores/gameUi';

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
  $: detailKey = selectedSkill ? `${selectedSkill.id}:${selectedSkill.level}:${$skillsStore.skillPoints}` : 'empty';

  function handleLearn(skillId?: string) {
    const targetSkill = (skillId ? visibleSkills.find((entry) => entry.id === skillId) : selectedSkill) || null;
    if (!targetSkill?.canLearn) return;
    learnSkill(targetSkill.id);
  }

  function rankPips(level = 0, maxPoints = 5) {
    return Array.from({ length: maxPoints }, (_, index) => index < level);
  }

  function scalingHint(skill: any) {
    if (!skill) return '';
    if (skill.role === 'Cura') return 'Cada nivel aumenta a cura e melhora a sustentacao da trilha.';
    if (skill.role === 'Buff') return 'Cada nivel reforca a janela defensiva ou ofensiva da habilidade.';
    if (skill.role === 'Area') return 'Cada nivel amplia o impacto e fortalece a presenca em combate de grupo.';
    if (skill.role === 'Controle') return 'Cada nivel deixa o efeito utilitario mais consistente e confiavel.';
    if (skill.role === 'Execucao') return 'Cada nivel reforca a finalizacao e o dano contra alvos pressionados.';
    return 'Cada nivel aumenta a potencia base e melhora a consistencia da rotacao.';
  }

  function castModeLabel(skill: any) {
    if (!skill) return '-';
    if (skill.castMode === 'ground') return 'Area no chao';
    if (skill.castMode === 'self_aoe') return 'Area ao redor';
    if (skill.castMode === 'cone') return 'Cone frontal';
    if (skill.castMode === 'line') return 'Linha';
    if (skill.castMode === 'summon') return 'Invocacao';
    return skill.target === 'self' ? 'Proprio personagem' : 'Alvo unico';
  }

  function rangeLabel(skill: any) {
    if (!skill) return '-';
    if (skill.castMode === 'self_aoe') return `Raio ${skill.aoeRadius || 0}px`;
    if (skill.castMode === 'ground') return `Alcance ${skill.range || 0}px | Raio ${skill.aoeRadius || 0}px`;
    if (skill.castMode === 'cone') return `Alcance ${skill.range || 0}px | Cone ${skill.coneAngleDeg || 0} graus`;
    if (skill.castMode === 'line') return `Linha ${skill.lineLength || 0}px | Largura ${skill.lineWidth || 0}px`;
    if (skill.castMode === 'summon') return 'Consome cargas necroticas';
    return skill.target === 'self' ? 'Sem alcance externo' : `${skill.range || 0}px`;
  }

  function dragSkill(skill: any) {
    if (!skill?.learned) return;
    beginDrag({ source: 'skill', skillId: skill.id, skillName: skill.label });
  }

  function handleNodeKeydown(event: KeyboardEvent, skillId: string) {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    selectedSkillId = skillId;
  }
</script>

<Window
  title="Habilidades"
  subtitle="Progressao de classe"
  width="clamp(840px, 76vw, 1020px)"
  maxWidth="1020px"
  maxBodyHeight="min(78vh, 760px)"
  on:close={() => dispatch('close')}
>
  <div class="skills-shell">
    <div class="skills-topbar">
      <div class="skills-summary-card">
        <div class="card-kicker">Classe ativa</div>
        <div class="summary-value">{$skillsStore.classId}</div>
        <div class="summary-meta">Nivel {$skillsStore.playerLevel} | {$skillsStore.skillPoints} ponto(s)</div>
      </div>

      <div class="skills-tabs">
        <button class:active={activeBuild === 'buildA'} type="button" on:click={() => activeBuild = 'buildA'}>{buildAName}</button>
        <button class:active={activeBuild === 'buildB'} type="button" on:click={() => activeBuild = 'buildB'}>{buildBName}</button>
      </div>
    </div>

    <div class="skills-main">
      <section class="skills-tree-column">
        <div class="tree-header">
          <div class="tree-title-block">
            <div class="card-kicker">Trilha ativa</div>
            <div class="tree-title">{activeBuild === 'buildA' ? buildAName : buildBName}</div>
          </div>
          <div class="tree-help">Desbloqueios em niveis 1, 10, 20, 30 e 40</div>
        </div>

        <div class="vertical-tree">
          {#each visibleSkills as entry, index (entry.id)}
            <div class={`tree-row ${selectedSkill?.id === entry.id ? 'selected' : ''} ${entry.learned ? 'learned' : ''} ${!entry.requiredLevelMet || !entry.prereqMet ? 'locked' : ''}`}>
              <button class="tree-node" type="button" on:click={() => selectedSkillId = entry.id} on:keydown={(event) => handleNodeKeydown(event, entry.id)}>
                <div class="tier-badge">Lv {entry.requiredLevel}</div>

                <span
                  class={`skill-icon-shell drag-handle ${entry.learned ? 'ready' : 'disabled'}`}
                  draggable={entry.learned}
                  role="presentation"
                  title={entry.learned ? 'Arraste o icone para a barra de habilidades.' : 'Aprenda a habilidade para arrastar.'}
                  on:dragstart|stopPropagation={() => dragSkill(entry)}
                >
                  <img class="skill-icon" src={entry.iconUrl} alt={entry.label} />
                </span>

                <div class="tree-main">
                  <div class="tree-topline">
                    <span class="skill-name">{entry.label}</span>
                    <span class={`role-chip role-${entry.role.toLowerCase()}`}>{entry.role}</span>
                  </div>
                  <div class="tree-summary">{entry.summary}</div>
                  <div class="rank-track">
                    {#each rankPips(entry.level, entry.maxPoints) as filled}
                      <span class:filled></span>
                    {/each}
                  </div>
                  <div class="tree-meta">
                    <span>Rank {entry.level}/{entry.maxPoints}</span>
                    <span>{castModeLabel(entry)}</span>
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
          {#key detailKey}
            <div class="detail-body">
              <div class="card-kicker">Detalhes</div>

              <div class="detail-head">
                <span
                  class={`detail-icon-shell drag-handle ${selectedSkill.learned ? 'ready' : 'disabled'}`}
                  draggable={selectedSkill.learned}
                  role="presentation"
                  title={selectedSkill.learned ? 'Arraste o icone para a barra de habilidades.' : 'Aprenda a habilidade para arrastar.'}
                  on:dragstart={() => dragSkill(selectedSkill)}
                >
                  <img class="detail-icon" src={selectedSkill.iconUrl} alt={selectedSkill.label} />
                </span>

                <div class="detail-heading">
                  <div class="detail-title">{selectedSkill.label}</div>
                  <div class="detail-summary">{selectedSkill.summary}</div>
                </div>
              </div>

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
                  <span class="detail-label">Tipo</span>
                  <strong>{castModeLabel(selectedSkill)}</strong>
                </div>
                <div class="detail-cell">
                  <span class="detail-label">Recarga</span>
                  <strong>{(selectedSkill.cooldownMs / 1000).toFixed(selectedSkill.cooldownMs % 1000 === 0 ? 0 : 1)}s</strong>
                </div>
                <div class="detail-cell detail-wide">
                  <span class="detail-label">Alcance</span>
                  <strong>{rangeLabel(selectedSkill)}</strong>
                </div>
              </div>

              <div class="detail-rank-panel">
                <div class="detail-label">Evolucao por rank</div>
                <div class="rank-track detail-track">
                  {#each rankPips(selectedSkill.level, selectedSkill.maxPoints) as filled}
                    <span class:filled></span>
                  {/each}
                </div>
                <div class="detail-summary">{scalingHint(selectedSkill)}</div>
                <div class="detail-tip">{selectedSkill.learned ? 'Arraste o icone da habilidade para a hotbar para criar um atalho.' : 'Aprenda a habilidade para poder arrasta-la para a hotbar.'}</div>
              </div>
            </div>
          {/key}
        {/if}
      </aside>
    </div>
  </div>
</Window>

<style>
  .skills-shell {
    display: grid;
    gap: 14px;
    min-height: 520px;
  }

  .skills-topbar {
    display: grid;
    grid-template-columns: minmax(220px, 260px) minmax(0, 1fr);
    gap: 14px;
    align-items: stretch;
  }

  .skills-main {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(250px, 280px);
    gap: 14px;
    min-height: 0;
  }

  .skills-summary-card,
  .skill-detail-card {
    padding: 12px 14px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: linear-gradient(180deg, rgba(13, 11, 10, 0.96), rgba(7, 7, 8, 0.98));
    clip-path: polygon(14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px), 0 14px);
  }

  .card-kicker,
  .detail-label {
    font-family: 'Cinzel', serif;
    font-size: 0.62rem;
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
    letter-spacing: 0.05em;
  }

  .summary-value {
    font-size: 0.96rem;
  }

  .summary-meta,
  .tree-help,
  .detail-summary,
  .detail-tip,
  .tree-summary {
    color: rgba(233, 223, 200, 0.74);
    font-size: 0.78rem;
    line-height: 1.42;
  }

  .skills-tabs {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }

  .skills-tabs button,
  .learn-btn,
  .tree-node {
    border: 1px solid rgba(201, 168, 106, 0.24);
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
  }

  .skills-tabs button,
  .learn-btn {
    min-height: 42px;
    background: linear-gradient(180deg, rgba(32, 24, 15, 0.96), rgba(12, 10, 8, 0.98));
    color: #ecdcb8;
    font-family: 'Cinzel', serif;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .skills-tabs button.active {
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.16), 0 0 16px rgba(201, 168, 106, 0.14);
  }

  .skills-tree-column {
    min-width: 0;
    display: grid;
    gap: 10px;
  }

  .tree-header {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: end;
  }

  .tree-title-block {
    display: grid;
    gap: 4px;
  }

  .vertical-tree {
    padding-right: 6px;
    max-height: min(56vh, 590px);
    overflow-y: auto;
  }

  .tree-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 50px;
    gap: 10px;
    align-items: stretch;
  }

  .tree-node {
    width: 100%;
    display: grid;
    grid-template-columns: 74px 52px minmax(0, 1fr);
    gap: 12px;
    padding: 10px;
    background: linear-gradient(180deg, rgba(15, 13, 11, 0.94), rgba(8, 8, 9, 0.98));
    text-align: left;
    align-items: start;
  }

  .tree-row.selected .tree-node {
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.16), 0 0 18px rgba(201, 168, 106, 0.16);
  }

  .tree-row.learned .tree-node {
    border-color: rgba(201, 168, 106, 0.38);
  }

  .tree-row.locked .tree-node {
    opacity: 0.8;
  }

  .tier-badge {
    min-height: 50px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(201, 168, 106, 0.2);
    background: rgba(24, 18, 13, 0.92);
    color: #f0dfbc;
    font-family: 'Cinzel', serif;
    text-transform: uppercase;
  }

  .skill-icon-shell,
  .detail-icon-shell {
    width: 52px;
    height: 52px;
    display: grid;
    place-items: center;
    align-self: start;
    border: 1px solid rgba(201, 168, 106, 0.22);
    background: rgba(12, 12, 13, 0.96);
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
    overflow: hidden;
  }

  .detail-icon-shell {
    width: 68px;
    height: 68px;
  }

  .drag-handle.ready {
    cursor: grab;
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.12), 0 0 14px rgba(201, 168, 106, 0.1);
  }

  .drag-handle.ready:active {
    cursor: grabbing;
  }

  .drag-handle.disabled {
    opacity: 0.62;
  }

  .skill-icon,
  .detail-icon {
    width: calc(100% - 8px);
    height: calc(100% - 8px);
    object-fit: contain;
    filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.28));
  }

  .tree-main {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .tree-topline,
  .tree-meta {
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
    font-size: 0.88rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .role-chip {
    padding: 4px 8px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(20, 18, 16, 0.92);
    color: rgba(235, 223, 196, 0.82);
    font-size: 0.64rem;
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

  .rank-track {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .rank-track span {
    width: 18px;
    height: 7px;
    border-radius: 999px;
    background: rgba(201, 168, 106, 0.12);
    border: 1px solid rgba(201, 168, 106, 0.14);
  }

  .rank-track span.filled {
    background: linear-gradient(90deg, rgba(235, 196, 122, 0.9), rgba(255, 233, 182, 0.78));
    border-color: rgba(255, 224, 168, 0.42);
    box-shadow: 0 0 10px rgba(214, 176, 98, 0.22);
  }

  .tree-meta,
  .locked-note {
    color: rgba(213, 202, 177, 0.68);
    font-size: 0.72rem;
  }

  .locked-note {
    color: #efc1b5;
  }

  .tree-actions {
    display: grid;
  }

  .learn-btn {
    min-height: 100%;
    font-size: 1.14rem;
  }

  .learn-btn:disabled {
    opacity: 0.45;
    cursor: not-allowed;
  }

  .tree-link {
    width: 4px;
    height: 24px;
    margin: 0 auto;
    background: linear-gradient(180deg, rgba(201, 168, 106, 0.12), rgba(201, 168, 106, 0.04));
  }

  .tree-link.lit {
    background: linear-gradient(180deg, rgba(201, 168, 106, 0.38), rgba(201, 168, 106, 0.12));
  }

  .skill-detail-card,
  .detail-body,
  .detail-heading,
  .detail-rank-panel {
    display: grid;
    gap: 10px;
    align-content: start;
  }

  .detail-head {
    display: grid;
    grid-template-columns: 68px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }

  .detail-cell {
    display: grid;
    gap: 6px;
    padding: 10px;
    border: 1px solid rgba(201, 168, 106, 0.14);
    background: rgba(10, 10, 10, 0.62);
  }

  .detail-cell.detail-wide {
    grid-column: 1 / -1;
  }

  .detail-cell strong {
    color: #f0dfbc;
    font-size: 0.8rem;
    line-height: 1.35;
  }

  .detail-rank-panel {
    padding: 12px;
    border: 1px solid rgba(201, 168, 106, 0.14);
    background: rgba(10, 10, 10, 0.52);
  }

  .detail-track span {
    width: 22px;
    height: 8px;
  }

  @media (max-width: 1100px) {
    .skills-main {
      grid-template-columns: 1fr;
    }

    .skill-detail-card {
      order: 2;
    }
  }

  @media (max-width: 820px) {
    .skills-topbar {
      grid-template-columns: 1fr;
    }

    .skills-tabs {
      grid-template-columns: 1fr;
    }

    .detail-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
