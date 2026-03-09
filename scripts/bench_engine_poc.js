/* eslint-disable no-console */
const { performance } = require('node:perf_hooks');

const ENGINE_URL = process.env.ENGINE_URL || 'http://localhost:8088';
const COMBAT_CASES = Number(process.env.BENCH_COMBAT_CASES || 300000);
const PATH_CASES = Number(process.env.BENCH_PATH_CASES || 1200);
const GO_BATCH_SIZE = Number(process.env.BENCH_GO_BATCH_SIZE || 2000);
const GO_CONCURRENCY = Number(process.env.BENCH_GO_CONCURRENCY || 8);

function mulberry32(seed) {
    let t = seed >>> 0;
    return function rand() {
        t += 0x6d2b79f5;
        let r = Math.imul(t ^ (t >>> 15), 1 | t);
        r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
        return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
}

function computeDamageAfterMitigation(rawDamage, defense, targetLevel) {
    const safeRaw = Math.max(1, Number(rawDamage || 1));
    const safeDefense = Math.max(0, Number(defense || 0));
    const safeLevel = Math.max(1, Number(targetLevel || 1));
    const k = 400 + safeLevel * 50;
    const reduction = safeDefense / (safeDefense + k);
    return Math.max(1, Math.floor(safeRaw * (1 - reduction)));
}

function generateCombatCases(count) {
    const rand = mulberry32(0xC0FFEE);
    const out = [];
    for (let i = 0; i < count; i++) {
        out.push({
            rawDamage: 8 + (rand() * 180),
            defense: rand() * 240,
            targetLevel: 1 + Math.floor(rand() * 99)
        });
    }
    return out;
}

function manhattan(ax, ay, bx, by) {
    return Math.abs(ax - bx) + Math.abs(ay - by);
}

function shortestPathLenJS(c) {
    const w = c.gridW;
    const h = c.gridH;
    if (w <= 0 || h <= 0) return -1;
    const area = w * h;
    const start = c.startY * w + c.startX;
    const target = c.targetY * w + c.targetX;
    if (start < 0 || start >= area || target < 0 || target >= area) return -1;

    const blocked = new Uint8Array(area);
    for (const idx of c.blocked) if (idx >= 0 && idx < area) blocked[idx] = 1;
    if (blocked[start] || blocked[target]) return -1;
    if (start === target) return 0;

    const inf = Number.MAX_SAFE_INTEGER;
    const gScore = new Int32Array(area);
    gScore.fill(0x3fffffff);
    gScore[start] = 0;

    const inOpen = new Uint8Array(area);
    const open = [{ idx: start, g: 0, f: manhattan(c.startX, c.startY, c.targetX, c.targetY) }];
    inOpen[start] = 1;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];

    while (open.length > 0) {
        let best = 0;
        for (let i = 1; i < open.length; i++) if (open[i].f < open[best].f) best = i;
        const current = open[best];
        open[best] = open[open.length - 1];
        open.pop();
        inOpen[current.idx] = 0;
        if (current.idx === target) return current.g;

        const cx = current.idx % w;
        const cy = Math.floor(current.idx / w);
        for (const [dx, dy] of dirs) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const ni = ny * w + nx;
            if (blocked[ni]) continue;
            const tentativeG = current.g + 1;
            if (tentativeG >= gScore[ni]) continue;
            gScore[ni] = tentativeG;
            const nf = tentativeG + manhattan(nx, ny, c.targetX, c.targetY);
            if (!inOpen[ni]) {
                open.push({ idx: ni, g: tentativeG, f: nf });
                inOpen[ni] = 1;
            } else {
                for (const node of open) {
                    if (node.idx === ni) {
                        node.g = tentativeG;
                        node.f = nf;
                        break;
                    }
                }
            }
        }
    }
    return -1;
}

function generatePathCases(count) {
    const rand = mulberry32(0xBADC0DE);
    const out = [];
    const gridW = 64;
    const gridH = 64;
    const area = gridW * gridH;
    for (let i = 0; i < count; i++) {
        const blocked = [];
        for (let j = 0; j < area; j++) {
            if (rand() < 0.16) blocked.push(j);
        }
        const startX = Math.floor(rand() * gridW);
        const startY = Math.floor(rand() * gridH);
        const targetX = Math.floor(rand() * gridW);
        const targetY = Math.floor(rand() * gridH);
        out.push({ gridW, gridH, blocked, startX, startY, targetX, targetY });
    }
    return out;
}

async function waitEngineHealth(timeoutMs = 15000) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            const res = await fetch(`${ENGINE_URL}/health`);
            if (res.ok) return;
        } catch {
            // retry
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`engine-go indisponivel em ${ENGINE_URL}`);
}

async function postJSON(path, payload) {
    const res = await fetch(`${ENGINE_URL}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} em ${path}`);
    return res.json();
}

function chunkArray(input, size) {
    const out = [];
    for (let i = 0; i < input.length; i += size) out.push(input.slice(i, i + size));
    return out;
}

async function runGoBatches(path, key, cases) {
    const chunks = chunkArray(cases, GO_BATCH_SIZE);
    let cursor = 0;
    let checksum = 0;
    const t0 = performance.now();

    async function worker() {
        while (true) {
            const idx = cursor;
            cursor += 1;
            if (idx >= chunks.length) return;
            const payload = { cases: chunks[idx] };
            const data = await postJSON(path, payload);
            checksum += Number(data.checksum || 0);
            if (!Array.isArray(data[key])) throw new Error(`resposta invalida em ${path}`);
        }
    }

    const workers = Array.from({ length: GO_CONCURRENCY }, () => worker());
    await Promise.all(workers);
    const t1 = performance.now();
    return { ms: t1 - t0, checksum };
}

function fmtMs(ms) {
    return `${ms.toFixed(2)} ms`;
}

function fmtOpsPerSec(total, ms) {
    return Math.round((total / ms) * 1000);
}

async function main() {
    console.log('=== Noxis Go Engine POC Benchmark ===');
    console.log(`ENGINE_URL=${ENGINE_URL}`);
    console.log(`COMBAT_CASES=${COMBAT_CASES} PATH_CASES=${PATH_CASES}`);
    console.log(`GO_BATCH_SIZE=${GO_BATCH_SIZE} GO_CONCURRENCY=${GO_CONCURRENCY}`);

    await waitEngineHealth();
    console.log('engine-go online.\n');

    const combatCases = generateCombatCases(COMBAT_CASES);
    const pathCases = generatePathCases(PATH_CASES);

    const combatJsStart = performance.now();
    let combatJsChecksum = 0;
    for (const c of combatCases) combatJsChecksum += computeDamageAfterMitigation(c.rawDamage, c.defense, c.targetLevel);
    const combatJsEnd = performance.now();
    const combatJsMs = combatJsEnd - combatJsStart;

    const combatGo = await runGoBatches('/v1/combat/batch', 'damages', combatCases);
    const combatSpeedup = combatJsMs / combatGo.ms;

    const pathJsStart = performance.now();
    let pathJsChecksum = 0;
    for (const c of pathCases) pathJsChecksum += shortestPathLenJS(c);
    const pathJsEnd = performance.now();
    const pathJsMs = pathJsEnd - pathJsStart;

    const pathGo = await runGoBatches('/v1/path/batch', 'pathLengths', pathCases);
    const pathSpeedup = pathJsMs / pathGo.ms;

    console.log('--- Combat (damage mitigation) ---');
    console.log(`JS local: ${fmtMs(combatJsMs)} | ${fmtOpsPerSec(COMBAT_CASES, combatJsMs)} ops/s | checksum=${combatJsChecksum}`);
    console.log(`Go engine: ${fmtMs(combatGo.ms)} | ${fmtOpsPerSec(COMBAT_CASES, combatGo.ms)} ops/s | checksum=${combatGo.checksum}`);
    console.log(`Speedup Go/JS: ${combatSpeedup.toFixed(2)}x\n`);

    console.log('--- Pathfinding (A* 64x64) ---');
    console.log(`JS local: ${fmtMs(pathJsMs)} | ${fmtOpsPerSec(PATH_CASES, pathJsMs)} paths/s | checksum=${pathJsChecksum}`);
    console.log(`Go engine: ${fmtMs(pathGo.ms)} | ${fmtOpsPerSec(PATH_CASES, pathGo.ms)} paths/s | checksum=${pathGo.checksum}`);
    console.log(`Speedup Go/JS: ${pathSpeedup.toFixed(2)}x\n`);

    console.log('Nota: benchmark inclui overhead HTTP no caminho Go.');
    console.log('Para medir no seu Debian 13 (4 vCPU/4GB), rode os comandos do doc em docs/poc-go-engine.md.');
}

main().catch((err) => {
    console.error(err?.stack || err);
    process.exitCode = 1;
});
