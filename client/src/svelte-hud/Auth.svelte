<script lang="ts">
  import goldCursorUrl from './assets/gold-pointer.svg';
  import AuthCharacterSlot from './components/AuthCharacterSlot.svelte';
  import { appStore, hudTransformStyle, selectCharacterSlot, sendUiMessage, setConnectionPhase } from './stores/gameUi';

  let mode: 'login' | 'register' = 'login';
  let loginUsername = '';
  let loginPassword = '';
  let registerUsername = '';
  let registerPassword = '';
  let createName = '';
  let createClass = 'knight';
  let createGender = 'male';

  $: phase = $appStore.connectionPhase;
  $: selectedSlot = $appStore.selectedCharacterSlot;
  $: canEnter = Number.isInteger(selectedSlot);

  function submitLogin() {
    sendUiMessage({
      type: 'auth_login',
      username: loginUsername.trim(),
      password: loginPassword
    });
  }

  function submitRegister() {
    sendUiMessage({
      type: 'auth_register',
      username: registerUsername.trim(),
      password: registerPassword
    });
  }

  function submitCreate() {
    sendUiMessage({
      type: 'character_create',
      name: createName.trim(),
      class: createClass,
      gender: createGender
    });
  }

  function handlePrimaryAction() {
    if (mode === 'login') submitLogin();
    else submitRegister();
  }
</script>

<section
  class="auth-shell"
  style={`--auth-cursor: url('${goldCursorUrl}') 4 2, auto; ${$hudTransformStyle}`}
>
  <div class="auth-noise"></div>
  <div class="auth-vignette"></div>

  <div class="auth-column">
    <div class="auth-mark" aria-hidden="true">
      <svg viewBox="0 0 64 64" role="img">
        <path d="M32 6 46 18v28L32 58 18 46V18Z" />
        <path d="M32 17v30" />
        <path d="M24 24l8-7 8 7" />
        <path d="M24 40l8 7 8-7" />
      </svg>
    </div>

    <div class="auth-title-wrap">
      <div class="auth-kicker">Dark Fantasy MMORPG</div>
      <h1>Noxis</h1>
      <p class="auth-subtitle">Entre no reino e acesse sua linhagem de herois.</p>
    </div>

    {#if phase === 'auth' || phase === 'connecting' || phase === 'disconnected'}
      <div class="auth-panel auth-panel-compact">
        <div class="mode-switch">
          <button class:active={mode === 'login'} type="button" on:click={() => mode = 'login'}>Login</button>
          <button class:active={mode === 'register'} type="button" on:click={() => mode = 'register'}>Registro</button>
        </div>

        <div class="field-stack">
          <label for="auth-username">Usuario</label>
          {#if mode === 'login'}
            <input
              id="auth-username"
              bind:value={loginUsername}
              maxlength="16"
              placeholder="Digite seu usuario"
              type="text"
            />
          {:else}
            <input
              id="auth-username"
              bind:value={registerUsername}
              maxlength="16"
              placeholder="Digite seu usuario"
              type="text"
            />
          {/if}

          <label for="auth-password">Senha</label>
          {#if mode === 'login'}
            <input
              id="auth-password"
              bind:value={loginPassword}
              maxlength="32"
              placeholder="Digite sua senha"
              type="password"
            />
          {:else}
            <input
              id="auth-password"
              bind:value={registerPassword}
              maxlength="32"
              placeholder="Digite sua senha"
              type="password"
            />
          {/if}
        </div>

        <div class="action-stack">
          <button class="primary-button" type="button" on:click={handlePrimaryAction}>
            {mode === 'login' ? 'Entrar' : 'Registrar'}
          </button>
          <button class="ghost-button" type="button" on:click={() => mode = mode === 'login' ? 'register' : 'login'}>
            {mode === 'login' ? 'Preciso me registrar' : 'Ja possuo uma conta'}
          </button>
        </div>
      </div>
    {:else if phase === 'character_select'}
      <div class="auth-panel auth-panel-wide">
        <div class="section-head">
          <div class="section-label">Selecao</div>
          <h2>Escolha seu personagem</h2>
        </div>

        <div class="character-stack">
          {#each Array.from({ length: 3 }, (_, index) => ({ index, slot: $appStore.characterSlots[index] || null })) as entry}
            <AuthCharacterSlot
              slot={entry.slot}
              index={entry.index}
              selected={selectedSlot === entry.index}
              on:press={(event) => selectCharacterSlot(event.detail)}
            />
          {/each}
        </div>

        <div class="action-stack">
          <button class="primary-button" disabled={!canEnter} type="button" on:click={() => canEnter && sendUiMessage({ type: 'character_enter', slot: selectedSlot })}>Jogar</button>
          <button class="secondary-button" type="button" on:click={() => setConnectionPhase('character_create')}>Criar personagem</button>
          <button class="ghost-button" type="button" on:click={() => sendUiMessage({ type: 'character.back' })}>Voltar</button>
        </div>
      </div>
    {:else if phase === 'character_create'}
      <div class="auth-panel auth-panel-compact">
        <div class="section-head">
          <div class="section-label">Criacao</div>
          <h2>Novo personagem</h2>
        </div>

        <div class="field-stack">
          <label for="create-name">Nome</label>
          <input id="create-name" bind:value={createName} maxlength="12" placeholder="3 a 12 caracteres" type="text" />

          <label for="create-class">Classe</label>
          <select id="create-class" bind:value={createClass}>
            <option value="knight">Cavaleiro</option>
            <option value="archer">Arqueiro</option>
            <option value="druid">Druida</option>
            <option value="assassin">Assassino</option>
          </select>

          <label for="create-gender">Sexo</label>
          <select id="create-gender" bind:value={createGender}>
            <option value="male">Masculino</option>
            <option value="female">Feminino</option>
          </select>
        </div>

        <div class="action-stack">
          <button class="primary-button" type="button" on:click={submitCreate}>Criar</button>
          <button class="ghost-button" type="button" on:click={() => setConnectionPhase('character_select')}>Voltar</button>
        </div>
      </div>
    {/if}

    <div class="auth-status">{$appStore.authMessage || 'As portas do reino estao silenciosas.'}</div>
  </div>
</section>

<style>
  .auth-shell {
    position: fixed;
    inset: 0;
    display: grid;
    place-items: center;
    overflow: hidden;
    pointer-events: none;
    cursor: var(--auth-cursor);
    transform-origin: center center;
    padding: clamp(12px, 2vh, 24px);
    box-sizing: border-box;
  }

  .auth-shell :global(*) {
    cursor: var(--auth-cursor);
  }

  .auth-noise,
  .auth-vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
  }

  .auth-noise {
    background:
      radial-gradient(circle at 50% 14%, rgba(201, 168, 106, 0.08), transparent 18%),
      linear-gradient(180deg, rgba(5, 8, 10, 0.96), rgba(3, 5, 6, 1));
  }

  .auth-noise::after {
    content: '';
    position: absolute;
    inset: 0;
    opacity: 0.08;
    background-image:
      radial-gradient(rgba(255, 255, 255, 0.22) 0.6px, transparent 0.8px),
      radial-gradient(rgba(201, 168, 106, 0.2) 0.5px, transparent 0.7px);
    background-size: 18px 18px, 26px 26px;
    background-position: 0 0, 11px 7px;
    mix-blend-mode: soft-light;
  }

  .auth-vignette {
    background:
      radial-gradient(circle at center, transparent 36%, rgba(0, 0, 0, 0.42) 100%),
      linear-gradient(180deg, rgba(0, 0, 0, 0.18), rgba(0, 0, 0, 0.36));
  }

  .auth-column {
    position: relative;
    z-index: 1;
    width: min(400px, calc(100vw - 24px));
    max-width: 100%;
    display: grid;
    justify-items: center;
    gap: 18px;
    pointer-events: none;
    max-height: 100%;
  }

  .auth-mark,
  .auth-title-wrap,
  .auth-panel,
  .auth-status {
    pointer-events: auto;
  }

  .auth-mark {
    width: 92px;
    height: 92px;
    display: grid;
    place-items: center;
    clip-path: polygon(24px 0, calc(100% - 24px) 0, 100% 24px, 100% calc(100% - 24px), calc(100% - 24px) 100%, 24px 100%, 0 calc(100% - 24px), 0 24px);
    border: 1px solid rgba(201, 168, 106, 0.4);
    background:
      radial-gradient(circle at 30% 28%, rgba(244, 227, 191, 0.2), transparent 34%),
      linear-gradient(180deg, rgba(24, 18, 12, 0.96), rgba(10, 8, 7, 0.98));
    box-shadow:
      0 18px 34px rgba(0, 0, 0, 0.34),
      inset 0 0 0 1px rgba(255, 239, 206, 0.04);
  }

  .auth-mark svg {
    width: 40px;
    height: 40px;
    fill: none;
    stroke: #d7b77a;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
    filter: drop-shadow(0 0 8px rgba(201, 168, 106, 0.22));
  }

  .auth-title-wrap {
    display: grid;
    gap: 8px;
    text-align: center;
  }

  .auth-kicker,
  .section-label {
    font-family: 'Cinzel', serif;
    font-size: 0.68rem;
    letter-spacing: 0.24em;
    text-transform: uppercase;
    color: rgba(201, 168, 106, 0.82);
  }

  h1,
  h2 {
    margin: 0;
    font-family: 'Cinzel', serif;
    font-weight: 700;
    text-transform: uppercase;
    color: #efe1bd;
    text-wrap: balance;
  }

  h1 {
    font-size: clamp(2.5rem, 9vw, 3.4rem);
    line-height: 0.95;
    letter-spacing: 0.12em;
    text-shadow: 0 10px 28px rgba(0, 0, 0, 0.36);
  }

  h2 {
    font-size: 1.36rem;
    letter-spacing: 0.08em;
  }

  .auth-subtitle {
    margin: 0;
    color: rgba(223, 214, 196, 0.7);
    font-size: 0.9rem;
    line-height: 1.55;
  }

  .auth-panel {
    width: 100%;
    position: relative;
    display: grid;
    gap: 18px;
    padding: 24px 22px 22px;
    clip-path: polygon(18px 0, calc(100% - 18px) 0, 100% 18px, 100% calc(100% - 18px), calc(100% - 18px) 100%, 18px 100%, 0 calc(100% - 18px), 0 18px);
    border: 1px solid rgba(201, 168, 106, 0.38);
    background:
      radial-gradient(circle at top, rgba(201, 168, 106, 0.08), transparent 34%),
      linear-gradient(180deg, rgba(14, 16, 18, 0.97), rgba(7, 9, 10, 0.98));
    box-shadow:
      0 28px 52px rgba(0, 0, 0, 0.34),
      inset 0 0 0 1px rgba(255, 239, 206, 0.04),
      inset 0 12px 24px rgba(255, 227, 176, 0.02);
    max-width: 100%;
    box-sizing: border-box;
  }

  .auth-panel::before {
    content: '';
    position: absolute;
    inset: 8px;
    clip-path: inherit;
    border: 1px solid rgba(201, 168, 106, 0.12);
    pointer-events: none;
  }

  .auth-panel-compact {
    width: min(400px, calc(100vw - 24px));
  }

  .auth-panel-wide {
    width: min(460px, calc(100vw - 24px));
  }

  .mode-switch {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }

  .mode-switch button,
  .primary-button,
  .secondary-button,
  .ghost-button {
    min-height: 46px;
    border: 1px solid rgba(201, 168, 106, 0.3);
    background: linear-gradient(180deg, rgba(33, 27, 21, 0.96), rgba(14, 12, 9, 0.98));
    color: #e9d6a9;
    clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px);
    font-family: 'Cinzel', serif;
    font-size: 0.82rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    transition: transform 140ms ease, box-shadow 160ms ease, filter 160ms ease, border-color 160ms ease;
  }

  .mode-switch button:hover,
  .primary-button:hover,
  .secondary-button:hover,
  .ghost-button:hover {
    transform: translateY(-1px) scale(1.015);
    border-color: rgba(223, 189, 120, 0.48);
    box-shadow: 0 0 0 1px rgba(201, 168, 106, 0.14), 0 0 18px rgba(201, 168, 106, 0.18);
    filter: brightness(1.04);
  }

  .mode-switch button.active,
  .primary-button {
    background:
      linear-gradient(180deg, rgba(84, 63, 31, 0.98), rgba(40, 28, 13, 0.98));
    color: #f4e4be;
  }

  .secondary-button {
    background: linear-gradient(180deg, rgba(49, 37, 20, 0.96), rgba(20, 14, 9, 0.98));
  }

  .ghost-button {
    background: rgba(12, 12, 12, 0.7);
    color: rgba(222, 206, 171, 0.82);
  }

  .primary-button:disabled {
    opacity: 0.42;
    transform: none;
    box-shadow: none;
    cursor: not-allowed;
  }

  .field-stack,
  .action-stack,
  .character-stack {
    display: grid;
    gap: 10px;
    max-height: min(52vh, 420px);
    overflow-y: auto;
    padding-right: 4px;
  }

  .character-stack::-webkit-scrollbar {
    width: 8px;
  }

  .character-stack::-webkit-scrollbar-thumb {
    background: rgba(201, 168, 106, 0.34);
    border-radius: 999px;
  }

  .field-stack label {
    font-family: 'Cinzel', serif;
    font-size: 0.72rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: rgba(206, 182, 130, 0.86);
  }

  .field-stack input,
  .field-stack select {
    min-height: 48px;
    width: 100%;
    border: 1px solid rgba(201, 168, 106, 0.28);
    background:
      linear-gradient(180deg, rgba(7, 9, 10, 0.96), rgba(4, 6, 7, 0.98));
    color: #f0e4c8;
    padding: 0 14px;
    clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px);
    box-shadow: inset 0 0 0 1px rgba(255, 238, 205, 0.02);
  }

  .field-stack input::placeholder {
    color: rgba(192, 180, 157, 0.38);
  }

  .field-stack input:focus,
  .field-stack select:focus {
    outline: none;
    border-color: rgba(219, 184, 117, 0.52);
    box-shadow:
      0 0 0 1px rgba(201, 168, 106, 0.16),
      0 0 20px rgba(201, 168, 106, 0.14);
  }

  .section-head {
    display: grid;
    gap: 4px;
    text-align: center;
  }

  .auth-status {
    width: 100%;
    min-height: 40px;
    display: grid;
    place-items: center;
    padding: 10px 14px;
    border: 1px solid rgba(201, 168, 106, 0.18);
    background: rgba(10, 10, 10, 0.5);
    clip-path: polygon(12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px), 0 12px);
    color: rgba(221, 200, 151, 0.78);
    font-size: 0.78rem;
    text-align: center;
    box-sizing: border-box;
  }

  @media (max-width: 520px) {
    .auth-column {
      gap: 14px;
    }

    .auth-mark {
      width: 84px;
      height: 84px;
    }

    .auth-panel {
      padding: 20px 18px 18px;
    }
  }

  @media (max-height: 860px) {
    .auth-shell {
      overflow-y: auto;
      place-items: start center;
      padding-block: 16px;
    }

    .auth-column {
      gap: 14px;
    }

    .auth-mark {
      width: 78px;
      height: 78px;
    }

    h1 {
      font-size: clamp(2.2rem, 8vw, 3rem);
    }

    .auth-subtitle {
      font-size: 0.82rem;
      line-height: 1.45;
    }

    .auth-panel {
      gap: 14px;
      padding: 18px 18px 16px;
    }

    .character-stack {
      max-height: min(46vh, 320px);
    }
  }

  @media (max-height: 700px) {
    .auth-column {
      width: min(400px, calc(100vw - 18px));
      gap: 10px;
    }

    .auth-mark {
      width: 66px;
      height: 66px;
    }

    .auth-kicker,
    .section-label {
      font-size: 0.6rem;
    }

    h1 {
      font-size: clamp(1.9rem, 7vw, 2.5rem);
    }

    h2 {
      font-size: 1.08rem;
    }

    .auth-subtitle {
      display: none;
    }

    .mode-switch button,
    .primary-button,
    .secondary-button,
    .ghost-button,
    .field-stack input,
    .field-stack select {
      min-height: 42px;
    }

    .field-stack,
    .action-stack,
    .character-stack {
      gap: 8px;
    }

    .character-stack {
      max-height: min(42vh, 260px);
    }

    .auth-status {
      min-height: 34px;
      padding: 8px 10px;
      font-size: 0.72rem;
    }
  }
</style>
