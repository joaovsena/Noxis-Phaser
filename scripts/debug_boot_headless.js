const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const WebSocket = require('ws');

const DEFAULT_URL = process.env.NOXIS_URL || 'http://127.0.0.1:3000';
const DEFAULT_CHROME_PATH = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = Number(process.env.CHROME_DEBUG_PORT || 9222);
const DEBUG_TIMEOUT_MS = Number(process.env.NOXIS_DEBUG_TIMEOUT_MS || 30000);
const CDP_COMMAND_TIMEOUT_MS = Number(process.env.CDP_COMMAND_TIMEOUT_MS || 8000);
const REPORT_DIR = path.join(process.cwd(), 'runtime-logs');

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(fn, timeoutMs, label) {
  const startedAt = Date.now();
  let lastError = null;
  while ((Date.now() - startedAt) < timeoutMs) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(200);
  }
  const suffix = lastError ? ` | ultimo erro: ${String(lastError)}` : '';
  throw new Error(`Timeout aguardando ${label}${suffix}`);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ao buscar ${url}`);
  }
  return response.json();
}

function createCdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 0;
  const pending = new Map();
  const events = [];

  ws.on('message', (raw) => {
    const message = JSON.parse(String(raw));
    if (typeof message.id === 'number') {
      const task = pending.get(message.id);
      if (!task) return;
      pending.delete(message.id);
      clearTimeout(task.timer);
      if (message.error) task.reject(new Error(JSON.stringify(message.error)));
      else task.resolve(message.result);
      return;
    }
    events.push(message);
    if (message.method === 'Runtime.consoleAPICalled') {
      const text = (message.params?.args || []).map((arg) => {
        if (typeof arg?.value !== 'undefined') return String(arg.value);
        return arg?.description || arg?.type || '';
      }).join(' | ');
      console.log(`[console:${message.params?.type || 'log'}] ${text}`);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      const details = message.params?.exceptionDetails;
      const text = details?.exception?.description || details?.text || 'Runtime.exceptionThrown';
      console.log(`[page:error] ${text}`);
    }
    if (message.method === 'Log.entryAdded') {
      const entry = message.params?.entry;
      console.log(`[log:${entry?.level || 'info'}] ${entry?.text || ''}`);
    }
  });

  function send(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`CDP timeout em ${method}`));
      }, CDP_COMMAND_TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async function evaluate(expression) {
    const result = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (result?.exceptionDetails) {
      throw new Error(result.exceptionDetails.text || 'Runtime.evaluate exception');
    }
    return result?.result?.value;
  }

  return {
    ws,
    events,
    send,
    evaluate,
    close() {
      for (const [id, task] of pending.entries()) {
        pending.delete(id);
        clearTimeout(task.timer);
        task.reject(new Error(`CDP encerrado antes da resposta ${id}`));
      }
      ws.close();
    }
  };
}

async function main() {
  if (!fs.existsSync(DEFAULT_CHROME_PATH)) {
    throw new Error(`Chrome nao encontrado em ${DEFAULT_CHROME_PATH}`);
  }

  fs.mkdirSync(REPORT_DIR, { recursive: true });

  const username = `diag${Date.now().toString(36).slice(-8)}`;
  const password = 'diag123';
  const characterName = `Diag${Date.now().toString(36).slice(-6)}`.slice(0, 12);
  const chromeProfileDir = path.join(os.tmpdir(), `noxis-headless-${Date.now()}`);

  const chrome = spawn(DEFAULT_CHROME_PATH, [
    '--headless=new',
    '--disable-gpu',
    '--disable-background-networking',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${chromeProfileDir}`,
    DEFAULT_URL
  ], {
    stdio: ['ignore', 'ignore', 'pipe']
  });

  chrome.stderr.on('data', (chunk) => {
    const text = String(chunk || '').trim();
    if (text) console.log(`[chrome] ${text}`);
  });

  let cdp = null;
  const report = {
    url: DEFAULT_URL,
    username,
    password,
    characterName,
    startedAt: new Date().toISOString(),
    states: [],
    finalState: null,
    bootDiagnostics: null,
    loadingDiagnostics: null,
    logs: []
  };

  try {
    await waitFor(async () => {
      try {
        return await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
      } catch {
        return null;
      }
    }, 15000, 'Chrome DevTools');

    const targets = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json/list`);
    const pageTarget = targets.find((entry) => entry.type === 'page' && String(entry.url || '').startsWith(DEFAULT_URL))
      || targets.find((entry) => entry.type === 'page');
    if (!pageTarget?.webSocketDebuggerUrl) {
      throw new Error('Nao encontrei target de pagina no Chrome.');
    }

    cdp = createCdpClient(pageTarget.webSocketDebuggerUrl);
    await waitFor(() => new Promise((resolve) => {
      if (cdp.ws.readyState === WebSocket.OPEN) {
        resolve(true);
        return;
      }
      cdp.ws.once('open', () => resolve(true));
    }), 10000, 'socket CDP abrir');

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Log.enable');
    await cdp.send('Network.enable');

    await waitFor(
      () => cdp.evaluate('Boolean(window.__NOXIS_DEBUG__ && window.__NOXIS_DEBUG__.socket && window.__NOXIS_DEBUG__.getState)'),
      15000,
      'bootstrap do cliente'
    );

    await waitFor(
      () => cdp.evaluate('Boolean(window.__NOXIS_DEBUG__.getState().socketConnected)'),
      15000,
      'websocket conectado'
    );

    await cdp.evaluate(`
      window.__NOXIS_DEBUG__.socket.send({
        type: 'auth_register',
        username: '${username}',
        password: '${password}'
      });
      true;
    `);

    await sleep(700);

    await cdp.evaluate(`
      window.__NOXIS_DEBUG__.socket.send({
        type: 'auth_login',
        username: '${username}',
        password: '${password}'
      });
      true;
    `);

    await waitFor(
      async () => {
        const state = await cdp.evaluate('window.__NOXIS_DEBUG__.getState()');
        return state?.connectionPhase === 'character_create' || state?.connectionPhase === 'character_select' ? state : null;
      },
      10000,
      'fase de personagem'
    );

    const currentState = await cdp.evaluate('window.__NOXIS_DEBUG__.getState()');
    if (currentState?.connectionPhase === 'character_create') {
      await cdp.evaluate(`
        window.__NOXIS_DEBUG__.socket.send({
          type: 'character_create',
          name: '${characterName}',
          class: 'archer',
          gender: 'female'
        });
        true;
      `);
    }

    await waitFor(
      async () => {
        const state = await cdp.evaluate('window.__NOXIS_DEBUG__.getState()');
        const slots = Array.isArray(state?.characterSlots) ? state.characterSlots : [];
        return state?.connectionPhase === 'character_select' && slots.some(Boolean) ? state : null;
      },
      15000,
      'character_select com slot'
    );

    const slotState = await cdp.evaluate('window.__NOXIS_DEBUG__.getState()');
    const selectedSlot = Array.isArray(slotState?.characterSlots)
      ? slotState.characterSlots.findIndex(Boolean)
      : 0;

    await cdp.evaluate(`
      window.__NOXIS_DEBUG__.socket.send({
        type: 'character_enter',
        slot: ${Math.max(0, selectedSlot)}
      });
      true;
    `);

    const observedStartedAt = Date.now();
    while ((Date.now() - observedStartedAt) < DEBUG_TIMEOUT_MS) {
      const state = await cdp.evaluate('window.__NOXIS_DEBUG__.getState()');
      const boot = await cdp.evaluate('window.__NOXIS_DEBUG__.getBootDiagnostics()');
      report.states.push({
        atMs: Date.now() - observedStartedAt,
        phase: state?.connectionPhase || '-',
        playerId: state?.playerId || null,
        worldStatic: Boolean(state?.worldStatic),
        worldState: Boolean(state?.worldState),
        inventoryState: Boolean(state?.inventoryState),
        resolvedWorld: Boolean(state?.resolvedWorld),
        bootStage: boot?.summary?.stage || '-',
        lastPacket: boot?.summary?.lastPacket || '-',
        lastError: boot?.summary?.lastError || '',
        wsMessages: boot?.counters?.wsMessages || 0
      });
      console.log(`[state] phase=${state?.connectionPhase} player=${state?.playerId || '-'} static=${state?.worldStatic ? '1' : '0'} state=${state?.worldState ? '1' : '0'} inv=${state?.inventoryState ? '1' : '0'} resolved=${state?.resolvedWorld ? '1' : '0'} stage=${boot?.summary?.stage || '-'} packet=${boot?.summary?.lastPacket || '-'}`);
      if (
        state?.connectionPhase === 'in_game'
        && state?.playerId
        && state?.worldState
        && state?.inventoryState
        && state?.resolvedWorld
      ) {
        break;
      }
      await sleep(1000);
    }

    report.finalState = await cdp.evaluate('window.__NOXIS_DEBUG__.getState()');
    report.bootDiagnostics = await cdp.evaluate('window.__NOXIS_DEBUG__.getBootDiagnostics()');
    report.loadingDiagnostics = await cdp.evaluate('window.__NOXIS_DEBUG__.getLoadingDebug()');

    const reportPath = path.join(REPORT_DIR, `headless-boot-report-${Date.now()}.json`);
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');
    console.log(`Relatorio salvo em ${reportPath}`);
    console.log(JSON.stringify({
      finalPhase: report.finalState?.connectionPhase || '-',
      playerId: report.finalState?.playerId || null,
      worldStatic: Boolean(report.finalState?.worldStatic),
      worldState: Boolean(report.finalState?.worldState),
      inventoryState: Boolean(report.finalState?.inventoryState),
      resolvedWorld: Boolean(report.finalState?.resolvedWorld),
      bootStage: report.bootDiagnostics?.summary?.stage || '-',
      lastPacket: report.bootDiagnostics?.summary?.lastPacket || '-',
      lastError: report.bootDiagnostics?.summary?.lastError || ''
    }, null, 2));
  } finally {
    if (cdp) cdp.close();
    if (chrome && !chrome.killed) {
      chrome.kill('SIGTERM');
    }
  }
}

main().catch((error) => {
  console.error(String(error?.stack || error));
  process.exitCode = 1;
});
