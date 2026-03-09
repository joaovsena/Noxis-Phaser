import { DungeonTemplate } from '../content/dungeons';
import { MapFeature } from '../config';

type DungeonLayout = {
    mapKey: string;
    entrySpawn: { x: number; y: number };
    features: MapFeature[];
    mobSpawns: Array<{ id: string; kind: 'normal' | 'elite' | 'subboss' | 'boss'; x: number; y: number; hpMultiplier?: number; level?: number }>;
    doorFeature: MapFeature;
    bossAggroRange: number;
};

function hashSeed(input: string) {
    let h = 2166136261;
    const s = String(input || 'seed');
    for (let i = 0; i < s.length; i++) {
        h ^= s.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return (h >>> 0) || 1;
}

function rngFactory(seedInput: string) {
    let state = hashSeed(seedInput);
    return () => {
        state ^= state << 13;
        state ^= state >>> 17;
        state ^= state << 5;
        const v = state >>> 0;
        return v / 0xffffffff;
    };
}

export function generateDungeonLayout(instanceId: string, template: DungeonTemplate): DungeonLayout {
    const rand = rngFactory(`${template.id}:${instanceId}`);
    const wall = 32;
    const baseX = 420 + Math.floor(rand() * 240);
    const baseY = 440 + Math.floor(rand() * 180);
    const width = 2100;
    const height = 1260;
    const yGapA = baseY + 220 + Math.floor(rand() * 180);
    const yGapB = baseY + 640 + Math.floor(rand() * 180);
    const yDoor = baseY + 540 + Math.floor(rand() * 120);

    const xWall1 = baseX + 520;
    const xWall2 = baseX + 1060;
    const xWall3 = baseX + 1570;
    const gapSize = 160;

    const features: MapFeature[] = [
        { id: `${instanceId}-outer-top`, kind: 'building', shape: 'rect', x: baseX, y: baseY - wall, w: width, h: wall, collision: true },
        { id: `${instanceId}-outer-bottom`, kind: 'building', shape: 'rect', x: baseX, y: baseY + height, w: width, h: wall, collision: true },
        { id: `${instanceId}-outer-left`, kind: 'building', shape: 'rect', x: baseX - wall, y: baseY - wall, w: wall, h: height + wall * 2, collision: true },
        { id: `${instanceId}-outer-right`, kind: 'building', shape: 'rect', x: baseX + width, y: baseY - wall, w: wall, h: height + wall * 2, collision: true },

        { id: `${instanceId}-v1-top`, kind: 'ruins', shape: 'rect', x: xWall1, y: baseY, w: wall, h: Math.max(40, yGapA - baseY - gapSize / 2), collision: true },
        { id: `${instanceId}-v1-bottom`, kind: 'ruins', shape: 'rect', x: xWall1, y: yGapA + gapSize / 2, w: wall, h: Math.max(40, baseY + height - (yGapA + gapSize / 2)), collision: true },

        { id: `${instanceId}-v2-top`, kind: 'ruins', shape: 'rect', x: xWall2, y: baseY, w: wall, h: Math.max(40, yGapB - baseY - gapSize / 2), collision: true },
        { id: `${instanceId}-v2-bottom`, kind: 'ruins', shape: 'rect', x: xWall2, y: yGapB + gapSize / 2, w: wall, h: Math.max(40, baseY + height - (yGapB + gapSize / 2)), collision: true },

        // Parede da sala do boss com porta central dinamica.
        { id: `${instanceId}-v3-top`, kind: 'ruins', shape: 'rect', x: xWall3, y: baseY, w: wall, h: Math.max(40, yDoor - baseY - gapSize / 2), collision: true },
        { id: `${instanceId}-v3-bottom`, kind: 'ruins', shape: 'rect', x: xWall3, y: yDoor + gapSize / 2, w: wall, h: Math.max(40, baseY + height - (yDoor + gapSize / 2)), collision: true },

        // Obstaculos leves para forcar corredores.
        { id: `${instanceId}-h1`, kind: 'mountain', shape: 'rect', x: baseX + 180, y: baseY + 540, w: 260, h: 90, collision: true },
        { id: `${instanceId}-h2`, kind: 'mountain', shape: 'rect', x: baseX + 740, y: baseY + 320, w: 320, h: 90, collision: true },
        { id: `${instanceId}-h3`, kind: 'mountain', shape: 'rect', x: baseX + 1210, y: baseY + 820, w: 320, h: 90, collision: true },
        { id: `${instanceId}-h4`, kind: 'mountain', shape: 'rect', x: baseX + 1710, y: baseY + 460, w: 300, h: 90, collision: true }
    ];

    const mobSpawns: DungeonLayout['mobSpawns'] = [];
    let mobSeq = 1;
    const pushPack = (
        cx: number,
        cy: number,
        normalCount: number,
        eliteCount: number,
        radius: number
    ) => {
        for (let i = 0; i < normalCount; i++) {
            const angle = rand() * Math.PI * 2;
            const r = 20 + rand() * radius;
            mobSpawns.push({
                id: `mob_n_${mobSeq++}`,
                kind: 'normal',
                x: cx + Math.cos(angle) * r,
                y: cy + Math.sin(angle) * r
            });
        }
        for (let i = 0; i < eliteCount; i++) {
            const angle = rand() * Math.PI * 2;
            const r = 16 + rand() * (radius * 0.7);
            mobSpawns.push({
                id: `mob_e_${mobSeq++}`,
                kind: 'elite',
                x: cx + Math.cos(angle) * r,
                y: cy + Math.sin(angle) * r,
                hpMultiplier: 1.12 + rand() * 0.16
            });
        }
    };

    // Sala inicial: packs densos, mas com espaco de manobra.
    pushPack(baseX + 240, baseY + 220, 3, 1, 120);
    pushPack(baseX + 260, baseY + 560, 4, 1, 140);
    pushPack(baseX + 260, baseY + 940, 3, 1, 120);

    // Corredor/sala intermediaria.
    pushPack(baseX + 760, baseY + 220, 3, 1, 120);
    pushPack(baseX + 920, baseY + 600, 5, 1, 160);
    pushPack(baseX + 920, baseY + 980, 3, 1, 120);

    // Ala final antes do boss.
    pushPack(baseX + 1280, baseY + 260, 3, 1, 120);
    pushPack(baseX + 1410, baseY + 640, 5, 2, 170);
    pushPack(baseX + 1380, baseY + 980, 3, 1, 120);

    // Subbosses para marcar progressao.
    mobSpawns.push(
        { id: `mob_s_${mobSeq++}`, kind: 'subboss', x: baseX + 860, y: baseY + 640, hpMultiplier: 1.15 },
        { id: `mob_s_${mobSeq++}`, kind: 'subboss', x: baseX + 1460, y: baseY + 860, hpMultiplier: 1.18 }
    );

    // Boss final.
    mobSpawns.push({
        id: 'boss_final',
        kind: 'boss',
        x: baseX + 1860,
        y: baseY + 640,
        hpMultiplier: 0.9,
        level: 7
    });

    const doorFeature: MapFeature = {
        id: `${instanceId}-boss-door`,
        kind: 'building',
        shape: 'rect',
        x: xWall3,
        y: yDoor - gapSize / 2,
        w: wall,
        h: gapSize,
        collision: true
    };

    return {
        mapKey: `dng_${instanceId}`,
        entrySpawn: { x: baseX + 120, y: baseY + 640 },
        features,
        mobSpawns,
        doorFeature,
        bossAggroRange: 290
    };
}
