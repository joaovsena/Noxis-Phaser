<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Window from './components/Window.svelte';
  import { activePetStore, feedPet, renamePet, setPetBehavior, summonPet, unsummonPet } from './stores/gameUi';

  const dispatch = createEventDispatcher<{ close: void }>();

  let renameDrafts: Record<string, string> = {};
  let selectedTab: 'pet' | 'genius' | 'wardrobe' = 'pet';
  let selectedPetId = '';
  let selectedPet: any = null;

  $: petState = $activePetStore.state || null;
  $: ownedPets = Array.isArray($activePetStore.ownedPets) ? $activePetStore.ownedPets : [];
  $: activePetOwnershipId = String($activePetStore.activePetOwnershipId || '');
  $: behavior = String($activePetStore.behavior || 'assist');
  $: if (!ownedPets.some((pet: any) => String(pet?.id || '') === selectedPetId)) {
    selectedPetId = String(
      ownedPets.find((pet: any) => String(pet?.id || '') === activePetOwnershipId)?.id
      || ownedPets[0]?.id
      || ''
    );
  }
  $: selectedPet = ownedPets.find((pet: any) => String(pet?.id || '') === selectedPetId) || null;
  $: petHpValue = Number($activePetStore.activeWorldPet?.hp || 0);
  $: petHpMax = Math.max(1, Number($activePetStore.activeWorldPet?.maxHp || 1));
  $: petHpRatio = Math.max(0, Math.min(1, petHpValue / petHpMax));
  $: petXpMax = Math.max(100, Number(selectedPet?.xpToNext || selectedPet?.nextLevelXp || selectedPet?.xpCap || selectedPet?.xp || 100));
  $: petXpRatio = Math.max(0, Math.min(1, Number(selectedPet?.xp || 0) / petXpMax));

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

<Window title="Pet" subtitle="Pet" theme="classic" minimizable={false} width="clamp(760px, 72vw, 920px)" maxWidth="920px" maxBodyHeight="min(84vh, 880px)" on:close={() => dispatch('close')}>
  <div class="pet-window">
    <div class="pet-tabs">
      <button class:active={selectedTab === 'pet'} type="button" on:click={() => selectedTab = 'pet'}>Pet</button>
      <button class:active={selectedTab === 'genius'} type="button" on:click={() => selectedTab = 'genius'}>Genio</button>
      <button class:active={selectedTab === 'wardrobe'} type="button" on:click={() => selectedTab = 'wardrobe'}>Armario de Pet</button>
    </div>

    {#if selectedTab === 'pet'}
      <div class="pet-grid">
        <section class="preview-panel">
          <div class="pet-avatar-shell">
            <div class="pet-avatar-core">{String(selectedPet?.name || 'P').slice(0, 1).toUpperCase()}</div>
          </div>

          <div class="pet-actions">
            <button type="button" disabled={!selectedPet} on:click={() => selectedPet && summonPet(String(selectedPet.id || ''))}>
              {selectedPet && activePetOwnershipId === String(selectedPet.id || '') ? 'Ativo' : 'Invocar'}
            </button>
            <button type="button" class="ghost" on:click={unsummonPet}>Chamar de volta</button>
            <button type="button" class="ghost" disabled={!selectedPet} on:click={() => feedPet(selectedPet ? String(selectedPet.id || '') : undefined)}>Alimentar</button>
          </div>

          <div class="pet-mini-stats">
            <div class="mini-row"><span>Forca</span><strong>{Number(selectedPet?.level || 0) + 10}</strong></div>
            <div class="mini-row"><span>Agilidade</span><strong>{Math.max(0, Number(selectedPet?.loyalty || 0))}</strong></div>
            <div class="mini-row"><span>Inteligencia</span><strong>{Math.max(0, Number(selectedPet?.xp || 0))}</strong></div>
            <div class="mini-row"><span>Resistencia</span><strong>{Math.max(0, Number(selectedPet?.hunger || 0))}</strong></div>
          </div>
        </section>

        <section class="management-panel">
          <div class="panel-title">Armario de Pet</div>

          <div class="pet-roster">
            {#each ownedPets as pet}
              <button
                class={`pet-roster-card ${selectedPetId === String(pet?.id || '') ? 'active' : ''}`}
                type="button"
                on:click={() => selectedPetId = String(pet?.id || '')}
              >
                <span>{String(pet?.name || 'Pet').slice(0, 1).toUpperCase()}</span>
              </button>
            {/each}
          </div>

          {#if selectedPet}
            <div class="pet-info-grid">
              <div class="info-row"><span>Nome</span><strong>{selectedPet.name || 'Pet'}</strong></div>
              <div class="info-row"><span>Nivel</span><strong>{Number(selectedPet.level || 1)}</strong></div>
              <div class="info-row"><span>Classe</span><strong>{roleLabel(String(selectedPet.role || 'offensive'))}</strong></div>
              <div class="info-row"><span>Movimento</span><strong>{moveLabel(String(selectedPet.moveStyle || 'ground'))}</strong></div>
              <div class="info-row"><span>Lealdade</span><strong>{Number(selectedPet.loyalty || 0)}%</strong></div>
              <div class="info-row"><span>Fome</span><strong>{Number(selectedPet.hunger || 0)}%</strong></div>
            </div>

            <div class="rename-row">
              <input bind:value={renameDrafts[selectedPet.id]} type="text" maxlength="24" placeholder={String(selectedPet.name || 'Renomear pet')} />
              <button type="button" on:click={() => submitRename(selectedPet)}>Alterar</button>
            </div>

            <div class="bar-stack">
              <div class="stat-bar">
                <div class="stat-fill hp-fill" style={`transform: scaleX(${petHpRatio});`}></div>
                <span>HP {petHpValue} / {petHpMax}</span>
              </div>
              <div class="stat-bar">
                <div class="stat-fill xp-fill" style={`transform: scaleX(${petXpRatio});`}></div>
                <span>EXP {Number(selectedPet.xp || 0)} / {petXpMax}</span>
              </div>
            </div>

            <div class="behavior-row">
              {#each [
                ['follow', 'Seguir'],
                ['assist', 'Assistir'],
                ['passive', 'Passivo']
              ] as [mode, label]}
                <button class:active={behavior === mode} type="button" on:click={() => setPetBehavior(mode as 'follow' | 'assist' | 'passive')}>
                  {label}
                </button>
              {/each}
            </div>
          {:else}
            <div class="empty-note">Nenhum pet encontrado.</div>
          {/if}
        </section>

        <section class="bond-panel">
          <div class="panel-title">Equipamento do Pet</div>
          <div class="spirit-wheel">
            {#each Array.from({ length: 14 }) as _, index}
              <span style={`--angle:${(index / 14) * 360}deg; --tone:${index % 3 === 0 ? '#86ddff' : index % 3 === 1 ? '#ffe48b' : '#ff9cc5'};`}></span>
            {/each}
          </div>

          <div class="bond-copy">
            <div class="info-row"><span>Modo</span><strong>{behavior}</strong></div>
            <div class="info-row"><span>Pet ativo</span><strong>{$activePetStore.activeWorldPet?.name || '-'}</strong></div>
            <div class="info-row"><span>Dono</span><strong>{$activePetStore.activeWorldPet?.ownerName || $activePetStore.activeWorldPet?.owner || '-'}</strong></div>
          </div>
        </section>
      </div>

      <section class="command-strip">
        <div class="panel-title">Habilidades do Pet</div>
        <div class="command-row">
          {#each ['Atacar', 'Seguir', 'Assistir', 'Passivo', 'Open', 'Open', 'Open', 'Open'] as entry}
            <div class={`command-slot ${entry === 'Open' ? 'locked' : ''}`}>{entry}</div>
          {/each}
        </div>
      </section>
    {:else if selectedTab === 'genius'}
      <section class="placeholder-panel">
        <div class="panel-title">Genio</div>
        <p>Essa aba ainda nao tem dados expostos pelo cliente, mas o layout ja foi preparado no tema classico.</p>
      </section>
    {:else}
      <section class="placeholder-panel">
        <div class="panel-title">Armario de Pet</div>
        <p>O armario de itens do pet ainda nao esta disponivel nesta interface.</p>
      </section>
    {/if}
  </div>
</Window>

<style>
  .pet-window,
  .pet-grid,
  .pet-mini-stats,
  .pet-roster,
  .pet-info-grid,
  .bar-stack,
  .bond-copy,
  .command-row {
    display: grid;
    gap: 10px;
  }

  .pet-tabs,
  .pet-actions,
  .rename-row,
  .behavior-row {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }

  .pet-tabs button,
  .pet-actions button,
  .rename-row button,
  .behavior-row button {
    min-height: 30px;
    padding: 0 12px;
    border-radius: 7px;
    border: 1px solid rgba(226, 201, 138, 0.22);
    background: linear-gradient(180deg, rgba(104, 85, 43, 0.92), rgba(60, 50, 26, 0.96));
    color: #fff1cf;
    font-family: var(--hud-font-display);
  }

  .pet-tabs button.active,
  .behavior-row button.active,
  .pet-roster-card.active {
    box-shadow: 0 0 0 1px rgba(226, 201, 138, 0.12), 0 0 12px rgba(226, 201, 138, 0.12);
  }

  .pet-tabs button:not(.active),
  .pet-actions .ghost {
    background: linear-gradient(180deg, rgba(74, 69, 49, 0.82), rgba(48, 45, 35, 0.92));
  }

  .pet-grid {
    grid-template-columns: 210px minmax(0, 1fr) 220px;
    align-items: start;
  }

  .preview-panel,
  .management-panel,
  .bond-panel,
  .command-strip,
  .placeholder-panel {
    padding: 12px;
    border-radius: 12px;
    border: 1px solid rgba(226, 201, 138, 0.18);
    background: rgba(77, 71, 46, 0.78);
  }

  .panel-title {
    color: #fff1cf;
    font-family: var(--hud-font-display);
    font-size: 0.76rem;
  }

  .pet-avatar-shell {
    width: 100%;
    aspect-ratio: 1 / 1;
    padding: 4px;
    border-radius: 18px;
    border: 1px solid rgba(233, 210, 150, 0.34);
    background: linear-gradient(180deg, rgba(108, 88, 45, 0.76), rgba(43, 35, 21, 0.96));
  }

  .pet-avatar-core {
    width: 100%;
    height: 100%;
    border-radius: 14px;
    display: grid;
    place-items: center;
    background:
      radial-gradient(circle at 50% 30%, rgba(166, 235, 255, 0.4), transparent 30%),
      linear-gradient(180deg, #3e87b0, #162331 88%);
    color: #eefcff;
    font-family: var(--hud-font-display);
    font-size: 2.6rem;
    text-transform: uppercase;
  }

  .pet-actions {
    justify-content: center;
  }

  .mini-row,
  .info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    background: rgba(42, 37, 25, 0.68);
    color: rgba(248, 241, 224, 0.84);
    font-size: 0.76rem;
  }

  .mini-row strong,
  .info-row strong {
    color: #fff3d5;
  }

  .pet-roster {
    grid-template-columns: repeat(auto-fit, minmax(52px, 1fr));
  }

  .pet-roster-card {
    min-height: 54px;
    border-radius: 10px;
    border: 1px solid rgba(226, 201, 138, 0.16);
    background: rgba(42, 37, 25, 0.68);
    color: #fff1cf;
    font-family: var(--hud-font-display);
    font-size: 1rem;
  }

  .rename-row input {
    min-height: 32px;
    flex: 1;
    min-width: 0;
    padding: 0 10px;
    border-radius: 8px;
    border: 1px solid rgba(226, 201, 138, 0.2);
    background: rgba(30, 28, 21, 0.92);
    color: #fff3d5;
  }

  .stat-bar {
    position: relative;
    height: 16px;
    overflow: hidden;
    border-radius: 999px;
    border: 1px solid rgba(227, 201, 134, 0.3);
    background: rgba(38, 34, 22, 0.92);
  }

  .stat-fill {
    position: absolute;
    inset: 0;
    transform-origin: left center;
  }

  .hp-fill {
    background: linear-gradient(90deg, #7a160f, #d1392b 58%, #ef9e5b);
  }

  .xp-fill {
    background: linear-gradient(90deg, #0e7b66, #28c7b0 56%, #aaffed);
  }

  .stat-bar span {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    color: #f8f3e2;
    font-size: 0.66rem;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.72);
  }

  .behavior-row {
    justify-content: center;
  }

  .spirit-wheel {
    position: relative;
    width: 180px;
    height: 180px;
    margin: 0 auto;
    border-radius: 999px;
    border: 1px solid rgba(233, 210, 150, 0.22);
    background:
      radial-gradient(circle, rgba(34, 29, 19, 0.98) 34%, rgba(74, 64, 38, 0.92) 35%, rgba(34, 29, 19, 0.98) 58%, rgba(18, 16, 12, 0.98) 100%);
  }

  .spirit-wheel span {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 14px;
    height: 14px;
    margin-left: -7px;
    margin-top: -82px;
    border-radius: 999px;
    background: var(--tone);
    box-shadow: 0 0 10px color-mix(in srgb, var(--tone) 56%, transparent);
    transform: rotate(var(--angle)) translateY(0);
  }

  .command-row {
    grid-template-columns: repeat(8, minmax(0, 1fr));
  }

  .command-slot {
    min-height: 58px;
    padding: 6px;
    border-radius: 8px;
    border: 1px solid rgba(226, 201, 138, 0.18);
    background: rgba(42, 37, 25, 0.68);
    display: grid;
    place-items: center;
    color: #fff1cf;
    font-size: 0.72rem;
    text-align: center;
  }

  .command-slot.locked {
    color: rgba(248, 241, 224, 0.58);
  }

  .placeholder-panel p,
  .empty-note {
    color: rgba(248, 241, 224, 0.84);
    font-size: 0.8rem;
    line-height: 1.5;
  }

  @media (max-width: 980px) {
    .pet-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 720px) {
    .command-row {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .rename-row {
      flex-direction: column;
      align-items: stretch;
    }
  }
</style>
