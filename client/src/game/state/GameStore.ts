export type CharacterSlot = {
  slot: number;
  id: number;
  name: string;
  class: string;
  gender: string;
  level: number;
} | null;

export type MapTiledState = {
  mapCode?: string;
  assetKey?: string;
  tmjUrl?: string;
  tilesBaseUrl?: string;
  orientation?: string;
  worldTileSize?: number;
  worldScale?: number;
} | null;

export type WorldState = {
  type: 'world_state';
  players: Record<string, any>;
  mobs: any[];
  mapKey?: string;
  mapId?: string;
  groundItems?: any[];
  activeEvents?: any[];
  npcs?: any[];
} | null;

export type WorldStaticState = {
  type: 'world_static';
  mapCode?: string;
  mapKey?: string;
  mapId?: string;
  mapTheme?: string;
  mapFeatures?: any[];
  portals?: any[];
  world?: { width: number; height: number };
  mapTiled?: MapTiledState;
} | null;

export type ResolvedWorldState = (NonNullable<WorldStaticState> & Partial<NonNullable<WorldState>>) | null;

export type ConnectionPhase =
  | 'connecting'
  | 'connected'
  | 'auth'
  | 'character_select'
  | 'character_create'
  | 'in_game'
  | 'disconnected';

export type GameState = {
  connectionPhase: ConnectionPhase;
  socketConnected: boolean;
  authMessage: string;
  selectedCharacterSlot: number | null;
  characterSlots: CharacterSlot[];
  playerId: number | null;
  worldStatic: WorldStaticState;
  worldState: WorldState;
  resolvedWorld: ResolvedWorldState;
  authPayload: any | null;
  chatMessages: any[];
  inventoryState: any | null;
  hotbarBindings: Record<string, any>;
  questState: any[];
  partyState: any | null;
  partyAreaList: any[];
  friendState: any | null;
  lastCombatEvent: any | null;
  dead: boolean;
  selectedPlayerId: number | null;
  npcDialog: any | null;
  dungeonReadyState: any | null;
  selectedMobId: string | null;
  pendingDeleteItemId: string | null;
  partyInvites: any[];
  partyJoinRequests: any[];
  skillEffects: any[];
  combatBursts: any[];
};

const INITIAL_STATE: GameState = {
  connectionPhase: 'connecting',
  socketConnected: false,
  authMessage: '',
  selectedCharacterSlot: null,
  characterSlots: [],
  playerId: null,
  worldStatic: null,
  worldState: null,
  resolvedWorld: null,
  authPayload: null,
  chatMessages: [],
  inventoryState: null,
  hotbarBindings: {},
  questState: [],
  partyState: null,
  partyAreaList: [],
  friendState: null,
  lastCombatEvent: null,
  dead: false,
  selectedPlayerId: null,
  npcDialog: null,
  dungeonReadyState: null,
  selectedMobId: null,
  pendingDeleteItemId: null,
  partyInvites: [],
  partyJoinRequests: [],
  skillEffects: [],
  combatBursts: []
};

export class GameStore extends EventTarget {
  private state: GameState = INITIAL_STATE;

  getState(): GameState {
    return this.state;
  }

  update(patch: Partial<GameState>) {
    const nextState = {
      ...this.state,
      ...patch
    };
    const worldStateMapKey = String(nextState.worldState?.mapKey || '');
    const worldStateMapId = String(nextState.worldState?.mapId || '');
    const worldStaticMapKey = String(nextState.worldStatic?.mapKey || '');
    const worldStaticMapId = String(nextState.worldStatic?.mapId || '');
    if (
      nextState.worldState
      && nextState.worldStatic
      && worldStateMapKey
      && worldStateMapId
      && (worldStateMapKey !== worldStaticMapKey || worldStateMapId !== worldStaticMapId)
    ) {
      nextState.worldStatic = null;
    }
    nextState.resolvedWorld = this.resolveWorld(nextState.worldStatic, nextState.worldState);
    this.state = nextState;
    this.dispatchEvent(new CustomEvent<GameState>('change', { detail: this.state }));
  }

  resetForDisconnect(message = 'Conexao encerrada.') {
    this.update({
      ...INITIAL_STATE,
      connectionPhase: 'disconnected',
      authMessage: message
    });
  }

  private resolveWorld(worldStatic: WorldStaticState, worldState: WorldState): ResolvedWorldState {
    if (!worldStatic && !worldState) return null;
    const hasMatchingStatic = Boolean(
      worldStatic
      && (
        !worldState
        || (
          String(worldStatic.mapKey || '') === String(worldState.mapKey || '')
          && String(worldStatic.mapId || '') === String(worldState.mapId || '')
        )
      )
    );
    return {
      ...((hasMatchingStatic ? worldStatic : null) || { type: 'world_static' as const }),
      ...(worldState || {})
    };
  }

  pushChatMessage(message: any, maxEntries = 120) {
    const next = [...this.state.chatMessages, message].slice(-maxEntries);
    this.update({ chatMessages: next });
  }

  pushPartyInvite(invite: any, maxEntries = 8) {
    const next = [...this.state.partyInvites.filter((entry) => String(entry?.inviteId || '') !== String(invite?.inviteId || '')), invite].slice(-maxEntries);
    this.update({ partyInvites: next });
  }

  removePartyInvite(inviteId: string) {
    this.update({
      partyInvites: this.state.partyInvites.filter((entry) => String(entry?.inviteId || '') !== String(inviteId || ''))
    });
  }

  pushPartyJoinRequest(request: any, maxEntries = 8) {
    const next = [...this.state.partyJoinRequests.filter((entry) => String(entry?.requestId || '') !== String(request?.requestId || '')), request].slice(-maxEntries);
    this.update({ partyJoinRequests: next });
  }

  removePartyJoinRequest(requestId: string) {
    this.update({
      partyJoinRequests: this.state.partyJoinRequests.filter((entry) => String(entry?.requestId || '') !== String(requestId || ''))
    });
  }

  pushSkillEffect(effect: any, maxEntries = 40) {
    const next = [...this.state.skillEffects, { ...effect, __clientId: `${Date.now()}-${Math.random()}` }].slice(-maxEntries);
    this.update({ skillEffects: next });
  }

  pushCombatBurst(event: any, maxEntries = 40) {
    const next = [...this.state.combatBursts, { ...event, __clientId: `${Date.now()}-${Math.random()}` }].slice(-maxEntries);
    this.update({ combatBursts: next, lastCombatEvent: event });
  }
}
