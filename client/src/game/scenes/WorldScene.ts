import Phaser from 'phaser';
import type { GameStore } from '../state/GameStore';
import type { GameSocket } from '../net/GameSocket';
import { loadMapDocument, type LoadedMapDocument } from '../maps/MapDocument';

type SceneServices = {
  store: GameStore;
  socket: GameSocket;
};

type PlayerMarker = {
  body: Phaser.GameObjects.Container;
  badge: Phaser.GameObjects.Text;
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Arc;
};

type MobMarker = {
  body: Phaser.GameObjects.Container;
  badge: Phaser.GameObjects.Text;
  hpBar: Phaser.GameObjects.Rectangle;
  hpBg: Phaser.GameObjects.Rectangle;
};

type NpcMarker = {
  body: Phaser.GameObjects.Container;
  badge: Phaser.GameObjects.Text;
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Rectangle;
};

type GroundItemMarker = {
  body: Phaser.GameObjects.Container;
  badge: Phaser.GameObjects.Text;
};

export class WorldScene extends Phaser.Scene {
  private readonly services: SceneServices;
  private mapDocument: LoadedMapDocument | null = null;
  private loadingMapUrl: string | null = null;
  private mapContainer!: Phaser.GameObjects.Container;
  private entityLayer!: Phaser.GameObjects.Container;
  private localPlayerAnchor!: Phaser.GameObjects.Arc;
  private playerMarkers = new Map<string, PlayerMarker>();
  private mobMarkers = new Map<string, MobMarker>();
  private npcMarkers = new Map<string, NpcMarker>();
  private groundItemMarkers = new Map<string, GroundItemMarker>();
  private selectedMobId: string | null = null;
  private lastCombatSignature: string | null = null;
  private processedCombatBursts = new Set<string>();
  private processedSkillEffects = new Set<string>();
  private changeHandler: EventListener | null = null;
  private projectedMapWidth = 0;
  private projectedMapHeight = 0;
  private loadedTileTextureKeys = new Set<string>();

  constructor(services: SceneServices) {
    super('world');
    this.services = services;
  }

  async create() {
    this.cameras.main.setBackgroundColor('#08111b');
    this.mapContainer = this.add.container(0, 0);
    this.entityLayer = this.add.container(0, 0);
    this.localPlayerAnchor = this.add.circle(0, 0, 8, 0x000000, 0);
    this.localPlayerAnchor.setVisible(false);
    this.cameras.main.startFollow(this.localPlayerAnchor, true, 0.09, 0.09);
    this.drawEmergencyMapFallback();

    this.changeHandler = () => this.syncFromStore();
    this.services.store.addEventListener('change', this.changeHandler);
    this.syncFromStore();

    this.scale.on('resize', this.handleResize, this);
    this.handleResize(this.scale.gameSize);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) return;
      const world = this.screenToWorld(pointer.worldX, pointer.worldY);
      if (!world) return;
      this.services.socket.send({
        type: 'move',
        reqId: Date.now(),
        x: world.x,
        y: world.y
      });
    });

    this.events.on(Phaser.Scenes.Events.SHUTDOWN, this.onShutdown, this);
  }

  private onShutdown() {
    if (this.changeHandler) {
      this.services.store.removeEventListener('change', this.changeHandler);
      this.changeHandler = null;
    }
    this.scale.off('resize', this.handleResize, this);
  }

  private async loadAndRenderMap(url: string) {
    this.loadingMapUrl = url;
    try {
      this.mapDocument = await loadMapDocument(url);
      await this.ensureTileTextures(this.mapDocument);
      this.mapContainer.removeAll(true);

      const map = this.mapDocument;
      const halfTileW = map.tileWidth / 2;
      const halfTileH = map.tileHeight / 2;
      this.projectedMapWidth = (map.width + map.height) * halfTileW;
      this.projectedMapHeight = (map.width + map.height) * halfTileH;
      const originX = this.projectedMapWidth / 2;
      const originY = map.tileHeight * 0.5;

      map.layers.filter((layer) => layer.visible).forEach((layer, layerIndex) => {
        const graphics = this.add.graphics();
        let usedGraphics = false;
        for (let row = 0; row < map.height; row += 1) {
          for (let col = 0; col < map.width; col += 1) {
            const gid = Number(layer.data[row * map.width + col] || 0);
            if (!gid) continue;
            const screenX = (col - row) * halfTileW + originX;
            const screenY = (col + row) * halfTileH + originY;
            const imageMeta = map.tileImages[gid];
            const textureKey = imageMeta ? this.getTileTextureKey(imageMeta.source) : '';
            if (imageMeta && textureKey && this.textures.exists(textureKey)) {
              const scale = map.tileWidth / Math.max(1, Number(imageMeta.tileWidth || imageMeta.width || map.tileWidth));
              const image = this.add.image(
                screenX + Number(imageMeta.offsetX || 0) * scale,
                screenY + (Number(imageMeta.tileHeight || map.tileHeight) * scale) + Number(imageMeta.offsetY || 0) * scale,
                textureKey
              );
              image.setOrigin(0.5, 1);
              image.setScale(scale);
              image.setDepth(layerIndex * 1000 + row + col);
              this.mapContainer.add(image);
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
        if (usedGraphics) this.mapContainer.add(graphics);
        else graphics.destroy();
      });

      const frame = this.add.graphics();
      frame.lineStyle(3, 0x274159, 0.8);
      frame.strokeRect(0, 0, this.projectedMapWidth, this.projectedMapHeight + map.tileHeight);
      this.mapContainer.add(frame);
      this.handleResize(this.scale.gameSize);
    } finally {
      this.loadingMapUrl = null;
    }
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
    const mapUrl = String(world?.mapTiled?.tmjUrl || this.mapDocument?.url || '');
    if (!world?.mapTiled?.tmjUrl && !this.mapDocument) return;
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
        const circle = this.add.circle(0, 0, 18, id === String(state.playerId) ? 0xd9a441 : this.getPlayerTint(String((player as any)?.class || 'knight')), 1);
        const outline = this.add.circle(0, 0, 20, 0x08111b, 0);
        outline.setStrokeStyle(2, 0xf4f8ff, 0.4);
        const badge = this.add.text(0, -34, String(player.name || 'Player'), {
          fontFamily: 'Segoe UI',
          fontSize: '14px',
          color: '#edf5ff',
          backgroundColor: 'rgba(8,17,27,0.68)',
          padding: { x: 8, y: 3 }
        }).setOrigin(0.5);
        const body = this.add.container(0, 0, [outline, circle, badge]);
        body.setSize(40, 40);
        body.setInteractive(new Phaser.Geom.Circle(0, 0, 20), Phaser.Geom.Circle.Contains);
        body.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          if (id === String(state.playerId)) return;
          pointer.event.stopPropagation();
          this.services.store.update({ selectedPlayerId: Number(id) || null, selectedMobId: null });
        });
        body.on('pointerup', (pointer: Phaser.Input.Pointer) => {
          if (id === String(state.playerId)) return;
          if (pointer.rightButtonReleased()) {
            this.services.socket.send({ type: 'combat.targetPlayer', targetPlayerId: Number(id) });
          }
        });
        this.entityLayer.add(body);
        marker = { body, badge, sprite: circle };
        this.playerMarkers.set(id, marker);
      }

      marker.badge.setText(`${String(player.name || 'Player')} Lv.${Number(player.level || 1)}`);
      const projected = this.worldToScreen(Number(player.x || 0), Number(player.y || 0));
      marker.body.setPosition(projected.x, projected.y);
      marker.body.setDepth(projected.y);
      const outline = marker.body.list[0] as Phaser.GameObjects.Arc | undefined;
      if (outline?.setStrokeStyle) {
        const selected = state.selectedPlayerId === Number(id) && id !== String(state.playerId);
        outline.setStrokeStyle(selected ? 3 : 2, selected ? 0xffd36a : 0xf4f8ff, selected ? 0.95 : 0.4);
      }
    });

    Array.from(this.playerMarkers.keys()).forEach((id) => {
      if (visibleIds.has(id)) return;
      const marker = this.playerMarkers.get(id);
      marker?.body.destroy(true);
      this.playerMarkers.delete(id);
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
        body.setInteractive(
          new Phaser.Geom.Circle(0, 0, 18),
          Phaser.Geom.Circle.Contains
        );
        body.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          pointer.event.stopPropagation();
          this.selectedMobId = mobId;
          this.services.store.update({ selectedMobId: mobId, selectedPlayerId: null });
          this.services.socket.send({ type: 'target_mob', mobId });
        });
        this.entityLayer.add(body);
        marker = { body, badge, hpBar, hpBg };
        this.mobMarkers.set(mobId, marker);
      }

      marker.badge.setText(`${this.getMobLabel(mob.kind)}${mob.level ? ` Lv.${Number(mob.level)}` : ''}`);
      marker.hpBar.width = 44 * Math.max(0, Math.min(1, Number(mob.hp || 0) / Math.max(1, Number(mob.maxHp || 1))));
      const projected = this.worldToScreen(Number(mob.x || 0), Number(mob.y || 0));
      marker.body.setPosition(projected.x, projected.y);
      marker.body.setDepth(projected.y);
      marker.body.list[0]?.setStrokeStyle?.(this.selectedMobId === mobId ? 3 : 2, this.selectedMobId === mobId ? 0xffd36a : 0xf4f8ff, this.selectedMobId === mobId ? 0.95 : 0.18);
    });

    Array.from(this.mobMarkers.keys()).forEach((id) => {
      if (visibleMobIds.has(id)) return;
      const marker = this.mobMarkers.get(id);
      marker?.body.destroy(true);
      this.mobMarkers.delete(id);
      if (this.selectedMobId === id) {
        this.selectedMobId = null;
        this.services.store.update({ selectedMobId: null });
      }
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
        body.setInteractive(
          new Phaser.Geom.Rectangle(-15, -20, 30, 40),
          Phaser.Geom.Rectangle.Contains
        );
        body.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          pointer.event.stopPropagation();
          this.services.socket.send({ type: 'npc.interact', npcId });
        });
        this.entityLayer.add(body);
        marker = { body, badge, sprite: bodyFill };
        this.npcMarkers.set(npcId, marker);
      }

      marker.badge.setText(String(npc.name || 'NPC'));
      const projected = this.worldToScreen(Number(npc.x || 0), Number(npc.y || 0));
      marker.body.setPosition(projected.x, projected.y - 8);
      marker.body.setDepth(projected.y - 8);
    });

    Array.from(this.npcMarkers.keys()).forEach((id) => {
      if (visibleNpcIds.has(id)) return;
      const marker = this.npcMarkers.get(id);
      marker?.body.destroy(true);
      this.npcMarkers.delete(id);
    });

    groundItems.forEach((item: any) => {
      const itemId = String(item.id || '');
      if (!itemId) return;
      visibleGroundItemIds.add(itemId);
      let marker = this.groundItemMarkers.get(itemId);
      if (!marker) {
        const diamond = this.add.rectangle(0, 0, 16, 16, 0xd8b56f, 1).setAngle(45);
        const badge = this.add.text(0, -20, String(item.name || item.templateId || 'Item'), {
          fontFamily: 'Segoe UI',
          fontSize: '12px',
          color: '#fff5d8',
          backgroundColor: 'rgba(8,17,27,0.62)',
          padding: { x: 4, y: 2 }
        }).setOrigin(0.5);
        const body = this.add.container(0, 0, [diamond, badge]);
        body.setSize(24, 24);
        body.setInteractive(new Phaser.Geom.Rectangle(-12, -12, 24, 24), Phaser.Geom.Rectangle.Contains);
        body.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
          pointer.event.stopPropagation();
          this.services.socket.send({ type: 'pickup_item', itemId });
        });
        this.entityLayer.add(body);
        marker = { body, badge };
        this.groundItemMarkers.set(itemId, marker);
      }
      const projected = this.worldToScreen(Number(item.x || 0), Number(item.y || 0));
      marker.body.setPosition(projected.x, projected.y);
      marker.body.setDepth(projected.y);
      marker.badge.setText(String(item.name || item.templateId || 'Item'));
    });

    Array.from(this.groundItemMarkers.keys()).forEach((id) => {
      if (visibleGroundItemIds.has(id)) return;
      const marker = this.groundItemMarkers.get(id);
      marker?.body.destroy(true);
      this.groundItemMarkers.delete(id);
    });

    if (localPlayer) {
      const projected = this.worldToScreen(Number(localPlayer.x || 0), Number(localPlayer.y || 0));
      this.localPlayerAnchor.setPosition(projected.x, projected.y);
      this.localPlayerAnchor.setVisible(true);
    }

    this.entityLayer.list.sort((a, b) => Number((a as Phaser.GameObjects.Container).y || 0) - Number((b as Phaser.GameObjects.Container).y || 0));

    this.renderCombatFeedback(state.lastCombatEvent);
    this.renderQueuedCombatBursts(state.combatBursts);
    this.renderQueuedSkillEffects(state.skillEffects);
  }

  private worldToScreen(worldX: number, worldY: number) {
    const map = this.mapDocument;
    if (!map) return { x: 0, y: 0 };
    const tileSize = Math.max(1, Number(this.services.store.getState().resolvedWorld?.mapTiled?.worldTileSize || map.worldTileSize));
    const tileX = worldX / tileSize;
    const tileY = worldY / tileSize;
    const halfTileW = map.tileWidth / 2;
    const halfTileH = map.tileHeight / 2;
    const originX = this.projectedMapWidth / 2;
    const originY = map.tileHeight * 0.5;
    return {
      x: (tileX - tileY) * halfTileW + originX,
      y: (tileX + tileY) * halfTileH + originY
    };
  }

  private screenToWorld(screenX: number, screenY: number) {
    const map = this.mapDocument;
    const worldMeta = this.services.store.getState().resolvedWorld?.world;
    if (!map || !worldMeta) return null;
    const halfTileW = map.tileWidth / 2;
    const halfTileH = map.tileHeight / 2;
    const originX = this.projectedMapWidth / 2;
    const originY = map.tileHeight * 0.5;
    const localX = screenX - originX;
    const localY = screenY - originY;
    const tileX = (localX / halfTileW + localY / halfTileH) / 2;
    const tileY = (localY / halfTileH - localX / halfTileW) / 2;
    const tileSize = Math.max(1, Number(this.services.store.getState().resolvedWorld?.mapTiled?.worldTileSize || map.worldTileSize));
    return {
      x: Phaser.Math.Clamp(tileX * tileSize, 0, Number(worldMeta.width || 0)),
      y: Phaser.Math.Clamp(tileY * tileSize, 0, Number(worldMeta.height || 0))
    };
  }

  private handleResize(gameSize: Phaser.Structs.Size | { width: number; height: number }) {
    const width = Number(gameSize.width || 0);
    const height = Number(gameSize.height || 0);
    if (!width || !height) return;
    this.cameras.main.setSize(width, height);
    this.cameras.main.setBounds(0, 0, this.projectedMapWidth || width, (this.projectedMapHeight || height) + 400);
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
