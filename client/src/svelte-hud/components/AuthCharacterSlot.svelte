<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let slot: any = null;
  export let selected = false;
  export let index = 0;

  const dispatch = createEventDispatcher<{ press: number }>();

  function classMark(classId: string) {
    switch (String(classId || '').toLowerCase()) {
      case 'knight': return 'K';
      case 'archer': return 'A';
      case 'druid': return 'D';
      case 'assassin': return 'S';
      case 'necromancer': return 'N';
      default: return 'N';
    }
  }
</script>

<button class:selected class:empty={!slot} class="slot-card" on:click={() => slot && dispatch('press', index)} type="button">
  {#if slot}
    <div class={`slot-avatar class-${String(slot.class || 'knight')}`}>{classMark(slot.class)}</div>
    <div class="slot-body">
      <div class="slot-name">{slot.name}</div>
      <div class="slot-meta">Nivel {slot.level} • {slot.gender === 'female' ? 'Feminino' : 'Masculino'}</div>
      <div class="slot-class">{slot.class}</div>
    </div>
  {:else}
    <div class="empty-title">Slot Vazio</div>
    <div class="empty-copy">Crie um novo heroi para iniciar sua jornada.</div>
  {/if}
</button>

<style>
  .slot-card {
    pointer-events: auto;
    display: grid;
    grid-template-columns: 64px 1fr;
    gap: 12px;
    min-height: 120px;
    width: 100%;
    padding: 14px;
    border: 1px solid rgba(201, 168, 106, 0.28);
    background:
      radial-gradient(circle at top, rgba(255, 230, 176, 0.08), transparent 34%),
      linear-gradient(180deg, rgba(35, 24, 14, 0.96), rgba(15, 11, 8, 0.98));
    clip-path: polygon(18px 0, calc(100% - 18px) 0, 100% 18px, 100% calc(100% - 18px), calc(100% - 18px) 100%, 18px 100%, 0 calc(100% - 18px), 0 18px);
    color: #ecdab4;
    text-align: left;
    transition: transform 160ms ease, box-shadow 180ms ease, border-color 180ms ease;
  }

  .slot-card:hover:not(:disabled) {
    transform: translateY(-2px);
    border-color: rgba(226, 191, 123, 0.5);
    box-shadow: 0 18px 30px rgba(0, 0, 0, 0.22), 0 0 0 1px rgba(201, 168, 106, 0.12);
  }

  .slot-card.empty {
    grid-template-columns: 1fr;
    border-style: dashed;
    color: rgba(233, 216, 183, 0.72);
  }

  .slot-card.selected {
    border-color: rgba(234, 197, 123, 0.7);
    box-shadow: 0 0 0 1px rgba(234, 197, 123, 0.2), 0 0 26px rgba(201, 168, 106, 0.18);
  }

  .slot-avatar {
    display: grid;
    place-items: center;
    width: 64px;
    height: 64px;
    border-radius: 18px;
    border: 1px solid rgba(230, 195, 132, 0.34);
    font-family: 'Cinzel', serif;
    font-weight: 800;
    font-size: 1.5rem;
    color: #fff4d8;
    box-shadow: inset 0 0 0 1px rgba(255, 243, 211, 0.06);
  }

  .class-knight { background: linear-gradient(180deg, #2b4f8c, #16253f); }
  .class-archer { background: linear-gradient(180deg, #7a5415, #35210b); }
  .class-druid { background: linear-gradient(180deg, #345d2a, #172812); }
  .class-assassin { background: linear-gradient(180deg, #5a235d, #221025); }
  .class-necromancer { background: linear-gradient(180deg, #5a4ab0, #241946); }

  .slot-body {
    display: grid;
    align-content: start;
    gap: 6px;
  }

  .slot-name,
  .empty-title {
    font-family: 'Cinzel', serif;
    font-size: 0.9rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }

  .slot-meta,
  .slot-class,
  .empty-copy {
    font-size: 0.76rem;
    color: rgba(232, 220, 194, 0.74);
  }

  .slot-class {
    text-transform: capitalize;
  }
</style>
