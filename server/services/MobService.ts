import { MobTemplate } from '@prisma/client';
import { Mob, GroundItem } from '../models/types';
import { DEFAULT_MOB, MOB_VARIANTS, WORLD, MAP_FEATURES_BY_KEY } from '../config';
import { randomUUID } from 'crypto';

export class MobService {
    private mobs: Mob[] = [];
    private mobIdCounter = 0;

    createMob(kind: string = 'normal', mapId: string): Mob {
        const variant = (MOB_VARIANTS as any)[kind] || MOB_VARIANTS.normal;
        const padding = 80;
        const spawn = this.findValidSpawnPoint(mapId, padding);
        return {
            id: `mob-${randomUUID()}`,
            x: spawn.x,
            y: spawn.y,
            kind,
            color: variant.color,
            size: variant.size,
            hp: Math.floor(DEFAULT_MOB.maxHp * variant.mult),
            maxHp: Math.floor(DEFAULT_MOB.maxHp * variant.mult),
            physicalDefense: Math.floor(DEFAULT_MOB.physicalDefense * variant.mult),
            magicDefense: Math.floor(DEFAULT_MOB.magicDefense * variant.mult),
            xpReward: Math.floor(DEFAULT_MOB.xpReward * variant.mult),
            mapId
        };
    }

    private findValidSpawnPoint(mapInstanceId: string, padding: number) {
        const fallback = {
            x: padding + Math.random() * (WORLD.width - padding * 2),
            y: padding + Math.random() * (WORLD.height - padding * 2)
        };
        const mapKey = String(mapInstanceId || '').split('::')[0] || 'forest';
        const features = MAP_FEATURES_BY_KEY[mapKey] || [];
        const radius = 24;

        const isBlocked = (x: number, y: number) => {
            for (const feature of features) {
                if (!feature.collision) continue;
                if (feature.shape === 'rect') {
                    const insideX = x >= (feature.x - radius) && x <= (feature.x + feature.w + radius);
                    const insideY = y >= (feature.y - radius) && y <= (feature.y + feature.h + radius);
                    if (insideX && insideY) return true;
                    continue;
                }
                const dx = x - feature.x;
                const dy = y - feature.y;
                if (dx * dx + dy * dy <= (feature.r + radius) * (feature.r + radius)) return true;
            }
            return false;
        };

        for (let i = 0; i < 120; i++) {
            const x = padding + Math.random() * (WORLD.width - padding * 2);
            const y = padding + Math.random() * (WORLD.height - padding * 2);
            if (!isBlocked(x, y)) return { x, y };
        }
        return fallback;
    }

    spawnMob(kind: string = 'normal', mapId: string): void {
        const quota = { normal: 25, elite: 15, subboss: 5, boss: 1 }[kind] || 0;
        const current = this.mobs.filter(m => m.kind === kind && m.mapId === mapId).length;
        if (current >= quota) return;
        this.mobs.push(this.createMob(kind, mapId));
    }

    removeMob(mobId: string): void {
        const index = this.mobs.findIndex(m => m.id === mobId);
        if (index === -1) return;
        const kind = this.mobs[index].kind;
        const mapId = this.mobs[index].mapId;
        this.mobs.splice(index, 1);
        setTimeout(() => this.spawnMob(kind, mapId), 10000);
    }

    getMobs(): Mob[] {
        return this.mobs;
    }

    getMobsByMap(mapId: string): Mob[] {
        return this.mobs.filter(m => m.mapId === mapId);
    }
}
