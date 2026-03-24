import { bootDiagnostics } from '../debug/BootDiagnostics';
import { traceLoadingStep } from '../../svelte-hud/stores/gameUi';

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
export type MoveAckState = {
  reqId: number;
  targetX?: number;
  targetY?: number;
  projectedX?: number;
  projectedY?: number;
  pathNodes?: Array<{ x: number; y: number }>;
} | null;

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
  npcShopOpen: boolean;
  dungeonReadyState: any | null;
  selectedMobId: string | null;
  pendingDeleteItemId: string | null;
  partyInvites: any[];
  partyJoinRequests: any[];
  skillEffects: any[];
  combatBursts: any[];
  lastMoveAck: MoveAckState;
  adminResult: any | null;
  adminMobPeacefulEnabled: boolean;
  partyWaypoints: any[];
  networkPingMs: number | null;
  autoAttackEnabled: boolean;
  pathDebugEnabled: boolean;
  interactionDebugEnabled: boolean;
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
  npcShopOpen: false,
  dungeonReadyState: null,
  selectedMobId: null,
  pendingDeleteItemId: null,
  partyInvites: [],
  partyJoinRequests: [],
  skillEffects: [],
  combatBursts: [],
  lastMoveAck: null,
  adminResult: null,
  adminMobPeacefulEnabled: false,
  partyWaypoints: [],
  networkPingMs: null,
  autoAttackEnabled: true,
  pathDebugEnabled: false,
  interactionDebugEnabled: false
};

export class GameStore extends EventTarget {
  private state: GameState = INITIAL_STATE;

  getState(): GameState {
    return this.state;
  }

  update(patch: Partial<GameState>) {
    const startedAt = performance.now();
    const patchKeys = Object.keys(patch) as Array<keyof GameState>;
    const shouldTrace = patchKeys.some((key) =>
      key === 'worldStatic'
      || key === 'inventoryState'
      || key === 'connectionPhase'
      || key === 'playerId'
    );
    if (shouldTrace) {
      traceLoadingStep(`GameStore.update start [${patchKeys.join(', ')}].`);
    }
    const hasDirectChanges = patchKeys.some((key) => !Object.is(this.state[key], patch[key]));
    const hasExpiredWaypoints = (this.state.partyWaypoints || []).some((entry: any) => Number(entry?.expiresAt || 0) <= Date.now());
    if (!hasDirectChanges && !hasExpiredWaypoints) return;
    const nextState = {
      ...this.state,
      ...patch
    };
    const resolveStartedAt = performance.now();
    nextState.resolvedWorld = this.resolveWorld(nextState.worldStatic, nextState.worldState);
    const resolveMs = Math.max(0, Math.round((performance.now() - resolveStartedAt) * 100) / 100);
    nextState.partyWaypoints = (nextState.partyWaypoints || []).filter((entry: any) => Number(entry?.expiresAt || 0) > Date.now());
    this.state = nextState;
    if (shouldTrace) {
      traceLoadingStep(
        `GameStore.update dispatch [${patchKeys.join(', ')}] | resolveWorld ${resolveMs}ms | worldStatic ${nextState.worldStatic ? 'ok' : 'no'} | worldState ${nextState.worldState ? 'ok' : 'no'} | inventory ${nextState.inventoryState ? 'ok' : 'no'}.`
      );
    }
    const totalMs = Math.max(0, Math.round((performance.now() - startedAt) * 100) / 100);
    bootDiagnostics.recordStoreUpdate(patchKeys.map((key) => String(key)), totalMs, nextState);
    this.dispatchEvent(new CustomEvent<GameState>('change', { detail: this.state }));
    if (shouldTrace) {
      traceLoadingStep(`GameStore.update done [${patchKeys.join(', ')}] em ${totalMs}ms.`);
    }
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
    const staticMapKey = String(worldStatic?.mapKey || '');
    const staticMapId = String(worldStatic?.mapId || '');
    const stateMapKey = String(worldState?.mapKey || '');
    const stateMapId = String(worldState?.mapId || '');
    const hasMatchingStatic = Boolean(
      worldStatic
      && (
        !worldState
        || (
          (!staticMapKey || staticMapKey === stateMapKey)
          && (!staticMapId || staticMapId === stateMapId)
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

  upsertPartyWaypoint(waypoint: any, maxEntries = 10) {
    const next = [
      ...this.state.partyWaypoints.filter((entry: any) => String(entry?.waypointId || '') !== String(waypoint?.waypointId || '')),
      waypoint
    ]
      .filter((entry: any) => Number(entry?.expiresAt || 0) > Date.now())
      .slice(-maxEntries);
    this.update({ partyWaypoints: next });
  }
}

