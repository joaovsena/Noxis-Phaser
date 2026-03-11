import type { GameStore } from '../state/GameStore';

const RECONNECT_MS = 2500;

export class GameSocket {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;

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
      this.store.update({
        socketConnected: true,
        connectionPhase: 'auth',
        authMessage: 'Conexao estabelecida.'
      });
    });

    this.ws.addEventListener('close', () => {
      this.store.resetForDisconnect('Conexao perdida. Tentando reconectar...');
      this.scheduleReconnect();
    });

    this.ws.addEventListener('error', () => {
      this.store.update({ authMessage: 'Falha ao conectar no websocket.' });
    });

    this.ws.addEventListener('message', (event) => {
      let payload: any;
      try {
        payload = JSON.parse(String(event.data));
      } catch {
        return;
      }
      this.handleMessage(payload);
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

  private handleMessage(payload: any) {
    if (!payload || typeof payload !== 'object') return;
    switch (payload.type) {
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
        this.store.update({
          characterSlots: Array.isArray(payload.slots) ? payload.slots : [],
          selectedCharacterSlot: null,
          connectionPhase: 'character_select',
          authMessage: 'Selecione um personagem.'
        });
        return;
      case 'auth_success':
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
        this.store.update({
          worldStatic: payload,
          connectionPhase: this.store.getState().playerId ? 'in_game' : this.store.getState().connectionPhase
        });
        return;
      case 'world_state':
        this.store.update({
          worldState: payload,
          connectionPhase: this.store.getState().playerId ? 'in_game' : this.store.getState().connectionPhase
        });
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
        this.store.update({ inventoryState: payload });
        return;
      case 'hotbar.state':
        this.store.update({
          hotbarBindings: payload.bindings && typeof payload.bindings === 'object' ? payload.bindings : {}
        });
        return;
      case 'quest.state':
        this.store.update({ questState: Array.isArray(payload.quests) ? payload.quests : [] });
        return;
      case 'party.state':
        this.store.update({ partyState: payload.party || null });
        return;
      case 'party.areaList':
        this.store.update({ partyAreaList: Array.isArray(payload.parties) ? payload.parties : [] });
        return;
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
        this.store.update({ friendState: payload });
        return;
      case 'npc.dialog':
        this.store.update({ npcDialog: payload });
        return;
      case 'dungeon.readyCheck':
      case 'dungeon.readyUpdate':
      case 'dungeon.readyResolved':
        this.store.update({ dungeonReadyState: payload });
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
        this.store.pushCombatBurst(payload);
        return;
      case 'combat_hit':
        this.store.pushCombatBurst(payload);
        return;
      case 'skill.effect':
        this.store.pushSkillEffect(payload);
        return;
      case 'player.statsUpdated': {
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
