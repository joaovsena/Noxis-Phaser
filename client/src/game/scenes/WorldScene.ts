import Phaser from 'phaser';
import type { GameStore } from '../state/GameStore';
import type { GameSocket } from '../net/GameSocket';
import { loadMapDocument, type LoadedMapDocument } from '../maps/MapDocument';

type SceneServices = {
  store: GameStore;
  socket: GameSocket;
};

type FacingDirection = 's' | 'sw' | 'w' | 'nw' | 'n' | 'ne' | 'e' | 'se';
type PlayerAnimState = 'idle' | 'walk' | 'attack-unarmed' | 'attack-weapon' | 'dead';

type PlayerMarker = {
  body: Phaser.GameObjects.Container;
  badge: Phaser.GameObjects.Text;
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc;
  outline: Phaser.GameObjects.Shape;
  usingSpriteSheet: boolean;
  targetX: number;
  targetY: number;
  currentX: number;
  currentY: number;
  targetWorldX: number;
  targetWorldY: number;
  currentWorldX: number;
  currentWorldY: number;
  velocityWorldX: number;
  velocityWorldY: number;
  lastServerSyncAt: number;
  lastFacing: FacingDirection;
  lastLabel: string;
  lastDead: boolean;
  attackUntil: number;
  hasWeapon: boolean;
  pendingPath: Array<{ x: number; y: number }>;
  lastMoveAckReqId: number;
  lastFacingChangeAt: number;
  lastAnimKey: string;
};

type MobMarker = {
  body: Phaser.GameObjects.Container;
  hitArea: Phaser.GameObjects.Zone;
  badge: Phaser.GameObjects.Text;
  hpBar: Phaser.GameObjects.Rectangle;
  hpBg: Phaser.GameObjects.Rectangle;
};

type NpcMarker = {
  body: Phaser.GameObjects.Container;
  hitArea: Phaser.GameObjects.Zone;
  badge: Phaser.GameObjects.Text;
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
};

type GroundItemMarker = {
  body: Phaser.GameObjects.Container;
  hitArea: Phaser.GameObjects.Zone;
  badge: Phaser.GameObjects.Text;
  diamond: Phaser.GameObjects.Rectangle;
};

type PendingWorldAction = {
  kind: 'mob' | 'npc' | 'groundItem';
  id: string;
  range: number;
  lastIssuedAt: number;
  lastIssuedX: number;
  lastIssuedY: number;
};

type HoverInteraction = {
  kind: 'mob' | 'npc' | 'groundItem';
  id: string;
};

const PLAYER_SPRITE_KEYS = {
  archerFemale: 'player:archer:female'
} as const;

const PLAYER_FRAME_WIDTH = 128;
const PLAYER_FRAME_HEIGHT = 128;
const PLAYER_SMOOTHING = 24;
const PLAYER_ATTACK_MS = 420;
const DEPTH_SORT_INTERVAL_MS = 120;
const PLAYER_PREDICTION_MS = 80;
const LOCAL_SERVER_CORRECTION_THRESHOLD = 56;
const FACING_CHANGE_HYSTERESIS_MS = 130;
const FACING_MIN_VECTOR = 10;
const ISO_AXIAL_RATIO = 2;
const PLAYER_SPRITE_Y_OFFSET = 34;
const PLAYER_BADGE_Y = -94;
const PLAYER_SHEET_COLUMNS = 8;
const ITEM_PICKUP_RANGE = 110;
const NPC_INTERACT_RANGE = 170;
const MOB_INTERACTION_FALLBACK_RANGE = 64;
const ACTION_REISSUE_MS = 180;
const ACTION_REISSUE_DISTANCE = 18;
const HAND_CURSOR = 'pointer';
const SWORD_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'%3E%3Cg fill='none' stroke='%23f6d37a' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M14.5 3.5l6 6'/%3E%3Cpath d='M8 16l9.5-9.5 2 2L10 18'/%3E%3Cpath d='M7 17l-2.5 2.5'/%3E%3Cpath d='M5.5 15.5l3 3'/%3E%3C/g%3E%3C/svg%3E") 8 8, crosshair`;
const PLAYER_DIRECTIONS: FacingDirection[] = ['s', 'sw', 'w', 'nw', 'n', 'ne', 'e', 'se'];
const DIRECTION_COLUMN: Record<FacingDirection, number> = {
  s: 0,
  sw: 1,
  w: 2,
  nw: 3,
  n: 4,
  ne: 5,
  e: 6,
  se: 7
};

export class WorldScene extends Phaser.Scene {
  private readonly services: SceneServices;
  private mapDocument: LoadedMapDocument | null = null;
  private loadingMapUrl: string | null = null;
  private mapContainer!: Phaser.GameObjects.Container;
  private entityLayer!: Phaser.GameObjects.Container;
  private debugOverlay!: Phaser.GameObjects.Graphics;
  private interactionDebugOverlay!: Phaser.GameObjects.Graphics;
  private localPlayerAnchor!: Phaser.GameObjects.Arc;
  private playerMarkers = new Map<string, PlayerMarker>();
  private mobMarkers = new Map<string, MobMarker>();
  private npcMarkers = new Map<string, NpcMarker>();
  private groundItemMarkers = new Map<string, GroundItemMarker>();
  private pendingWorldAction: PendingWorldAction | null = null;
  private selectedMobId: string | null = null;
  private selectedGroundItemId: string | null = null;
  private hoveredInteraction: HoverInteraction | null = null;
  private lastCombatSignature: string | null = null;
  private processedCombatBursts = new Set<string>();
  private processedSkillEffects = new Set<string>();
  private changeHandler: EventListener | null = null;
  private projectedMapWidth = 0;
  private projectedMapHeight = 0;
  private baseCameraZoom = 0.9;
  private userZoomFactor = 1;
  private currentCameraZoom = 0.82;
  private loadedTileTextureKeys = new Set<string>();
  private mapRenderTextures: Phaser.GameObjects.RenderTexture[] = [];
  private playerAssetsReady = false;
  private entityDepthDirty = false;
  private lastDepthSortAt = 0;
  private renderTileSize = 100;
  private renderTileWidth = 48;
  private renderTileHeight = 24;
  private renderOriginX = 0;
  private renderOriginY = 0;
  private lastCursorKey: 'default' | 'hand' | 'sword' = 'default';

  constructor(services: SceneServices) {
    super('world');
    this.services = services;
  }

  async create() {
    this.cameras.main.setBackgroundColor('#08111b');
    this.mapContainer = this.add.container(0, 0);
    this.entityLayer = this.add.container(0, 0);
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer, currentlyOver: Phaser.GameObjects.GameObject[]) => {
      if (pointer.rightButtonDown()) return;
      if (this.handleWorldInteractionClick(pointer.worldX, pointer.worldY)) return;
      if (currentlyOver.length > 0) return;
      this.clearPendingSelection(true);
      this.queueMoveFromScreenPoint(pointer.worldX, pointer.worldY);
    });
    this.input.on('gameobjectdown', (pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      const kind = String(gameObject.getData('interactionKind') || '');
      const id = String(gameObject.getData('interactionId') || '');
      if (!kind || !id) return;
      pointer.event.stopPropagation();
      if (kind === 'mob') return void this.selectMob(id);
      if (kind === 'npc') return void this.interactNpc(id);
      if (kind === 'groundItem') return void this.pickupGroundItem(id);
      if (kind === 'player' && id !== String(this.services.store.getState().playerId)) {
        this.services.store.update({ selectedPlayerId: Number(id) || null, selectedMobId: null });
      }
    });
    this.debugOverlay = this.add.graphics();
    this.debugOverlay.setDepth(20000);
    this.interactionDebugOverlay = this.add.graphics();
    this.interactionDebugOverlay.setDepth(19990);
    this.localPlayerAnchor = this.add.circle(0, 0, 8, 0x000000, 0);
    this.localPlayerAnchor.setVisible(false);
    this.cameras.main.startFollow(this.localPlayerAnchor, true, 0.09, 0.09);
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _objects: Phaser.GameObjects.GameObject[], _deltaX: number, deltaY: number) => {
      const direction = deltaY > 0 ? -1 : 1;
      this.userZoomFactor = Phaser.Math.Clamp(this.userZoomFactor + direction * 0.05, 0.75, 1.25);
      this.applyCameraZoom();
    });
    this.drawEmergencyMapFallback();
    await this.ensurePlayerAssets();
    this.createPlayerAnimations();

    this.changeHandler = () => this.syncFromStore();
    this.services.store.addEventListener('change', this.changeHandler);
    this.syncFromStore();

    this.scale.on('resize', this.handleResize, this);
    this.handleResize(this.scale.gameSize);

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  update(time: number, delta: number) {
    const blend = 1 - Math.exp(-(Math.max(1, delta) / 1000) * PLAYER_SMOOTHING);
    let movedAny = false;
    const state = this.services.store.getState();
    const localPlayerId = String(state.playerId || '');

    this.playerMarkers.forEach((marker, id) => {
      const player = state.resolvedWorld?.players?.[id];
      const isLocal = id === localPlayerId;
      const prevWorldX = marker.currentWorldX;
      const prevWorldY = marker.currentWorldY;
      if (isLocal) {
        this.advanceLocalPlayerMarker(marker, player, delta, blend);
      } else {
        const predictionMs = Math.min(PLAYER_PREDICTION_MS, Math.max(0, time - marker.lastServerSyncAt));
        const predictedWorldX = marker.targetWorldX + marker.velocityWorldX * (predictionMs / 1000);
        const predictedWorldY = marker.targetWorldY + marker.velocityWorldY * (predictionMs / 1000);
        marker.currentWorldX = Phaser.Math.Linear(marker.currentWorldX, predictedWorldX, blend);
        marker.currentWorldY = Phaser.Math.Linear(marker.currentWorldY, predictedWorldY, blend);
      }

      const projected = this.worldToScreen(marker.currentWorldX, marker.currentWorldY);
      marker.currentX = Phaser.Math.Linear(marker.currentX, projected.x, Math.min(1, blend * 1.25));
      marker.currentY = Phaser.Math.Linear(marker.currentY, projected.y, Math.min(1, blend * 1.25));
      marker.body.setPosition(marker.currentX, marker.currentY);
      marker.body.setDepth(marker.currentY);
      movedAny = movedAny || Math.abs(marker.currentX - projected.x) > 0.2 || Math.abs(marker.currentY - projected.y) > 0.2;
      this.updatePlayerAnimation(marker, player, time, marker.currentWorldX - prevWorldX, marker.currentWorldY - prevWorldY);
    });

    const localMarker = localPlayerId ? this.playerMarkers.get(localPlayerId) : null;
    if (localMarker) {
      this.localPlayerAnchor.setPosition(localMarker.currentX, localMarker.currentY);
      this.localPlayerAnchor.setVisible(true);
      this.processPendingWorldAction(localMarker, state);
    }

    if (movedAny) this.entityDepthDirty = true;
    if (this.entityDepthDirty && time - this.lastDepthSortAt >= DEPTH_SORT_INTERVAL_MS) {
      this.entityLayer.list.sort((a, b) => Number((a as Phaser.GameObjects.Container).y || 0) - Number((b as Phaser.GameObjects.Container).y || 0));
      this.lastDepthSortAt = time;
      this.entityDepthDirty = false;
    }

    this.updateMarkerVisibility();
    this.updateHoverCursor();
    this.renderPathDebugOverlay();
    this.renderInteractionDebugOverlay();
  }

  private onShutdown() {
    if (this.changeHandler) {
      this.services.store.removeEventListener('change', this.changeHandler);
      this.changeHandler = null;
    }
    this.scale.off('resize', this.handleResize, this);
    this.mapRenderTextures.forEach((texture) => texture.destroy());
    this.mapRenderTextures = [];
  }

  private clientToWorldPoint(clientX: number, clientY: number, rect: DOMRect) {
    if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) return null;
    const camera = this.cameras.main;
    const canvasX = ((clientX - rect.left) / Math.max(1, rect.width)) * this.scale.width;
    const canvasY = ((clientY - rect.top) / Math.max(1, rect.height)) * this.scale.height;
    return camera.getWorldPoint(canvasX, canvasY);
  }

  public worldFromClientPoint(clientX: number, clientY: number) {
    const point = this.clientToWorldPoint(clientX, clientY, this.game.canvas.getBoundingClientRect());
    if (!point) return null;
    return this.screenToWorld(point.x, point.y);
  }

  public viewportPointFromWorld(worldX: number, worldY: number) {
    const projected = this.worldToScreen(worldX, worldY);
    const camera = this.cameras.main;
    return {
      x: (projected.x - camera.worldView.x) * camera.zoom,
      y: (projected.y - camera.worldView.y) * camera.zoom
    };
  }

  public queueMoveFromClientPoint(clientX: number, clientY: number) {
    const world = this.worldFromClientPoint(clientX, clientY);
    if (!world) return false;
    this.queueMoveToWorld(world.x, world.y);
    return true;
  }

  public queueMoveToWorld(worldX: number, worldY: number, preservePendingAction = false) {
    if (!preservePendingAction) this.pendingWorldAction = null;
    this.services.socket.send({
      type: 'move',
      reqId: Date.now(),
      x: worldX,
      y: worldY
    });
  }

  private queueMoveFromScreenPoint(screenX: number, screenY: number) {
    const world = this.screenToWorld(screenX, screenY);
    if (!world) return false;
    this.queueMoveToWorld(world.x, world.y);
    return true;
  }

    private async ensurePlayerAssets() {
    if (this.playerAssetsReady) return;
    if (!this.textures.exists(PLAYER_SPRITE_KEYS.archerFemale)) {
      await new Promise<void>((resolve) => {
        this.load.spritesheet(PLAYER_SPRITE_KEYS.archerFemale, '/assets/sprites/archer/female/archer_f.png', {
          frameWidth: PLAYER_FRAME_WIDTH,
          frameHeight: PLAYER_FRAME_HEIGHT
        });
        this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
        this.load.start();
      });
    }
    this.playerAssetsReady = true;
  }

  private createPlayerAnimations() {
    if (!this.playerAssetsReady) return;
    for (const direction of PLAYER_DIRECTIONS) {
      const column = DIRECTION_COLUMN[direction];
      this.createColumnAnimation(`archer-female:idle:${direction}`, [this.getFrameIndex(0, column)], 1);
      this.createColumnAnimation(`archer-female:walk:${direction}`, this.getColumnFrames(column, 1, 8), 10);
      this.createColumnAnimation(`archer-female:attack-unarmed:${direction}`, this.getColumnFrames(column, 10, 14), 12);
      this.createColumnAnimation(`archer-female:attack-weapon:${direction}`, this.getColumnFrames(column, 15, 23), 14);
      this.createColumnAnimation(`archer-female:dead:${direction}`, [this.getFrameIndex(24, column)], 1);
    }
  }

  private createColumnAnimation(key: string, frames: number[], frameRate: number) {
    if (this.anims.exists(key)) return;
    this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers(PLAYER_SPRITE_KEYS.archerFemale, { frames }),
      frameRate,
      repeat: frames.length > 1 && !key.includes(':dead:') ? -1 : 0
    });
  }

  private getColumnFrames(column: number, rowStart: number, rowEnd: number) {
    const frames: number[] = [];
    for (let row = rowStart; row <= rowEnd; row += 1) {
      frames.push(this.getFrameIndex(row, column));
    }
    return frames;
  }

  private getFrameIndex(row: number, column: number) {
    return row * PLAYER_SHEET_COLUMNS + column;
  }

  private async loadAndRenderMap(url: string) {
    this.loadingMapUrl = url;
    try {
      this.mapDocument = await loadMapDocument(url);
      this.renderLoadedMap();
      void this.ensureTileTextures(this.mapDocument).then(() => {
        if (this.mapDocument?.url !== url) return;
        this.renderLoadedMap();
      });
    } catch (error) {
      if (url !== DEFAULT_MAP_URL) {
        this.loadingMapUrl = null;
        await this.loadAndRenderMap(DEFAULT_MAP_URL);
        return;
      }
      throw error;
    } finally {
      this.loadingMapUrl = null;
    }
  }

  private renderLoadedMap() {
    if (!this.mapDocument) return;
    this.mapContainer.removeAll(true);
    this.mapRenderTextures.forEach((texture) => texture.destroy());
    this.mapRenderTextures = [];

    const map = this.mapDocument;
    const metrics = this.getRenderTileMetrics();
    const halfTileW = metrics.tileWidth / 2;
    const halfTileH = metrics.tileHeight / 2;
    this.projectedMapWidth = (map.width + map.height) * halfTileW;
    this.projectedMapHeight = (map.width + map.height) * halfTileH;
    this.renderTileWidth = metrics.tileWidth;
    this.renderTileHeight = metrics.tileHeight;
    this.renderTileSize = Math.max(1, Number(this.services.store.getState().resolvedWorld?.mapTiled?.worldTileSize || map.worldTileSize || map.tileWidth));
    this.renderOriginX = this.projectedMapWidth / 2;
    this.renderOriginY = metrics.tileHeight * 0.5;
    const originX = this.renderOriginX;
    const originY = this.renderOriginY;
    const layerWidth = Math.max(1, Math.ceil(this.projectedMapWidth));
    const layerHeight = Math.max(1, Math.ceil(this.projectedMapHeight + metrics.tileHeight));

    map.layers.filter((layer) => layer.visible).forEach((layer, layerIndex) => {
      const layerTexture = this.add.renderTexture(0, 0, layerWidth, layerHeight).setOrigin(0, 0);
      const graphics = this.make.graphics({ x: 0, y: 0, add: false });
      let usedGraphics = false;
      let usedTexture = false;
      for (let row = 0; row < map.height; row += 1) {
        for (let col = 0; col < map.width; col += 1) {
          const gid = Number(layer.data[row * map.width + col] || 0);
          if (!gid) continue;
          const screenX = (col - row) * halfTileW + originX;
          const screenY = (col + row) * halfTileH + originY;
          const imageMeta = map.tileImages[gid];
          const textureKey = imageMeta ? this.getTileTextureKey(imageMeta.source) : '';
          if (imageMeta && textureKey && this.textures.exists(textureKey)) {
            const scale = metrics.tileWidth / Math.max(1, Number(imageMeta.tileWidth || imageMeta.width || map.tileWidth));
            const image = this.make.image({
              x: screenX + Number(imageMeta.offsetX || 0) * scale,
              y: screenY + (Number(imageMeta.tileHeight || map.tileHeight) * scale) + Number(imageMeta.offsetY || 0) * scale,
              key: textureKey,
              add: false
            });
            image.setOrigin(0.5, 1);
            image.setScale(scale);
            layerTexture.draw(image);
            image.destroy();
            usedTexture = true;
            continue;
          }
          const color = this.getLayerColor(layer.name, gid, layerIndex);
          usedGraphics = true;
          graphics.fillStyle(color, 0.95);
          graphics.lineStyle(1, 0x0d1621, 0.35);
          graphics.beginPath();
          graphics.moveTo(screenX, screenY - halfTileH);
          graphics.lineTo(screenX + halfTileW, screenY);
          graphics.lineTo(screenX, screenY + halfTileH);
          graphics.lineTo(screenX - halfTileW, screenY);
          graphics.closePath();
          graphics.fillPath();
          graphics.strokePath();
          if (layer.name.toLowerCase().includes('pared') || layer.name.toLowerCase().includes('wall')) {
            graphics.fillStyle(0x10243a, 0.55);
            graphics.fillRect(screenX - halfTileW * 0.42, screenY - halfTileH * 1.5, halfTileW * 0.84, halfTileH * 1.3);
          }
        }
      }
      if (usedGraphics) {
        layerTexture.draw(graphics);
        usedTexture = true;
      }
      graphics.destroy();
      if (usedTexture) {
        layerTexture.setDepth(layerIndex);
        this.mapContainer.add(layerTexture);
        this.mapRenderTextures.push(layerTexture);
      } else {
        layerTexture.destroy();
      }
    });

    const frame = this.add.graphics();
    frame.lineStyle(3, 0x274159, 0.8);
    frame.strokeRect(0, 0, this.projectedMapWidth, this.projectedMapHeight + metrics.tileHeight);
    this.mapContainer.add(frame);
    this.handleResize(this.scale.gameSize);
  }
  private drawEmergencyMapFallback() {
    this.mapContainer.removeAll(true);
    const graphics = this.add.graphics();
    const width = Math.max(1200, this.scale.width * 2);
    const height = Math.max(900, this.scale.height * 2);
    graphics.fillStyle(0x10243a, 0.96);
    graphics.fillRect(0, 0, width, height);
    graphics.lineStyle(1, 0x274159, 0.45);
    for (let x = 0; x < width; x += 96) {
      graphics.beginPath();
      graphics.moveTo(x, 0);
      graphics.lineTo(x, height);
      graphics.strokePath();
    }
    for (let y = 0; y < height; y += 64) {
      graphics.beginPath();
      graphics.moveTo(0, y);
      graphics.lineTo(width, y);
      graphics.strokePath();
    }
    this.mapContainer.add(graphics);
    this.projectedMapWidth = width;
    this.projectedMapHeight = height;
    this.handleResize(this.scale.gameSize);
  }

  private async ensureTileTextures(map: LoadedMapDocument) {
    const requiredSources = Array.from(new Set(
      Object.values(map.tileImages || {}).map((entry) => String(entry?.source || '')).filter(Boolean)
    ));
    const pending = requiredSources.filter((source) => {
      const key = this.getTileTextureKey(source);
      return key && !this.textures.exists(key) && !this.loadedTileTextureKeys.has(key);
    });
    if (!pending.length) return;
    await new Promise<void>((resolve) => {
      pending.forEach((source) => {
        const key = this.getTileTextureKey(source);
        this.loadedTileTextureKeys.add(key);
        this.load.image(key, source);
      });
      this.load.once(Phaser.Loader.Events.COMPLETE, () => resolve());
      this.load.start();
    });
  }

  private getTileTextureKey(source: string) {
    return `tile:${String(source || '').replace(/[^a-zA-Z0-9:_/-]/g, '_')}`;
  }

  private renderPathDebugOverlay() {
    if (!this.debugOverlay) return;
    this.debugOverlay.clear();
    const state = this.services.store.getState();
    if (!state.pathDebugEnabled) return;
    const localMarker = state.playerId ? this.playerMarkers.get(String(state.playerId)) : null;
    if (!localMarker) return;
    const path = localMarker.pendingPath;
    if (!path.length) return;
    const start = this.worldToScreen(localMarker.currentWorldX, localMarker.currentWorldY);
    this.debugOverlay.lineStyle(3, 0xa855f7, 0.95);
    this.debugOverlay.beginPath();
    this.debugOverlay.moveTo(start.x, start.y - 6);
    path.forEach((node, index) => {
      const point = this.worldToScreen(Number(node.x || 0), Number(node.y || 0));
      this.debugOverlay.lineTo(point.x, point.y - 6);
      this.debugOverlay.fillStyle(index === path.length - 1 ? 0xf472b6 : 0xc084fc, 0.9);
      this.debugOverlay.fillCircle(point.x, point.y - 6, index === path.length - 1 ? 5 : 4);
    });
    this.debugOverlay.strokePath();
    this.debugOverlay.fillStyle(0xe9d5ff, 0.9);
    this.debugOverlay.fillCircle(start.x, start.y - 6, 4);
  }

  private renderInteractionDebugOverlay() {
    if (!this.interactionDebugOverlay) return;
    this.interactionDebugOverlay.clear();
    if (!this.services.store.getState().interactionDebugEnabled) return;

    this.mobMarkers.forEach((marker) => {
      this.interactionDebugOverlay.lineStyle(2, 0xff5b5b, 0.9);
      this.interactionDebugOverlay.strokeCircle(marker.hitArea.x, marker.hitArea.y, 20);
    });

    this.npcMarkers.forEach((marker) => {
      this.interactionDebugOverlay.lineStyle(2, 0x4fd09a, 0.9);
      this.interactionDebugOverlay.strokeRect(marker.hitArea.x - 17, marker.hitArea.y - 23, 34, 46);
    });

    this.groundItemMarkers.forEach((marker) => {
      this.interactionDebugOverlay.lineStyle(2, 0xffd27a, 0.92);
      this.interactionDebugOverlay.strokeRect(marker.hitArea.x - 13, marker.hitArea.y - 13, 26, 26);
    });
  }

  private handleWorldInteractionClick(worldX: number, worldY: number) {
    const interaction = this.getInteractionAtWorldPoint(worldX, worldY);
    if (!interaction) return false;
    if (interaction.kind === 'mob') this.selectMob(interaction.id);
    if (interaction.kind === 'npc') this.interactNpc(interaction.id);
    if (interaction.kind === 'groundItem') this.pickupGroundItem(interaction.id);
    return true;
  }

  private selectMob(mobId: string) {
    this.selectedMobId = mobId;
    this.selectedGroundItemId = null;
    this.services.store.update({ selectedMobId: mobId, selectedPlayerId: null });
    if (this.isAutoAttackEnabled()) {
      this.pendingWorldAction = null;
      this.services.socket.send({ type: 'target_mob', mobId });
      return;
    }
    this.pendingWorldAction = null;
    this.services.socket.send({ type: 'combat.clearTarget' });
  }

  private interactNpc(npcId: string) {
    this.selectedGroundItemId = null;
    const state = this.services.store.getState();
    const npc = Array.isArray(state.resolvedWorld?.npcs)
      ? state.resolvedWorld?.npcs.find((entry: any) => String(entry?.id || '') === npcId)
      : null;
    if (!npc) return;
    this.pendingWorldAction = {
      kind: 'npc',
      id: npcId,
      range: Math.max(60, Number(npc.interactRange || NPC_INTERACT_RANGE)),
      lastIssuedAt: 0,
      lastIssuedX: Number(npc.x || 0),
      lastIssuedY: Number(npc.y || 0)
    };
    this.queueMoveToWorld(Number(npc.x || 0), Number(npc.y || 0), true);
  }

  private pickupGroundItem(itemId: string) {
    this.selectedGroundItemId = itemId;
    const state = this.services.store.getState();
    const item = Array.isArray(state.resolvedWorld?.groundItems)
      ? state.resolvedWorld?.groundItems.find((entry: any) => String(entry?.id || '') === itemId)
      : null;
    if (!item) return;
    this.pendingWorldAction = {
      kind: 'groundItem',
      id: itemId,
      range: ITEM_PICKUP_RANGE,
      lastIssuedAt: 0,
      lastIssuedX: Number(item.x || 0),
      lastIssuedY: Number(item.y || 0)
    };
    this.queueMoveToWorld(Number(item.x || 0), Number(item.y || 0), true);
  }

  private getInteractionAtWorldPoint(worldX: number, worldY: number): HoverInteraction | null {
    for (const [mobId, marker] of this.mobMarkers) {
      if (!marker.body.visible) continue;
      if (Phaser.Math.Distance.Between(worldX, worldY, marker.hitArea.x, marker.hitArea.y) <= 20) {
        return { kind: 'mob', id: mobId };
      }
    }

    for (const [npcId, marker] of this.npcMarkers) {
      if (!marker.body.visible) continue;
      if (worldX >= marker.hitArea.x - 17 && worldX <= marker.hitArea.x + 17 && worldY >= marker.hitArea.y - 23 && worldY <= marker.hitArea.y + 23) {
        return { kind: 'npc', id: npcId };
      }
    }

    for (const [itemId, marker] of this.groundItemMarkers) {
      if (!marker.body.visible) continue;
      if (worldX >= marker.hitArea.x - 13 && worldX <= marker.hitArea.x + 13 && worldY >= marker.hitArea.y - 13 && worldY <= marker.hitArea.y + 13) {
        return { kind: 'groundItem', id: itemId };
      }
    }

    return null;
  }

  private processPendingWorldAction(localMarker: PlayerMarker, state: ReturnType<GameStore['getState']>) {
    if (!this.pendingWorldAction) return;
    const action = this.pendingWorldAction;
    const target = this.resolvePendingActionTarget(action, state);
    if (!target) {
      this.pendingWorldAction = null;
      return;
    }

    const targetX = Number(target.x || 0);
    const targetY = Number(target.y || 0);
    const distance = Phaser.Math.Distance.Between(localMarker.currentWorldX, localMarker.currentWorldY, targetX, targetY);

    if (distance <= action.range) {
      if (action.kind === 'groundItem') this.services.socket.send({ type: 'pickup_item', itemId: action.id });
      if (action.kind === 'npc') this.services.socket.send({ type: 'npc.interact', npcId: action.id });
      this.pendingWorldAction = null;
      return;
    }

    const needsRefresh = this.time.now - action.lastIssuedAt >= ACTION_REISSUE_MS
      || Phaser.Math.Distance.Between(action.lastIssuedX, action.lastIssuedY, targetX, targetY) >= ACTION_REISSUE_DISTANCE;
    if (!needsRefresh) return;
    action.lastIssuedAt = this.time.now;
    action.lastIssuedX = targetX;
    action.lastIssuedY = targetY;
    this.queueMoveToWorld(targetX, targetY, true);
  }

  private resolvePendingActionTarget(action: PendingWorldAction, state: ReturnType<GameStore['getState']>) {
    if (action.kind === 'mob') {
      return Array.isArray(state.resolvedWorld?.mobs)
        ? state.resolvedWorld.mobs.find((entry: any) => String(entry?.id || '') === action.id) || null
        : null;
    }
    if (action.kind === 'npc') {
      return Array.isArray(state.resolvedWorld?.npcs)
        ? state.resolvedWorld.npcs.find((entry: any) => String(entry?.id || '') === action.id) || null
        : null;
    }
    return Array.isArray(state.resolvedWorld?.groundItems)
      ? state.resolvedWorld.groundItems.find((entry: any) => String(entry?.id || '') === action.id) || null
      : null;
  }

  private updateHoverCursor() {
    const pointer = this.input.activePointer;
    const world = this.screenToWorld(pointer.worldX, pointer.worldY);
    if (!world) {
      this.hoveredInteraction = null;
      this.applyCursor('default');
      return;
    }
    const interaction = this.getInteractionAtWorldPoint(world.x, world.y);
    if (!interaction) {
      this.hoveredInteraction = null;
      this.applyCursor('default');
      return;
    }
    this.hoveredInteraction = interaction;
    this.applyCursor(interaction.kind === 'mob' ? 'sword' : 'hand');
  }

  private isAutoAttackEnabled() {
    const checkbox = document.getElementById('auto-attack-toggle') as HTMLInputElement | null;
    return checkbox ? Boolean(checkbox.checked) : true;
  }

  private clearPendingSelection(clearCombatTarget = false) {
    this.pendingWorldAction = null;
    this.selectedGroundItemId = null;
    this.selectedMobId = null;
    this.services.store.update({ selectedMobId: null, selectedPlayerId: null });
    if (clearCombatTarget) {
      this.services.socket.send({ type: 'combat.clearTarget' });
    }
  }

  private applyCursor(cursor: 'default' | 'hand' | 'sword') {
    if (this.lastCursorKey === cursor) return;
    this.lastCursorKey = cursor;
    const canvas = this.game.canvas as HTMLCanvasElement | undefined;
    if (!canvas) return;
    if (cursor === 'hand') {
      canvas.style.cursor = HAND_CURSOR;
      return;
    }
    if (cursor === 'sword') {
      canvas.style.cursor = SWORD_CURSOR;
      return;
    }
    canvas.style.cursor = '';
  }

  private updateMarkerVisibility() {
    const view = this.cameras.main.worldView;
    const minX = view.x - 220;
    const minY = view.y - 220;
    const maxX = view.right + 220;
    const maxY = view.bottom + 220;
    const isVisible = (x: number, y: number) => x >= minX && x <= maxX && y >= minY && y <= maxY;

    this.playerMarkers.forEach((marker) => {
      marker.body.setVisible(isVisible(marker.currentX, marker.currentY));
    });
    this.mobMarkers.forEach((marker) => {
      const visible = isVisible(marker.body.x, marker.body.y);
      marker.body.setVisible(visible);
    });
    this.npcMarkers.forEach((marker) => {
      marker.body.setVisible(isVisible(marker.body.x, marker.body.y));
    });
    this.groundItemMarkers.forEach((marker) => {
      const visible = isVisible(marker.body.x, marker.body.y);
      const itemId = String(marker.hitArea.getData('interactionId') || '');
      const hovered = this.hoveredInteraction?.kind === 'groundItem' && this.hoveredInteraction.id === itemId;
      const selected = this.selectedGroundItemId === itemId;
      marker.body.setVisible(visible);
      marker.hitArea.setVisible(visible);
      marker.diamond.setFillStyle(selected ? 0xf3d58a : hovered ? 0xffebaa : 0xd8b56f, selected ? 1 : 0.96);
      marker.diamond.setStrokeStyle(selected || hovered ? 2 : 1, selected ? 0xfff7cf : 0xa46f2c, selected ? 0.95 : 0.7);
      marker.badge.setAlpha(selected || hovered ? 1 : 0.82);
    });
  }
  private getLayerColor(layerName: string, gid: number, layerIndex: number) {
    const name = layerName.toLowerCase();
    if (name.includes('ch') || name.includes('ground')) return 0x284a61;
    if (name.includes('pare') || name.includes('wall')) return 0x536d84;
    if (name.includes('obj')) return 0xb78844;
    const seed = (gid * 37 + layerIndex * 17) % 3;
    return [0x2f5065, 0x395d70, 0x4e6f78][seed] || 0x395d70;
  }

  private syncFromStore() {
    const state = this.services.store.getState();
    const world = state.resolvedWorld;
    this.selectedMobId = state.selectedMobId;
    const mapUrl = String(world?.mapTiled?.tmjUrl || this.mapDocument?.url || DEFAULT_MAP_URL);
    if (!this.mapDocument || this.mapDocument.url !== mapUrl) {
      if (this.loadingMapUrl === mapUrl) return;
      void this.loadAndRenderMap(mapUrl).then(() => this.syncFromStore()).catch(() => undefined);
      return;
    }

    const players = world?.players || {};
    const mobs = Array.isArray(world?.mobs) ? world.mobs : [];
    const npcs = Array.isArray(world?.npcs) ? world.npcs : [];
    const groundItems = Array.isArray(world?.groundItems) ? world.groundItems : [];
    const localPlayer = state.playerId ? players[String(state.playerId)] : null;
    const visibleIds = new Set<string>();
    const visibleMobIds = new Set<string>();
    const visibleNpcIds = new Set<string>();
    const visibleGroundItemIds = new Set<string>();

    Object.entries(players).forEach(([id, player]) => {
      visibleIds.add(id);
      let marker = this.playerMarkers.get(id);
      if (!marker) {
        marker = this.createPlayerMarker(id, player, state.playerId);
        this.playerMarkers.set(id, marker);
      }
      this.syncPlayerMarker(marker, id, player, state);
    });

    Array.from(this.playerMarkers.keys()).forEach((id) => {
      if (visibleIds.has(id)) return;
      const marker = this.playerMarkers.get(id);
      marker?.body.destroy(true);
      this.playerMarkers.delete(id);
      this.entityDepthDirty = true;
    });

    mobs.forEach((mob: any) => {
      const mobId = String(mob.id || '');
      if (!mobId) return;
      visibleMobIds.add(mobId);
      let marker = this.mobMarkers.get(mobId);
      if (!marker) {
        const outline = this.add.circle(0, 0, 18, 0x08111b, 0);
        outline.setStrokeStyle(2, 0xf4f8ff, 0.18);
        const bodyFill = this.add.circle(0, 0, 14, this.getMobColor(mob.kind), 1);
        const hpBg = this.add.rectangle(0, -26, 44, 6, 0x1a2230, 0.92);
        const hpBar = this.add.rectangle(-22, -26, 44, 6, 0x4bd06d, 1).setOrigin(0, 0.5);
        const badge = this.add.text(0, -42, String(mob.kind || 'Mob'), {
          fontFamily: 'Segoe UI',
          fontSize: '13px',
          color: '#edf5ff',
          backgroundColor: 'rgba(8,17,27,0.68)',
          padding: { x: 6, y: 2 }
        }).setOrigin(0.5);
        const body = this.add.container(0, 0, [outline, hpBg, hpBar, bodyFill, badge]);
        body.setSize(48, 48);
        const hitArea = this.add.zone(0, 0, 40, 40);
        hitArea.setInteractive(new Phaser.Geom.Circle(0, 0, 20), Phaser.Geom.Circle.Contains);
        hitArea.setData('interactionKind', 'mob');
        hitArea.setData('interactionId', mobId);
        this.entityLayer.add(body);
        this.entityLayer.add(hitArea);
        marker = { body, hitArea, badge, hpBar, hpBg };
        this.mobMarkers.set(mobId, marker);
      }

      marker.badge.setText(`${this.getMobLabel(mob.kind)}${mob.level ? ` Lv.${Number(mob.level)}` : ''}`);
      marker.hpBar.width = 44 * Math.max(0, Math.min(1, Number(mob.hp || 0) / Math.max(1, Number(mob.maxHp || 1))));
      const projected = this.worldToScreen(Number(mob.x || 0), Number(mob.y || 0));
      marker.body.setPosition(projected.x, projected.y);
      marker.body.setDepth(projected.y);
      marker.hitArea.setPosition(projected.x, projected.y);
      marker.hitArea.setDepth(projected.y + 0.5);
      marker.body.list[0]?.setStrokeStyle?.(this.selectedMobId === mobId ? 3 : 2, this.selectedMobId === mobId ? 0xffd36a : 0xf4f8ff, this.selectedMobId === mobId ? 0.95 : 0.18);
    });

    Array.from(this.mobMarkers.keys()).forEach((id) => {
      if (visibleMobIds.has(id)) return;
      const marker = this.mobMarkers.get(id);
      marker?.hitArea.destroy();
      marker?.body.destroy(true);
      this.mobMarkers.delete(id);
      if (this.selectedMobId === id) {
        this.selectedMobId = null;
        this.services.store.update({ selectedMobId: null });
      }
      this.entityDepthDirty = true;
    });

    npcs.forEach((npc: any) => {
      const npcId = String(npc.id || '');
      if (!npcId) return;
      visibleNpcIds.add(npcId);
      let marker = this.npcMarkers.get(npcId);
      if (!marker) {
        const bodyFill = this.add.rectangle(0, 0, 24, 34, 0x74c69d, 1);
        const outline = this.add.rectangle(0, 0, 28, 38, 0x08111b, 0);
        outline.setStrokeStyle(2, 0xd4f1df, 0.4);
        const badge = this.add.text(0, -34, String(npc.name || 'NPC'), {
          fontFamily: 'Segoe UI',
          fontSize: '13px',
          color: '#edf5ff',
          backgroundColor: 'rgba(8,17,27,0.68)',
          padding: { x: 6, y: 2 }
        }).setOrigin(0.5);
        const body = this.add.container(0, 0, [outline, bodyFill, badge]);
        body.setSize(30, 40);
        const hitArea = this.add.zone(0, 0, 34, 46);
        hitArea.setInteractive(new Phaser.Geom.Rectangle(-17, -23, 34, 46), Phaser.Geom.Rectangle.Contains);
        hitArea.setData('interactionKind', 'npc');
        hitArea.setData('interactionId', npcId);
        this.entityLayer.add(body);
        this.entityLayer.add(hitArea);
        marker = { body, hitArea, badge, sprite: bodyFill };
        this.npcMarkers.set(npcId, marker);
      }

      marker.badge.setText(String(npc.name || 'NPC'));
      const projected = this.worldToScreen(Number(npc.x || 0), Number(npc.y || 0));
      marker.body.setPosition(projected.x, projected.y - 8);
      marker.body.setDepth(projected.y - 8);
      marker.hitArea.setPosition(projected.x, projected.y - 8);
      marker.hitArea.setDepth(projected.y - 7.5);
    });

    Array.from(this.npcMarkers.keys()).forEach((id) => {
      if (visibleNpcIds.has(id)) return;
      const marker = this.npcMarkers.get(id);
      marker?.hitArea.destroy();
      marker?.body.destroy(true);
      this.npcMarkers.delete(id);
      this.entityDepthDirty = true;
    });

    groundItems.forEach((item: any) => {
      const itemId = String(item.id || '');
      if (!itemId) return;
      visibleGroundItemIds.add(itemId);
      let marker = this.groundItemMarkers.get(itemId);
      if (!marker) {
        const diamond = this.add.rectangle(0, 0, 16, 16, 0xd8b56f, 1).setAngle(45);
        diamond.setStrokeStyle(1, 0xa46f2c, 0.7);
        const badge = this.add.text(0, -20, String(item.name || item.templateId || 'Item'), {
          fontFamily: 'Segoe UI',
          fontSize: '12px',
          color: '#fff5d8',
          backgroundColor: 'rgba(8,17,27,0.62)',
          padding: { x: 4, y: 2 }
        }).setOrigin(0.5);
        const body = this.add.container(0, 0, [diamond, badge]);
        body.setSize(24, 24);
        const hitArea = this.add.zone(0, 0, 26, 26);
        hitArea.setInteractive(new Phaser.Geom.Rectangle(-13, -13, 26, 26), Phaser.Geom.Rectangle.Contains);
        hitArea.setData('interactionKind', 'groundItem');
        hitArea.setData('interactionId', itemId);
        this.entityLayer.add(body);
        this.entityLayer.add(hitArea);
        marker = { body, hitArea, badge, diamond };
        this.groundItemMarkers.set(itemId, marker);
      }
      const projected = this.worldToScreen(Number(item.x || 0), Number(item.y || 0));
      marker.body.setPosition(projected.x, projected.y);
      marker.body.setDepth(projected.y);
      marker.hitArea.setPosition(projected.x, projected.y);
      marker.hitArea.setDepth(projected.y + 0.5);
      marker.badge.setText(String(item.name || item.templateId || 'Item'));
    });

    Array.from(this.groundItemMarkers.keys()).forEach((id) => {
      if (visibleGroundItemIds.has(id)) return;
      const marker = this.groundItemMarkers.get(id);
      marker?.hitArea.destroy();
      marker?.body.destroy(true);
      this.groundItemMarkers.delete(id);
      this.entityDepthDirty = true;
    });

    if (!localPlayer) {
      this.localPlayerAnchor.setVisible(false);
    }

    this.entityDepthDirty = true;
    this.renderCombatFeedback(state.lastCombatEvent);
    this.renderQueuedCombatBursts(state.combatBursts);
    this.renderQueuedSkillEffects(state.skillEffects);
  }

  private createPlayerMarker(id: string, player: any, localPlayerId: number | null) {
    const textureKey = this.resolvePlayerTextureKey(player);
    const usingSpriteSheet = Boolean(textureKey && this.textures.exists(textureKey));
    const displayName = `${String(player?.name || 'Player')} Lv.${Number(player?.level || 1)}`;
        const outline = usingSpriteSheet
      ? this.add.ellipse(0, 6, 28, 12, 0x08111b, 0).setStrokeStyle(2, 0xf4f8ff, 0.4)
      : this.add.circle(0, 0, 20, 0x08111b, 0).setStrokeStyle(2, 0xf4f8ff, 0.4);
    const sprite = usingSpriteSheet
      ? this.add.sprite(0, PLAYER_SPRITE_Y_OFFSET, textureKey!, this.getFrameIndex(0, DIRECTION_COLUMN.s)).setOrigin(0.5, 1)
      : this.add.circle(0, 0, 18, id === String(localPlayerId) ? 0xd9a441 : this.getPlayerTint(String(player?.class || 'knight')), 1);
    const badgeY = usingSpriteSheet ? PLAYER_BADGE_Y : -34;
    const badge = this.add.text(0, badgeY, displayName, {
      fontFamily: 'Segoe UI',
      fontSize: '14px',
      color: '#edf5ff',
      backgroundColor: 'rgba(8,17,27,0.68)',
      padding: { x: 8, y: 3 }
    }).setOrigin(0.5);
    const body = this.add.container(0, 0, [outline, sprite, badge]);
    body.setSize(usingSpriteSheet ? 56 : 40, usingSpriteSheet ? 128 : 40);
    if (usingSpriteSheet) {
      body.setInteractive(new Phaser.Geom.Rectangle(-28, -108, 56, 120), Phaser.Geom.Rectangle.Contains);
    } else {
      body.setInteractive(new Phaser.Geom.Circle(0, 0, 20), Phaser.Geom.Circle.Contains);
    }
    body.setData('interactionKind', 'player');
    body.setData('interactionId', id);
    body.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (id === String(this.services.store.getState().playerId)) return;
      pointer.event.stopPropagation();
      this.services.store.update({ selectedPlayerId: Number(id) || null, selectedMobId: null });
    });
    body.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (id === String(this.services.store.getState().playerId)) return;
      if (pointer.rightButtonReleased()) {
        this.services.socket.send({ type: 'combat.targetPlayer', targetPlayerId: Number(id) });
      }
    });
    this.entityLayer.add(body);

    const projected = this.worldToScreen(Number(player?.x || 0), Number(player?.y || 0));
    const marker: PlayerMarker = {
      body,
      badge,
      sprite: sprite as Phaser.GameObjects.Sprite | Phaser.GameObjects.Arc,
      outline,
      usingSpriteSheet,
      targetX: projected.x,
      targetY: projected.y,
      currentX: projected.x,
      currentY: projected.y,
      targetWorldX: Number(player?.x || 0),
      targetWorldY: Number(player?.y || 0),
      currentWorldX: Number(player?.x || 0),
      currentWorldY: Number(player?.y || 0),
      velocityWorldX: 0,
      velocityWorldY: 0,
      lastServerSyncAt: this.time.now,
      lastFacing: 's',
      lastLabel: displayName,
      lastDead: Number(player?.hp || 0) <= 0,
      attackUntil: 0,
      hasWeapon: this.playerHasWeapon(player),
      pendingPath: [],
      lastMoveAckReqId: 0,
      lastFacingChangeAt: 0,
      lastAnimKey: ''
    };
    marker.body.setPosition(projected.x, projected.y);
    marker.body.setDepth(projected.y);
    this.updatePlayerAnimation(marker, player, this.time.now);
    this.entityDepthDirty = true;
    return marker;
  }

  private syncPlayerMarker(marker: PlayerMarker, id: string, player: any, state: ReturnType<GameStore['getState']>) {
    const label = this.getPlayerDisplayName(player);
    if (marker.lastLabel !== label) {
      marker.badge.setText(label);
      marker.lastLabel = label;
    }
    const nextWorldX = Number(player?.x || 0);
    const nextWorldY = Number(player?.y || 0);
    const now = this.time.now;
    const dt = Math.max(16, now - marker.lastServerSyncAt);
    const deltaWorldX = nextWorldX - marker.targetWorldX;
    const deltaWorldY = nextWorldY - marker.targetWorldY;
    const movingEnough = Math.hypot(deltaWorldX, deltaWorldY) > 2;
    marker.velocityWorldX = movingEnough ? deltaWorldX / (dt / 1000) : 0;
    marker.velocityWorldY = movingEnough ? deltaWorldY / (dt / 1000) : 0;
    marker.lastServerSyncAt = now;
    const projected = this.worldToScreen(nextWorldX, nextWorldY);
    marker.hasWeapon = this.playerHasWeapon(player);
    const selected = state.selectedPlayerId === Number(id) && id !== String(state.playerId);
    marker.outline.setStrokeStyle(selected ? 3 : 2, selected ? 0xffd36a : 0xf4f8ff, selected ? 0.95 : 0.4);

    if (id === String(state.playerId)) {
      const ack = state.lastMoveAck;
      if (ack && Number(ack.reqId || 0) > marker.lastMoveAckReqId) {
        marker.pendingPath = this.normalizeMovePath(marker, ack);
        marker.lastMoveAckReqId = Number(ack.reqId || 0);
        marker.targetWorldX = Number.isFinite(Number(ack.projectedX)) ? Number(ack.projectedX) : marker.targetWorldX;
        marker.targetWorldY = Number.isFinite(Number(ack.projectedY)) ? Number(ack.projectedY) : marker.targetWorldY;
        marker.velocityWorldX = 0;
        marker.velocityWorldY = 0;
      } else if (!marker.pendingPath.length) {
        marker.pendingPath = this.normalizeSnapshotPath(marker, player);
      }
      const serverDrift = Math.hypot(nextWorldX - marker.currentWorldX, nextWorldY - marker.currentWorldY);
      if (marker.pendingPath.length > 0 && serverDrift <= LOCAL_SERVER_CORRECTION_THRESHOLD) {
        const pendingTarget = marker.pendingPath[marker.pendingPath.length - 1];
        if (pendingTarget) {
          marker.targetWorldX = pendingTarget.x;
          marker.targetWorldY = pendingTarget.y;
          const pendingProjected = this.worldToScreen(pendingTarget.x, pendingTarget.y);
          marker.targetX = pendingProjected.x;
          marker.targetY = pendingProjected.y;
        }
        marker.velocityWorldX = 0;
        marker.velocityWorldY = 0;
      } else {
        marker.targetX = projected.x;
        marker.targetY = projected.y;
        marker.targetWorldX = nextWorldX;
        marker.targetWorldY = nextWorldY;
      }
      if (serverDrift > 180) {
        marker.pendingPath = [];
        marker.currentWorldX = nextWorldX;
        marker.currentWorldY = nextWorldY;
      } else if (marker.pendingPath.length > 0) {
        marker.pendingPath = marker.pendingPath.filter((node) => Math.hypot(node.x - marker.currentWorldX, node.y - marker.currentWorldY) > 8);
      }
    } else {
      marker.targetX = projected.x;
      marker.targetY = projected.y;
      marker.targetWorldX = nextWorldX;
      marker.targetWorldY = nextWorldY;
    }

    if (!marker.usingSpriteSheet) return;
    const dead = Number(player?.hp || 0) <= 0;
    if (dead && !marker.lastDead) {
      marker.attackUntil = 0;
      marker.pendingPath = [];
    }
    marker.lastDead = dead;
  }

  private resolvePlayerTextureKey(player: any) {
    const className = String(player?.class || '').toLowerCase();
    const gender = String(player?.gender || '').toLowerCase();
    if (className === 'archer' && gender === 'female') return PLAYER_SPRITE_KEYS.archerFemale;
    return null;
  }

  private playerHasWeapon(player: any) {
    if (!player || typeof player !== 'object') return false;
    if (player.equippedWeaponId) return true;
    if (player.equippedWeaponName) return true;
    if (player.equippedBySlot?.weapon) return true;
    return Array.isArray(player.inventory)
      ? player.inventory.some((item: any) => item && String(item.type || '') === 'weapon' && item.equipped === true)
      : false;
  }

  private updatePlayerAnimation(marker: PlayerMarker, player: any, time: number, movedWorldX: number, movedWorldY: number) {
    if (!marker.usingSpriteSheet || !(marker.sprite instanceof Phaser.GameObjects.Sprite)) return;
    const dx = marker.targetWorldX - marker.currentWorldX;
    const dy = marker.targetWorldY - marker.currentWorldY;
    const dead = Number(player?.hp || 0) <= 0;
    const frameMotion = Math.hypot(movedWorldX, movedWorldY);
    const velocityMotion = Math.hypot(marker.velocityWorldX, marker.velocityWorldY);
    const moving = marker.pendingPath.length > 0 || frameMotion > 0.35 || velocityMotion > 12 || Math.hypot(dx, dy) > 4;
    if (moving) {
      const facingDx = marker.pendingPath.length > 0
        ? marker.pendingPath[0].x - marker.currentWorldX
        : frameMotion > 0.05
          ? movedWorldX
          : velocityMotion > 0.05
            ? marker.velocityWorldX
            : dx;
      const facingDy = marker.pendingPath.length > 0
        ? marker.pendingPath[0].y - marker.currentWorldY
        : frameMotion > 0.05
          ? movedWorldY
          : velocityMotion > 0.05
            ? marker.velocityWorldY
            : dy;
      const nextFacing = this.resolveFacing(facingDx, facingDy, marker.lastFacing);
      const facingMagnitude = Math.hypot(facingDx, facingDy);
      if (
        nextFacing !== marker.lastFacing
        && facingMagnitude >= FACING_MIN_VECTOR
        && (time - marker.lastFacingChangeAt >= FACING_CHANGE_HYSTERESIS_MS || frameMotion > 4.5 || velocityMotion > 220)
      ) {
        marker.lastFacing = nextFacing;
        marker.lastFacingChangeAt = time;
      }
    }
    const state: PlayerAnimState = dead
      ? 'dead'
      : time < marker.attackUntil
        ? (marker.hasWeapon ? 'attack-weapon' : 'attack-unarmed')
        : moving
          ? 'walk'
          : 'idle';
    const key = 'archer-female:' + state + ':' + marker.lastFacing;
    if (marker.lastAnimKey !== key) {
      marker.lastAnimKey = key;
      marker.sprite.play(key, true);
    }
  }

  private resolveFacing(dx: number, dy: number, fallback: FacingDirection): FacingDirection {
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return fallback;
    const origin = this.worldToScreen(0, 0);
    const delta = this.worldToScreen(dx, dy);
    const screenDx = delta.x - origin.x;
    const screenDy = delta.y - origin.y;
    if (Math.abs(screenDx) < 0.01 && Math.abs(screenDy) < 0.01) return fallback;
    const angle = Phaser.Math.RadToDeg(Math.atan2(screenDy, screenDx));
    if (angle >= 22.5 && angle < 67.5) return 'se';
    if (angle >= 67.5 && angle < 112.5) return 's';
    if (angle >= 112.5 && angle < 157.5) return 'sw';
    if (angle >= 157.5 || angle < -157.5) return 'w';
    if (angle >= -157.5 && angle < -112.5) return 'nw';
    if (angle >= -112.5 && angle < -67.5) return 'n';
    if (angle >= -67.5 && angle < -22.5) return 'ne';
    return 'e';
  }

  private getPlayerDisplayName(player: any) {
    const role = String(player?.role || '').toLowerCase();
    const tag = role === 'adm' ? '[ADM] ' : '';
    return tag + String(player?.name || 'Player') + ' Lv.' + Number(player?.level || 1);
  }

  private markPlayerAttacking(attackerId: string | number | null | undefined) {
    const marker = this.playerMarkers.get(String(attackerId || ''));
    if (!marker || marker.lastDead) return;
    marker.attackUntil = this.time.now + PLAYER_ATTACK_MS;
  }

  private normalizeSnapshotPath(marker: PlayerMarker, player: any) {
    const rawNodes = Array.isArray(player?.pathNodes) ? player.pathNodes : [];
    return rawNodes
      .map((node: any) => ({ x: Number(node?.x || 0), y: Number(node?.y || 0) }))
      .filter((node: { x: number; y: number }) => Number.isFinite(node.x) && Number.isFinite(node.y))
      .filter((node: { x: number; y: number }) => Math.hypot(node.x - marker.currentWorldX, node.y - marker.currentWorldY) > 6)
      .slice(0, 40);
  }
  private normalizeMovePath(marker: PlayerMarker, ack: any) {
    const rawNodes = Array.isArray(ack?.pathNodes) ? ack.pathNodes : [];
    const nodes = rawNodes
      .map((node: any) => ({ x: Number(node?.x || 0), y: Number(node?.y || 0) }))
      .filter((node: { x: number; y: number }) => Number.isFinite(node.x) && Number.isFinite(node.y));
    const projectedX = Number(ack?.projectedX);
    const projectedY = Number(ack?.projectedY);
    if (Number.isFinite(projectedX) && Number.isFinite(projectedY)) {
      nodes.push({ x: projectedX, y: projectedY });
    }
    return nodes.filter((node, index) => index === 0 || Math.hypot(node.x - marker.currentWorldX, node.y - marker.currentWorldY) > 6);
  }

  private advanceLocalPlayerMarker(marker: PlayerMarker, player: any, delta: number, blend: number) {
    const moveSpeed = this.getPlayerMoveSpeed(player);
    let remaining = moveSpeed * (Math.max(1, delta) / 1000);

    while (remaining > 0.01 && marker.pendingPath.length > 0) {
      const nextNode = marker.pendingPath[0];
      const dx = nextNode.x - marker.currentWorldX;
      const dy = nextNode.y - marker.currentWorldY;
      const distance = Math.hypot(dx, dy);
      if (distance <= 2) {
        marker.currentWorldX = nextNode.x;
        marker.currentWorldY = nextNode.y;
        marker.pendingPath.shift();
        continue;
      }
      const ux = distance > 0.0001 ? dx / distance : 0;
      const uy = distance > 0.0001 ? dy / distance : 0;
      const isoMultiplier = this.getIsoMoveStepMultiplier(ux, uy);
      const adjustedRemaining = remaining * isoMultiplier;
      const step = Math.min(distance, adjustedRemaining);
      marker.currentWorldX += (dx / distance) * step;
      marker.currentWorldY += (dy / distance) * step;
      remaining -= Math.min(remaining, step / Math.max(0.0001, isoMultiplier));
      if (step < distance) break;
      marker.pendingPath.shift();
    }

    if (!marker.pendingPath.length) {
      marker.currentWorldX = Phaser.Math.Linear(marker.currentWorldX, marker.targetWorldX, Math.min(1, blend * 1.35));
      marker.currentWorldY = Phaser.Math.Linear(marker.currentWorldY, marker.targetWorldY, Math.min(1, blend * 1.35));
    }
  }

  private getPlayerMoveSpeed(player: any) {
    const moveSpeedStat = Math.max(20, Number(player?.stats?.moveSpeed || 100));
    return 140 * (moveSpeedStat / 100);
  }

  private getIsoMoveStepMultiplier(ux: number, uy: number) {
    const proj = Math.hypot(ISO_AXIAL_RATIO * (ux - uy), ux + uy);
    const card = Math.hypot(ISO_AXIAL_RATIO, 1);
    if (!Number.isFinite(proj) || proj <= 0.0001) return 1;
    return Phaser.Math.Clamp(card / proj, 0.78, 1.62);
  }

  private worldToScreen(worldX: number, worldY: number) {
    if (!this.mapDocument) return { x: 0, y: 0 };
    const tileX = worldX / this.renderTileSize;
    const tileY = worldY / this.renderTileSize;
    const halfTileW = this.renderTileWidth / 2;
    const halfTileH = this.renderTileHeight / 2;
    return {
      x: (tileX - tileY) * halfTileW + this.renderOriginX,
      y: (tileX + tileY) * halfTileH + this.renderOriginY
    };
  }

  private screenToWorld(screenX: number, screenY: number) {
    const worldMeta = this.services.store.getState().resolvedWorld?.world;
    if (!this.mapDocument || !worldMeta) return null;
    const halfTileW = this.renderTileWidth / 2;
    const halfTileH = this.renderTileHeight / 2;
    const localX = screenX - this.renderOriginX;
    const localY = screenY - this.renderOriginY;
    const tileX = (localX / halfTileW + localY / halfTileH) / 2;
    const tileY = (localY / halfTileH - localX / halfTileW) / 2;
    return {
      x: Phaser.Math.Clamp(tileX * this.renderTileSize, 0, Number(worldMeta.width || 0)),
      y: Phaser.Math.Clamp(tileY * this.renderTileSize, 0, Number(worldMeta.height || 0))
    };
  }

  private handleResize(gameSize: Phaser.Structs.Size | { width: number; height: number }) {
    const width = Number(gameSize.width || 0);
    const height = Number(gameSize.height || 0);
    if (!width || !height) return;
    this.cameras.main.setSize(width, height);
    const responsiveBaseZoom = width < 900 ? 0.8 : width < 1400 ? 0.9 : 0.98;
    this.baseCameraZoom = this.projectedMapWidth > 0
      ? Phaser.Math.Clamp(responsiveBaseZoom, 0.78, 1.02)
      : responsiveBaseZoom;
    this.applyCameraZoom();
    this.cameras.main.setBounds(0, 0, this.projectedMapWidth || width, (this.projectedMapHeight || height) + 180);
  }

  private applyCameraZoom() {
    this.currentCameraZoom = Phaser.Math.Clamp(this.baseCameraZoom * this.userZoomFactor, this.baseCameraZoom * 0.75, this.baseCameraZoom * 1.25);
    this.cameras.main.setZoom(this.currentCameraZoom);
  }

  private getRenderTileMetrics() {
    const map = this.mapDocument;
    if (!map) return { tileWidth: 48, tileHeight: 24 };
    const state = this.services.store.getState();
    const worldTileSize = Math.max(1, Number(state.resolvedWorld?.mapTiled?.worldTileSize || map.worldTileSize || map.tileWidth));
    const worldScale = Math.max(0.1, Number(state.resolvedWorld?.mapTiled?.worldScale || 1));
    const tileWidth = Math.max(28, Math.min(map.tileWidth, worldTileSize * worldScale));
    const tileHeight = Math.max(14, map.tileHeight * (tileWidth / Math.max(1, map.tileWidth)));
    return { tileWidth, tileHeight };
  }

  private getMobColor(kind: string) {
    const normalized = String(kind || '').toLowerCase();
    if (normalized === 'boss') return 0xcf5a4f;
    if (normalized === 'subboss') return 0xc97b39;
    if (normalized === 'elite') return 0xe29f35;
    return 0xc73e3e;
  }

  private getPlayerTint(className: string) {
    const normalized = String(className || '').toLowerCase();
    if (normalized === 'archer') return 0xffcf7b;
    if (normalized === 'druid' || normalized === 'shifter') return 0x8ee07c;
    if (normalized === 'assassin' || normalized === 'bandit') return 0xcfc4ff;
    return 0x9fcbff;
  }

  private getMobLabel(kind: string) {
    const normalized = String(kind || '').toLowerCase();
    if (normalized === 'boss') return 'Boss';
    if (normalized === 'subboss') return 'Subboss';
    if (normalized === 'elite') return 'Elite';
    return 'Monstro';
  }

  private renderCombatFeedback(event: any) {
    if (!event || typeof event !== 'object') return;
    const signature = JSON.stringify([
      event.type,
      event.mobId,
      event.attackerId,
      event.targetPlayerId,
      event.damage,
      event.targetHp
    ]);
    if (signature === this.lastCombatSignature) return;
    this.lastCombatSignature = signature;
    this.markPlayerAttacking(event.attackerId);

    const worldX = Number(event.targetX ?? event.mobX ?? event.attackerX ?? 0);
    const worldY = Number(event.targetY ?? event.mobY ?? event.attackerY ?? 0);
    const damage = Number(event.damage || 0);
    const projected = this.worldToScreen(worldX, worldY);
    const tone = event?.type === 'combat.playerHit' ? '#ff8989' : event?.type === 'combat.mobHitPlayer' ? '#ffcf8a' : '#ffe59f';
    const text = this.add.text(projected.x, projected.y - 40, damage > 0 ? `-${damage}` : 'Hit', {
      fontFamily: 'Segoe UI',
      fontSize: '20px',
      color: tone,
      stroke: '#281404',
      strokeThickness: 4
    }).setOrigin(0.5);
    text.setDepth(10010);
    const targetMarker = event?.mobId ? this.mobMarkers.get(String(event.mobId))?.body : event?.targetPlayerId ? this.playerMarkers.get(String(event.targetPlayerId))?.body : null;
    if (targetMarker) {
      this.tweens.add({
        targets: targetMarker,
        scaleX: 1.12,
        scaleY: 1.12,
        duration: 80,
        yoyo: true
      });
    }
    const slash = this.add.rectangle(projected.x, projected.y - 8, 30, 4, 0xffd36a, 0.7).setAngle(-28);
    slash.setDepth(10009);
    this.tweens.add({
      targets: text,
      y: projected.y - 86,
      alpha: 0,
      duration: 650,
      onComplete: () => text.destroy()
    });
    this.tweens.add({
      targets: slash,
      scaleX: 1.6,
      alpha: 0,
      duration: 180,
      onComplete: () => slash.destroy()
    });
  }

  private renderQueuedCombatBursts(events: any[]) {
    for (const event of Array.isArray(events) ? events : []) {
      const clientId = String(event?.__clientId || '');
      if (!clientId || this.processedCombatBursts.has(clientId)) continue;
      this.processedCombatBursts.add(clientId);
      if (this.processedCombatBursts.size > 80) {
        const first = this.processedCombatBursts.values().next().value;
        if (first) this.processedCombatBursts.delete(first);
      }
      this.markPlayerAttacking(event?.attackerId);
      const fromX = Number(event.attackerX ?? event.sourceX ?? 0);
      const fromY = Number(event.attackerY ?? event.sourceY ?? 0);
      const toX = Number(event.mobX ?? event.targetX ?? 0);
      const toY = Number(event.mobY ?? event.targetY ?? 0);
      if (!Number.isFinite(fromX) || !Number.isFinite(fromY) || !Number.isFinite(toX) || !Number.isFinite(toY)) continue;
      const from = this.worldToScreen(fromX, fromY);
      const to = this.worldToScreen(toX, toY);
      const projectile = this.add.circle(from.x, from.y - 8, 5, 0xffd36a, 0.95);
      projectile.setDepth(9999);
      this.tweens.add({
        targets: projectile,
        x: to.x,
        y: to.y - 10,
        duration: 160,
        ease: 'Quad.easeOut',
        onComplete: () => {
          projectile.destroy();
          const burst = this.add.circle(to.x, to.y - 10, 12, 0xffb347, 0.2);
          burst.setDepth(9999);
          this.tweens.add({
            targets: burst,
            scale: 1.8,
            alpha: 0,
            duration: 220,
            onComplete: () => burst.destroy()
          });
        }
      });
    }
  }

  private renderQueuedSkillEffects(effects: any[]) {
    for (const effect of Array.isArray(effects) ? effects : []) {
      const clientId = String(effect?.__clientId || '');
      if (!clientId || this.processedSkillEffects.has(clientId)) continue;
      this.processedSkillEffects.add(clientId);
      if (this.processedSkillEffects.size > 80) {
        const first = this.processedSkillEffects.values().next().value;
        if (first) this.processedSkillEffects.delete(first);
      }
      const worldX = Number(effect.x ?? 0);
      const worldY = Number(effect.y ?? 0);
      const projected = this.worldToScreen(worldX, worldY);
      const color = this.getEffectColor(String(effect.effectKey || ''));
      const ring = this.add.circle(projected.x, projected.y - 10, 18, color, 0.16);
      ring.setStrokeStyle(3, color, 0.85);
      ring.setDepth(9999);
      const label = this.add.text(projected.x, projected.y - 42, this.getEffectLabel(String(effect.effectKey || '')), {
        fontFamily: 'Segoe UI',
        fontSize: '11px',
        color: '#f8fbff',
        backgroundColor: 'rgba(8,17,27,0.6)',
        padding: { x: 5, y: 2 }
      }).setOrigin(0.5);
      label.setDepth(10000);
      this.tweens.add({
        targets: ring,
        scale: 1.7,
        alpha: 0,
        duration: 520,
        onComplete: () => ring.destroy()
      });
      this.tweens.add({
        targets: label,
        y: projected.y - 60,
        alpha: 0,
        duration: 520,
        onComplete: () => label.destroy()
      });
    }
  }

  private getEffectColor(effectKey: string) {
    const key = String(effectKey || '').toLowerCase();
    if (key.includes('heal') || key.includes('bloom') || key.includes('prayer')) return 0x55d88b;
    if (key.includes('poison') || key.includes('swarm') || key.includes('mist')) return 0x7cd96a;
    if (key.includes('stealth') || key.includes('smoke')) return 0x8f96b8;
    if (key.includes('arc') || key.includes('wind')) return 0x67c4ff;
    if (key.includes('ass')) return 0xd285ff;
    return 0xffc463;
  }

  private getEffectLabel(effectKey: string) {
    const safe = String(effectKey || 'skill').replaceAll('_', ' ').trim();
    if (safe.length <= 14) return safe.toUpperCase();
    return `${safe.slice(0, 12).toUpperCase()}..`;
  }
}






















