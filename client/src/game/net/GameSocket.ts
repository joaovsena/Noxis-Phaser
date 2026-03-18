import type { GameStore } from '../state/GameStore';
import { markLoadingPacket, traceLoadingStep } from '../../svelte-hud/stores/gameUi';

const RECONNECT_MS = 2500;
const PING_INTERVAL_MS = 5000;

export class GameSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private pingTimer: number | null = null;
  private pendingPings = new Map<number, number>();
  private inboundMessageSeq = 0;

  constructor(private readonly store: GameStore) {}

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${protocol}//${window.location.host}`;
    this.store.update({
      socketConnected: false,
      connectionPhase: 'connecting',
      authMessage: 'Conectando ao servidor...'
    });
    this.ws = new WebSocket(url);

    this.ws.addEventListener('open', () => {
      const readyState = this.ws ? this.ws.readyState : -1;
      traceLoadingStep(`WS conectado. readyState=${readyState}.`);
      markLoadingPacket('wsOpen', `ws_open | readyState ${readyState}`);
      this.store.update({
        socketConnected: true,
        connectionPhase: 'auth',
        authMessage: 'Conexao estabelecida.'
      });
      this.startPingLoop();
    });

    this.ws.addEventListener('close', (event) => {
      const code = Number(event?.code || 0);
      const reason = String(event?.reason || '').trim();
      const wasClean = Boolean(event?.wasClean);
      traceLoadingStep(`WS fechado. code=${code} clean=${wasClean ? 'yes' : 'no'} reason=${reason || '-'}. Reconexao agendada.`);
      markLoadingPacket('wsClose', `ws_close | code ${code} | clean ${wasClean ? 'yes' : 'no'} | reason ${reason || '-'}`);
      this.stopPingLoop();
      this.pendingPings.clear();
      this.store.resetForDisconnect('Conexao perdida. Tentando reconectar...');
      this.scheduleReconnect();
    });

    this.ws.addEventListener('error', () => {
      const readyState = this.ws ? this.ws.readyState : -1;
      const bufferedAmount = this.ws ? this.ws.bufferedAmount : -1;
      traceLoadingStep(`Erro no websocket. readyState=${readyState} buffered=${bufferedAmount}.`);
      markLoadingPacket('wsError', `ws_error | readyState ${readyState} | buffered ${bufferedAmount}`);
      this.store.update({ authMessage: 'Falha ao conectar no websocket.' });
    });

    this.ws.addEventListener('message', (event) => {
      const seq = ++this.inboundMessageSeq;
      let payload: any;
      const raw = String(event.data);
      const rawTypeMatch = /"type"\s*:\s*"([^"]+)"/.exec(raw);
      const rawType = rawTypeMatch?.[1] || 'unknown';
      traceLoadingStep(`WS message#${seq} start (${rawType}) | ${raw.length} chars.`);
      if (rawType === 'world_state') {
        traceLoadingStep(`WS message#${seq} raw world_state (${raw.length} chars) recebido; iniciando parse.`);
      }
      const parseStartedAt = performance.now();
      try {
        payload = JSON.parse(raw);
      } catch {
        traceLoadingStep(`WS message#${seq} falha ao parsear (${rawType}).`);
        return;
      }
      const parseMs = Math.max(0, Math.round((performance.now() - parseStartedAt) * 100) / 100);
      if (rawType === 'world_state') {
        traceLoadingStep(`WS message#${seq} parsed world_state em ${parseMs}ms.`);
      }
      traceLoadingStep(`WS message#${seq} parsed (${rawType}) em ${parseMs}ms; entrando no handler.`);
      this.handleMessage(payload);
      traceLoadingStep(`WS message#${seq} handler concluido (${rawType}).`);
    });
  }

  send(payload: Record<string, unknown>) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(payload));
  }

  private scheduleReconnect() {
    if (this.reconnectTimer !== null) return;
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, RECONNECT_MS);
  }

  private startPingLoop() {
    this.stopPingLoop();
    this.sendPing();
    this.pingTimer = window.setInterval(() => this.sendPing(), PING_INTERVAL_MS);
  }

  private stopPingLoop() {
    if (this.pingTimer !== null) {
      window.clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private sendPing() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    const nonce = Date.now() + Math.floor(Math.random() * 1000);
    this.pendingPings.set(nonce, performance.now());
    this.send({ type: 'ping', nonce });
  }

  private handleMessage(payload: any) {
    if (!payload || typeof payload !== 'object') return;
    switch (payload.type) {
      case 'pong': {
        const nonce = Number(payload.nonce);
        const sentAt = this.pendingPings.get(nonce);
        if (Number.isFinite(sentAt)) {
          this.pendingPings.delete(nonce);
          this.store.update({ networkPingMs: Math.max(0, Math.round(performance.now() - sentAt)) });
        }
        return;
      }
      case 'auth_ok':
        this.store.update({ authMessage: String(payload.message || 'Conta criada.') });
        return;
      case 'auth_error':
        this.store.update({ authMessage: String(payload.message || 'Erro de autenticacao.') });
        return;
      case 'auth_character_required':
        this.store.update({
          connectionPhase: 'character_create',
          authMessage: String(payload.message || 'Crie um personagem para continuar.')
        });
        return;
      case 'auth_character_select':
        traceLoadingStep(`WS <= auth_character_select (${Array.isArray(payload.slots) ? payload.slots.length : 0} slots).`);
        this.store.update({
          characterSlots: Array.isArray(payload.slots) ? payload.slots : [],
          selectedCharacterSlot: null,
          connectionPhase: 'character_select',
          authMessage: 'Selecione um personagem.'
        });
        return;
      case 'debug.step':
        traceLoadingStep(`WS <= debug.step (${String(payload.step || '-')}).`);
        return;
      case 'debug.packet': {
        const order = Number(payload.order || 0) || 0;
        const packetType = String(payload.packetType || '-');
        traceLoadingStep(`WS <= debug.packet (#${order} -> ${packetType}).`);
        markLoadingPacket('announcedPacket', `debug.packet | #${order} -> ${packetType}`);
        return;
      }
      case 'bootstrap.auth': {
        const authPayload = payload?.authSuccess && typeof payload.authSuccess === 'object' ? payload.authSuccess : null;
        const hotbarState = payload?.hotbarState && typeof payload.hotbarState === 'object' ? payload.hotbarState : null;
        traceLoadingStep(
          `WS <= bootstrap.auth (playerId ${Number(authPayload?.playerId || 0) || '-'} | hotbar ${hotbarState ? 'yes' : 'no'}).`
        );
        if (authPayload) {
          markLoadingPacket('authSuccess', `auth_success | playerId ${Number(authPayload.playerId || 0) || '-'} | mapa ${String(authPayload.mapKey || '-')}/${String(authPayload.mapId || '-')}`);
        }
        this.store.update({
          playerId: Number(authPayload?.playerId || 0) || this.store.getState().playerId,
          authPayload: authPayload || this.store.getState().authPayload,
          hotbarBindings: hotbarState?.bindings && typeof hotbarState.bindings === 'object'
            ? hotbarState.bindings
            : authPayload?.hotbarBindings && typeof authPayload.hotbarBindings === 'object'
              ? authPayload.hotbarBindings
              : this.store.getState().hotbarBindings,
          connectionPhase: authPayload?.playerId ? 'in_game' : this.store.getState().connectionPhase,
          authMessage: authPayload?.playerId ? 'Personagem carregado.' : this.store.getState().authMessage
        });
        return;
      }
      case 'bootstrap.world':
      case 'bootstrap.initial': {
        const worldStatic = payload?.worldStatic && typeof payload.worldStatic === 'object' ? payload.worldStatic : null;
        const worldState = payload?.worldState && typeof payload.worldState === 'object' ? payload.worldState : null;
        const inventoryState = payload?.inventoryState && typeof payload.inventoryState === 'object' ? payload.inventoryState : null;
        traceLoadingStep(
          `WS <= ${payload.type} (worldStatic ${worldStatic ? 'yes' : 'no'} | worldState ${worldState ? 'yes' : 'no'} | inventory ${inventoryState ? 'yes' : 'no'}).`
        );
        if (worldStatic) {
          markLoadingPacket('worldStatic', `world_static | mapa ${String(worldStatic.mapKey || '-')}/${String(worldStatic.mapId || '-')}`);
        }
        if (worldState) {
          markLoadingPacket('worldState', `world_state | players ${Object.keys(worldState?.players || {}).length} | mobs ${Array.isArray(worldState?.mobs) ? worldState.mobs.length : 0}`);
        }
        if (inventoryState) {
          markLoadingPacket('inventoryState', `inventory_state | itens ${Array.isArray(inventoryState?.inventory) ? inventoryState.inventory.length : 0}`);
        }
        this.store.update({
          worldStatic: worldStatic || this.store.getState().worldStatic,
          worldState: worldState || this.store.getState().worldState,
          inventoryState: inventoryState || this.store.getState().inventoryState,
          connectionPhase: this.store.getState().playerId ? 'in_game' : this.store.getState().connectionPhase
        });
        this.send({ type: 'bootstrap.ready' });
        traceLoadingStep('WS => bootstrap.ready enviado.');
        return;
      }
      case 'auth_success':
        traceLoadingStep(`WS <= auth_success (playerId ${Number(payload.playerId || 0) || '-'} | mapa ${String(payload.mapKey || '-')}/${String(payload.mapId || '-')}).`);
        markLoadingPacket('authSuccess', `auth_success | playerId ${Number(payload.playerId || 0) || '-'} | mapa ${String(payload.mapKey || '-')}/${String(payload.mapId || '-')}`);
        this.store.update({
          playerId: Number(payload.playerId || 0) || null,
          authPayload: payload,
          worldStatic: payload.mapTiled || payload.world
            ? {
                type: 'world_static',
                mapCode: payload.mapCode || payload.mapTiled?.mapCode || null,
                mapKey: payload.mapKey || null,
                mapId: payload.mapId || null,
                mapTheme: payload.mapTheme || null,
                mapTiled: payload.mapTiled || null,
                world: payload.world || null
              }
            : this.store.getState().worldStatic,
          hotbarBindings: payload.hotbarBindings && typeof payload.hotbarBindings === 'object'
            ? payload.hotbarBindings
            : this.store.getState().hotbarBindings,
          connectionPhase: 'in_game',
          authMessage: 'Personagem carregado.'
        });
        return;
      case 'world_static':
        traceLoadingStep(`WS <= world_static (${String(payload.mapKey || '-')}/${String(payload.mapId || '-')}).`);
        markLoadingPacket('worldStatic', `world_static | mapa ${String(payload.mapKey || '-')}/${String(payload.mapId || '-')}`);
        this.store.update({
          worldStatic: payload,
          connectionPhase: this.store.getState().playerId ? 'in_game' : this.store.getState().connectionPhase
        });
        return;
      case 'world_state':
        traceLoadingStep(`WS <= world_state (players ${Object.keys(payload?.players || {}).length} | mobs ${Array.isArray(payload?.mobs) ? payload.mobs.length : 0}).`);
        markLoadingPacket('worldState', `world_state | players ${Object.keys(payload?.players || {}).length} | mobs ${Array.isArray(payload?.mobs) ? payload.mobs.length : 0}`);
        this.store.update({
          worldState: payload,
          connectionPhase: this.store.getState().playerId ? 'in_game' : this.store.getState().connectionPhase
        });
        return;
      case 'move_ack':
        this.store.update({ lastMoveAck: payload });
        return;
      case 'system_message':
        this.store.pushChatMessage({
          id: `${Date.now()}-${Math.random()}`,
          type: 'system',
          text: String(payload.text || ''),
          at: Date.now()
        });
        this.store.update({ authMessage: String(payload.text || this.store.getState().authMessage) });
        return;
      case 'chat_message':
        this.store.pushChatMessage(payload);
        return;
      case 'inventory_state':
        traceLoadingStep(`WS <= inventory_state (${Array.isArray(payload?.inventory) ? payload.inventory.length : 0} itens).`);
        markLoadingPacket('inventoryState', `inventory_state | itens ${Array.isArray(payload?.inventory) ? payload.inventory.length : 0}`);
        this.store.update({ inventoryState: payload });
        return;
      case 'hotbar.state':
        this.store.update({
          hotbarBindings: payload.bindings && typeof payload.bindings === 'object' ? payload.bindings : {}
        });
        return;
      case 'quest.state':
        traceLoadingStep(`WS <= quest.state (${Array.isArray(payload?.quests) ? payload.quests.length : 0} quests).`);
        this.store.update({ questState: Array.isArray(payload.quests) ? payload.quests : [] });
        return;
      case 'party.state':
        traceLoadingStep('WS <= party.state.');
        this.store.update({ partyState: payload.party || null });
        return;
      case 'party.areaList':
        this.store.update({ partyAreaList: Array.isArray(payload.parties) ? payload.parties : [] });
        return;
      case 'party.waypointPing': {
        const waypointId = String(payload.waypointId || '');
        if (!waypointId) return;
        const expiresIn = Math.max(1, Number(payload.expiresIn || 10000));
        this.store.upsertPartyWaypoint({
          ...payload,
          waypointId,
          expiresAt: Date.now() + expiresIn
        });
        return;
      }
      case 'party.inviteReceived':
        this.store.pushPartyInvite(payload);
        this.store.pushChatMessage({
          id: `${Date.now()}-${Math.random()}`,
          type: 'system',
          text: `Convite de grupo recebido de ${String(payload.fromName || payload.from || 'jogador')}.`,
          at: Date.now()
        });
        return;
      case 'party.joinRequestReceived':
        this.store.pushPartyJoinRequest(payload);
        this.store.pushChatMessage({
          id: `${Date.now()}-${Math.random()}`,
          type: 'system',
          text: `Solicitacao de entrada recebida de ${String(payload.fromName || payload.from || 'jogador')}.`,
          at: Date.now()
        });
        return;
      case 'friend.requestReceived':
        this.store.pushChatMessage({
          id: `${Date.now()}-${Math.random()}`,
          type: 'system',
          text: String(payload.message || payload.fromName || payload.from || 'Nova notificacao.'),
          at: Date.now()
        });
        return;
      case 'party.joinRequestResult':
      case 'party.error':
      case 'friend.error':
        this.store.pushChatMessage({
          id: `${Date.now()}-${Math.random()}`,
          type: 'system',
          text: String(payload.message || 'Operacao concluida.'),
          at: Date.now()
        });
        this.store.update({ authMessage: String(payload.message || this.store.getState().authMessage) });
        return;
      case 'friend.state':
        traceLoadingStep('WS <= friend.state.');
        this.store.update({ friendState: payload });
        return;
      case 'npc.dialog':
        traceLoadingStep(`WS <= npc.dialog (${String(payload?.npc?.id || '-')}).`);
        this.store.update({
          npcDialog: payload,
          npcShopOpen: Array.isArray(payload?.shopOffers) && payload.shopOffers.length > 0
        });
        return;
      case 'dungeon.readyCheck':
      case 'dungeon.readyUpdate':
      case 'dungeon.readyResolved':
        this.store.update({ dungeonReadyState: payload });
        return;
      case 'admin_result':
        this.store.update({ adminResult: payload, authMessage: String(payload.message || this.store.getState().authMessage) });
        return;
      case 'admin.mobPeacefulState':
        this.store.update({ adminMobPeacefulEnabled: Boolean(payload.enabled) });
        return;
      case 'player.dead':
        this.store.update({ dead: true });
        this.store.pushChatMessage({
          id: `${Date.now()}-${Math.random()}`,
          type: 'system',
          text: 'Voce morreu.',
          at: Date.now()
        });
        return;
      case 'combat.mobHitPlayer':
      case 'combat.playerHit':
      case 'combat_hit':
        this.store.pushCombatBurst(payload);
        return;
      case 'skill.effect':
        this.store.pushSkillEffect(payload);
        return;
      case 'player.statsUpdated': {
        traceLoadingStep('WS <= player.statsUpdated.');
        const state = this.store.getState();
        const playerId = state.playerId;
        const currentWorldState = state.worldState;
        const players = currentWorldState?.players ? { ...currentWorldState.players } : null;
        if (playerId && players?.[String(playerId)]) {
          players[String(playerId)] = {
            ...players[String(playerId)],
            stats: payload.stats || players[String(playerId)].stats,
            allocatedStats: payload.allocatedStats || players[String(playerId)].allocatedStats,
            skillLevels: payload.skillLevels || players[String(playerId)].skillLevels,
            skillPointsAvailable: payload.skillPointsAvailable ?? players[String(playerId)].skillPointsAvailable,
            unspentPoints: payload.unspentPoints ?? players[String(playerId)].unspentPoints,
            level: payload.level ?? players[String(playerId)].level,
            xp: payload.xp ?? players[String(playerId)].xp,
            xpToNext: payload.xpToNext ?? players[String(playerId)].xpToNext,
            hp: payload.hp ?? players[String(playerId)].hp,
            maxHp: payload.maxHp ?? players[String(playerId)].maxHp,
            wallet: payload.wallet || players[String(playerId)].wallet
          };
          this.store.update({
            worldState: {
              ...(currentWorldState || { type: 'world_state', players: {}, mobs: [] }),
              players
            },
            inventoryState: state.inventoryState
              ? {
                  ...state.inventoryState,
                  wallet: payload.wallet || state.inventoryState.wallet
                }
              : state.inventoryState
          });
          return;
        }
        return;
      }
      case 'player.pvpModeUpdated':
        return;
      default:
        return;
    }
  }
}

