<script lang="ts">
  import Window from './components/Window.svelte';
  import { beginDrag, learnSkill, skillsStore } from './stores/gameUi';

  let activeBuild: 'buildA' | 'buildB' = 'buildA';

  $: visibleSkills = $skillsStore.entries.filter((entry) => entry.buildKey === activeBuild);
</script>

<Window title="Habilidades" subtitle="Arvore de classe" width="520px">
  <div class="skills-topbar">
    <div class="skills-points">Pontos {$skillsStore.skillPoints}</div>
    <div class="skills-tabs">
      <button class:active={activeBuild === 'buildA'} type="button" on:click={() => activeBuild = 'buildA'}>{visibleSkills[0]?.buildLabel || 'Build A'}</button>
      <button class:active={activeBuild === 'buildB'} type="button" on:click={() => activeBuild = 'buildB'}>{$skillsStore.entries.find((entry) => entry.buildKey === 'buildB')?.buildLabel || 'Build B'}</button>
    </div>
  </div>

  <div class="auto-attack-bar">
    {#each $skillsStore.autoAttack as entry}
      <button class="auto-attack-pill" draggable="true" type="button" on:dragstart={() => beginDrag(entry.id === 'class_primary' ? { source: 'basic', skillId: 'class_primary', skillName: entry.label } : { source: 'skill', skillId: entry.id, skillName: entry.label })}>
        {entry.label}
      </button>
    {/each}
  </div>

  <div class="skills-list">
    {#each visibleSkills as entry}
      <div class={`skill-card ${entry.learned ? 'learned' : ''}`}>
        <div class="skill-body" role="button" tabindex={entry.learned ? 0 : -1} draggable={entry.learned} on:dragstart={() => entry.learned && beginDrag({ source: 'skill', skillId: entry.id, skillName: entry.label })}>
          <div class="skill-name">{entry.label}</div>
          <div class="skill-meta">{entry.level}/{entry.maxPoints}</div>
        </div>
        <button class="learn-btn" disabled={!$skillsStore.skillPoints || entry.level >= entry.maxPoints} type="button" on:click={() => learnSkill(entry.id)}>+</button>
      </div>
    {/each}
  </div>
</Window>

<style>
  .skills-topbar,
  .skills-tabs,
  .skills-list,
  .auto-attack-bar {
    display: grid;
    gap: 10px;
  }

  .skills-topbar {
    margin-bottom: 12px;
  }

  .skills-points {
    font-family: 'Cinzel', serif;
    font-size: 0.76rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(201, 168, 106, 0.78);
  }

  .skills-tabs {
    grid-template-columns: 1fr 1fr;
  }

  .skills-tabs button,
  .learn-btn,
  .auto-attack-pill {
    min-height: 40px;
    border: 1px solid rgba(201, 168, 106, 0.28);
    background: linear-gradient(180deg, rgba(32, 24, 15, 0.96), rgba(12, 10, 8, 0.98));
    color: #ecdcb8;
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
    font-family: 'Cinzel', serif;
  }

  .skills-tabs button.active {
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.16), 0 0 16px rgba(201, 168, 106, 0.16);
  }

  .auto-attack-bar {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    margin-bottom: 12px;
  }

  .skills-list {
    max-height: 420px;
    overflow-y: auto;
  }

  .skill-card {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 42px;
    gap: 8px;
    align-items: center;
  }

  .skill-body {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    clip-path: polygon(10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px), 0 10px);
    border: 1px solid rgba(201, 168, 106, 0.2);
    background: rgba(10, 10, 10, 0.72);
    color: rgba(233, 223, 200, 0.78);
  }

  .skill-card.learned .skill-body {
    border-color: rgba(201, 168, 106, 0.34);
    box-shadow: 0 0 16px rgba(201, 168, 106, 0.08);
  }

  .skill-name {
    font-family: 'Cinzel', serif;
    font-size: 0.82rem;
    color: #f0dfbc;
  }

  .skill-meta {
    font-size: 0.72rem;
  }
</style>
