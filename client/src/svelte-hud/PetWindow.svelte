<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import { activePetStore, feedPet, renamePet, setPetBehavior, summonPet, unsummonPet } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();

  let renameDrafts: Record<string, string> = {};

  $: petState = $activePetStore.state || null;
  $: ownedPets = Array.isArray($activePetStore.ownedPets) ? $activePetStore.ownedPets : [];
  $: activePetOwnershipId = String($activePetStore.activePetOwnershipId || '');
  $: behavior = String($activePetStore.behavior || 'assist');

  function draftNameFor(pet: any) {
    const ownershipId = String(pet?.id || '');
    return renameDrafts[ownershipId] ?? String(pet?.name || '');
  }

  function submitRename(pet: any) {
    const ownershipId = String(pet?.id || '');
    const nextName = String(draftNameFor(pet) || '').trim();
    if (!ownershipId || !nextName || nextName === String(pet?.name || '')) return;
    renamePet(ownershipId, nextName);
  }

  function roleLabel(role: string) {
    if (role === 'support') return 'Suporte';
    if (role === 'defensive') return 'Defensivo';
    return 'Ofensivo';
  }

  function moveLabel(moveStyle: string) {
    if (moveStyle === 'flying') return 'Voador';
    if (moveStyle === 'heavy') return 'Pesado';
    if (moveStyle === 'ranged') return 'A distancia';
    return 'Terrestre';
  }
</script>

<Window title="Pets" subtitle="Companheiros de jornada" width="clamp(560px, 56vw, 720px)" maxWidth="720px" maxBodyHeight="min(82vh, 860px)" on:close={() => dispatch('close')}>
  <div class="pet-shell">
    <section class="hero-card">
      <div class="hero-title">
        <div class="hud-kicker">Companheiro ativo</div>
        <div class="hero-name">{$activePetStore.activeWorldPet?.name || 'Nenhum pet invocado'}</div>
        <div class="hud-meta">
          {#if $activePetStore.activeWorldPet}
            {$activePetStore.activeWorldPet.role} | {$activePetStore.activeWorldPet.moveStyle} | modo {behavior}
          {:else}
            Escolha um pet para acompanhar seu personagem.
          {/if}
        </div>
      </div>

      <div class="behavior-actions">
        {#each [
          ['follow', 'Seguir'],
          ['assist', 'Assistir'],
          ['passive', 'Passivo']
        ] as [mode, label]}
          <button class={`hud-btn mini ${behavior === mode ? '' : 'ghost'}`} type="button" on:click={() => setPetBehavior(mode as 'follow' | 'assist' | 'passive')}>
            {label}
          </button>
        {/each}
        <button class="hud-btn mini ghost" type="button" on:click={() => feedPet(activePetOwnershipId || undefined)}>Alimentar</button>
        <button class="hud-btn mini danger" type="button" on:click={unsummonPet}>Recolher</button>
      </div>
    </section>

    <section class="pet-grid">
      {#each ownedPets as pet}
        <article class={`pet-card ${activePetOwnershipId === String(pet.id || '') ? 'active' : ''}`}>
          <div class="pet-crest">{String(pet?.name || 'P').slice(0, 1).toUpperCase()}</div>
          <div class="pet-main">
            <div class="pet-head">
              <div>
                <div class="pet-name">{pet.name || 'Pet'}</div>
                <div class="hud-meta">Nv. {Number(pet.level || 1)} | {roleLabel(String(pet.role || 'offensive'))} | {moveLabel(String(pet.moveStyle || 'ground'))}</div>
              </div>
              <button class="hud-btn mini" type="button" on:click={() => summonPet(String(pet.id || ''))}>
                {activePetOwnershipId === String(pet.id || '') ? 'Ativo' : 'Invocar'}
              </button>
            </div>

            <div class="pet-stats">
              <span class="hud-pill">Lealdade {Number(pet.loyalty || 0)}%</span>
              <span class="hud-pill">Fome {Number(pet.hunger || 0)}%</span>
              <span class="hud-pill">XP {Number(pet.xp || 0)}</span>
            </div>

            <div class="rename-row">
              <input bind:value={renameDrafts[pet.id]} class="hud-input" type="text" maxlength="24" placeholder={String(pet.name || 'Renomear pet')} />
              <button class="hud-btn mini ghost" type="button" on:click={() => submitRename(pet)}>Salvar nome</button>
            </div>
          </div>
        </article>
      {/each}
    </section>
  </div>
</Window>

<style>
  .pet-shell,
  .pet-grid,
  .pet-main,
  .behavior-actions,
  .pet-stats {
    display: grid;
    gap: 12px;
  }

  .hero-card,
  .pet-card {
    display: grid;
    gap: 12px;
    padding: 14px;
    border-radius: 16px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(7, 9, 12, 0.58);
  }

  .hero-card {
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: start;
  }

  .behavior-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    gap: 8px;
  }

  .pet-grid {
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  }

  .pet-card {
    grid-template-columns: 72px minmax(0, 1fr);
    align-items: start;
  }

  .pet-card.active {
    border-color: rgba(201, 168, 106, 0.42);
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.12), 0 0 18px rgba(201, 168, 106, 0.1);
  }

  .pet-crest {
    width: 72px;
    height: 72px;
    display: grid;
    place-items: center;
    border-radius: 18px;
    border: 1px solid rgba(201, 168, 106, 0.34);
    background: radial-gradient(circle at 35% 30%, rgba(201, 168, 106, 0.3), rgba(46, 33, 18, 0.2) 48%, rgba(10, 12, 14, 0.96) 100%);
    color: #f4e8cd;
    font-family: var(--hud-font-display);
    font-size: 1.4rem;
  }

  .hero-name,
  .pet-name {
    font-family: var(--hud-font-display);
    color: var(--hud-gold);
    text-transform: uppercase;
  }

  .pet-head,
  .rename-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
  }

  .pet-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  @media (max-width: 760px) {
    .hero-card,
    .pet-card,
    .pet-head,
    .rename-row {
      grid-template-columns: 1fr;
    }
  }
</style>

