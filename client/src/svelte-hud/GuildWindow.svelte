<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';

  const dispatch = createEventDispatcher<{ close: void }>();
</script>

<Window title="Guilda" subtitle="Ordem de Noxis" width="380px" on:close={() => dispatch('close')}>
  <div class="crest">N</div>
  <div class="title">Ordem de Noxis</div>
  <div class="subtitle">Painel pronto para integrar o backend de guilda.</div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Mestre</div>
      <div class="value">-</div>
    </div>
    <div class="summary-card">
      <div class="label">Membros</div>
      <div class="value">1</div>
    </div>
    <div class="summary-card">
      <div class="label">Foco</div>
      <div class="value">PvE</div>
    </div>
  </div>
</Window>

<style>
  .crest {
    width: 72px;
    height: 72px;
    margin: 0 auto 12px;
    display: grid;
    place-items: center;
    border-radius: 20px;
    border: 1px solid rgba(201, 168, 106, 0.42);
    color: #f3e7cf;
    font-family: 'Cinzel', serif;
    font-size: 1.8rem;
    background: radial-gradient(circle at 35% 30%, rgba(201, 168, 106, 0.34), rgba(46, 33, 18, 0.18) 48%, rgba(11, 13, 15, 0.96) 100%);
  }

  .title,
  .label {
    font-family: 'Cinzel', serif;
    color: #f0dfbc;
    text-transform: uppercase;
  }

  .title,
  .subtitle {
    text-align: center;
  }

  .subtitle,
  .value {
    color: rgba(233, 223, 200, 0.72);
    font-size: 0.82rem;
  }

  .summary-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
    margin-top: 14px;
  }

  .summary-card {
    padding: 12px;
    border-radius: 14px;
    border: 1px solid rgba(201, 168, 106, 0.16);
    background: rgba(13, 16, 18, 0.84);
  }

  .label {
    font-size: 0.68rem;
    letter-spacing: 0.08em;
    margin-bottom: 6px;
  }
</style>
