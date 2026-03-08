"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MovementService = void 0;
const config_1 = require("../config");
const math_1 = require("../utils/math");
const PATHFIND_CELL_SIZE = 12;
const PATHFIND_MAX_ITERS = 45000;
const PATH_RECALC_MS = 280;
const PATH_PROBE_RADIUS = Math.max(8, config_1.PLAYER_HALF_SIZE - 6);
const PATH_STUCK_REPATH_MS = 520;
const PATH_STUCK_TIMEOUT_MS = 1200;
const PATH_NEARBY_GOAL_MAX_CANDIDATES = 72;
const PATH_NEARBY_GOAL_MAX_RADIUS = 42;
const ISO_AXIAL_RATIO = 2;
const PATH_PLAN_RADIUS = Math.max(6, PATH_PROBE_RADIUS - 4);
class MovementService {
    constructor(mapService, getActiveSkillEffectAggregate) {
        this.mapService = mapService;
        this.getActiveSkillEffectAggregate = getActiveSkillEffectAggregate;
    }
    handleMove(player, msg) {
        if (player.dead || player.hp <= 0)
            return;
        const incomingX = Number(msg.x);
        const incomingY = Number(msg.y);
        player.autoAttackActive = false;
        player.attackTargetId = null;
        player.pvpAutoAttackActive = false;
        player.attackTargetPlayerId = null;
        const destinationX = (0, math_1.clamp)(Number.isFinite(incomingX) ? incomingX : player.x, 0, config_1.WORLD.width);
        const destinationY = (0, math_1.clamp)(Number.isFinite(incomingY) ? incomingY : player.y, 0, config_1.WORLD.height);
        this.assignPathTo(player, destinationX, destinationY);
        player.ws.send(JSON.stringify({
            type: 'move_ack',
            reqId: msg.reqId,
            targetX: player.targetX,
            targetY: player.targetY,
            projectedX: player.pathDestinationX,
            projectedY: player.pathDestinationY,
            pathNodes: Array.isArray(player.movePath) ? player.movePath : [],
            pathNodesRaw: Array.isArray(player.rawMovePath) ? player.rawMovePath : []
        }));
    }
    movePlayerTowardTarget(player, deltaSeconds, now) {
        if (!Number.isFinite(Number(player.lastMoveProgressAt)))
            player.lastMoveProgressAt = now;
        if (!Number.isFinite(Number(player.lastMoveCheckX)))
            player.lastMoveCheckX = player.x;
        if (!Number.isFinite(Number(player.lastMoveCheckY)))
            player.lastMoveCheckY = player.y;
        const movedSinceCheck = Math.hypot(Number(player.x) - Number(player.lastMoveCheckX), Number(player.y) - Number(player.lastMoveCheckY));
        if (movedSinceCheck >= 1.2) {
            player.lastMoveCheckX = player.x;
            player.lastMoveCheckY = player.y;
            player.lastMoveProgressAt = now;
        }
        if (Array.isArray(player.movePath) && player.movePath.length > 0) {
            const next = player.movePath[0];
            if (next) {
                player.targetX = next.x;
                player.targetY = next.y;
            }
        }
        const rawMoveSpeed = Number(player.stats?.moveSpeed);
        const moveSpeedStat = Number.isFinite(rawMoveSpeed) && rawMoveSpeed > 0 ? rawMoveSpeed : 100;
        const fx = this.getActiveSkillEffectAggregate(player, now);
        const speed = config_1.BASE_MOVE_SPEED * (moveSpeedStat / 100) * Math.max(0.2, Number(fx.moveMul || 1));
        const dx = player.targetX - player.x;
        const dy = player.targetY - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= 2) {
            if (Array.isArray(player.movePath) && player.movePath.length > 0) {
                player.movePath.shift();
                const next = player.movePath[0];
                if (next) {
                    player.targetX = next.x;
                    player.targetY = next.y;
                }
                else {
                    player.targetX = player.x;
                    player.targetY = player.y;
                    player.pathDestinationX = player.x;
                    player.pathDestinationY = player.y;
                    player.rawMovePath = [];
                }
            }
            return;
        }
        const step = speed * deltaSeconds;
        const ux = dist > 0.0001 ? dx / dist : 0;
        const uy = dist > 0.0001 ? dy / dist : 0;
        const isoMul = this.getIsoMoveStepMultiplier(player.mapKey, ux, uy);
        const adjustedStep = step * isoMul;
        if (adjustedStep >= dist) {
            if (!this.mapService.isBlockedAt(player.mapKey, player.targetX, player.targetY)) {
                player.x = player.targetX;
                player.y = player.targetY;
            }
            if (Array.isArray(player.movePath) && player.movePath.length > 0) {
                player.movePath.shift();
                const next = player.movePath[0];
                if (next) {
                    player.targetX = next.x;
                    player.targetY = next.y;
                }
                else {
                    player.targetX = player.x;
                    player.targetY = player.y;
                    player.pathDestinationX = player.x;
                    player.pathDestinationY = player.y;
                    player.rawMovePath = [];
                }
            }
            return;
        }
        const nextX = player.x + (dx / dist) * adjustedStep;
        const nextY = player.y + (dy / dist) * adjustedStep;
        if (!this.mapService.isBlockedAt(player.mapKey, nextX, nextY)) {
            player.x = nextX;
            player.y = nextY;
            return;
        }
        const axisX = player.x + (dx / dist) * adjustedStep;
        if (!this.mapService.isBlockedAt(player.mapKey, axisX, player.y)) {
            player.x = axisX;
            return;
        }
        const axisY = player.y + (dy / dist) * adjustedStep;
        if (!this.mapService.isBlockedAt(player.mapKey, player.x, axisY)) {
            player.y = axisY;
            return;
        }
        const destinationX = Number.isFinite(Number(player.pathDestinationX)) ? Number(player.pathDestinationX) : player.targetX;
        const destinationY = Number.isFinite(Number(player.pathDestinationY)) ? Number(player.pathDestinationY) : player.targetY;
        const stuckForMs = now - Number(player.lastMoveProgressAt || now);
        if (stuckForMs >= PATH_STUCK_REPATH_MS) {
            this.recalculatePathToward(player, destinationX, destinationY, now);
        }
        if (stuckForMs >= PATH_STUCK_TIMEOUT_MS) {
            const fallback = this.mapService.projectToWalkable(player.mapKey, destinationX, destinationY);
            this.assignPathTo(player, fallback.x, fallback.y);
            player.lastMoveProgressAt = now;
            player.lastMoveCheckX = player.x;
            player.lastMoveCheckY = player.y;
        }
        if (!Array.isArray(player.movePath) || player.movePath.length === 0) {
            player.targetX = player.x;
            player.targetY = player.y;
            player.pathDestinationX = player.x;
            player.pathDestinationY = player.y;
            player.rawMovePath = [];
        }
    }
    assignPathTo(player, destinationX, destinationY) {
        const projected = this.mapService.projectToWalkable(player.mapKey, destinationX, destinationY);
        player.pathDestinationX = projected.x;
        player.pathDestinationY = projected.y;
        const rawPath = this.findPathWithNearbyGoals(player.mapKey, player.x, player.y, projected.x, projected.y);
        player.rawMovePath = rawPath;
        player.movePath = this.smoothWorldPath(player.mapKey, player.x, player.y, rawPath);
        if (player.movePath.length > 0) {
            player.targetX = player.movePath[0].x;
            player.targetY = player.movePath[0].y;
            return;
        }
        if (!this.isPathSegmentBlocked(player.mapKey, player.x, player.y, projected.x, projected.y)) {
            player.targetX = projected.x;
            player.targetY = projected.y;
            return;
        }
        player.rawMovePath = [];
        player.targetX = player.x;
        player.targetY = player.y;
    }
    recalculatePathToward(player, destinationX, destinationY, now) {
        if (now < Number(player.nextPathfindAt || 0))
            return;
        player.nextPathfindAt = now + PATH_RECALC_MS;
        this.assignPathTo(player, destinationX, destinationY);
    }
    getIsoMoveStepMultiplier(mapKey, ux, uy) {
        if (!this.mapService.getMapTiledCollisionSampler(mapKey))
            return 1;
        const a = ISO_AXIAL_RATIO;
        const b = 1;
        const proj = Math.hypot(a * (ux - uy), b * (ux + uy));
        const card = Math.hypot(a, b);
        if (!Number.isFinite(proj) || proj <= 0.0001)
            return 1;
        return (0, math_1.clamp)(card / proj, 0.78, 1.62);
    }
    findPathWithNearbyGoals(mapKey, fromX, fromY, toX, toY) {
        const direct = this.findPath(mapKey, fromX, fromY, toX, toY);
        if (direct.length > 0)
            return direct;
        const goal = this.worldToPathCell(toX, toY);
        let candidatesChecked = 0;
        const maxCandidates = PATH_NEARBY_GOAL_MAX_CANDIDATES;
        const maxRadius = PATH_NEARBY_GOAL_MAX_RADIUS;
        for (let r = 1; r <= maxRadius && candidatesChecked < maxCandidates; r++) {
            for (let dx = -r; dx <= r && candidatesChecked < maxCandidates; dx++) {
                const checks = [
                    { cx: goal.cx + dx, cy: goal.cy - r },
                    { cx: goal.cx + dx, cy: goal.cy + r }
                ];
                for (const cell of checks) {
                    candidatesChecked += 1;
                    if (!this.isPathCellWalkable(mapKey, cell.cx, cell.cy))
                        continue;
                    const world = this.pathCellToWorld(cell.cx, cell.cy);
                    const candidate = this.findPath(mapKey, fromX, fromY, world.x, world.y);
                    if (candidate.length > 0)
                        return candidate;
                    if (candidatesChecked >= maxCandidates)
                        break;
                }
            }
            for (let dy = -r + 1; dy <= r - 1 && candidatesChecked < maxCandidates; dy++) {
                const checks = [
                    { cx: goal.cx - r, cy: goal.cy + dy },
                    { cx: goal.cx + r, cy: goal.cy + dy }
                ];
                for (const cell of checks) {
                    candidatesChecked += 1;
                    if (!this.isPathCellWalkable(mapKey, cell.cx, cell.cy))
                        continue;
                    const world = this.pathCellToWorld(cell.cx, cell.cy);
                    const candidate = this.findPath(mapKey, fromX, fromY, world.x, world.y);
                    if (candidate.length > 0)
                        return candidate;
                    if (candidatesChecked >= maxCandidates)
                        break;
                }
            }
        }
        return [];
    }
    smoothWorldPath(mapKey, startX, startY, points) {
        if (!Array.isArray(points) || points.length <= 2)
            return Array.isArray(points) ? points : [];
        const path = points
            .map((pt) => ({ x: Number(pt?.x), y: Number(pt?.y) }))
            .filter((pt) => Number.isFinite(pt.x) && Number.isFinite(pt.y));
        if (path.length <= 2)
            return path;
        const smoothed = [];
        let anchor = { x: Number(startX), y: Number(startY) };
        let index = 0;
        while (index < path.length) {
            let best = index;
            for (let probe = path.length - 1; probe >= index; probe--) {
                const node = path[probe];
                if (!this.isPathSegmentBlocked(mapKey, anchor.x, anchor.y, node.x, node.y)) {
                    best = probe;
                    break;
                }
            }
            const picked = path[best];
            smoothed.push(picked);
            anchor = picked;
            index = best + 1;
        }
        return smoothed;
    }
    worldToPathCell(x, y) {
        const maxCellX = Math.floor(config_1.WORLD.width / PATHFIND_CELL_SIZE);
        const maxCellY = Math.floor(config_1.WORLD.height / PATHFIND_CELL_SIZE);
        return {
            cx: (0, math_1.clamp)(Math.floor((0, math_1.clamp)(x, 0, config_1.WORLD.width) / PATHFIND_CELL_SIZE), 0, maxCellX),
            cy: (0, math_1.clamp)(Math.floor((0, math_1.clamp)(y, 0, config_1.WORLD.height) / PATHFIND_CELL_SIZE), 0, maxCellY)
        };
    }
    pathCellToWorld(cx, cy) {
        return {
            x: (0, math_1.clamp)(cx * PATHFIND_CELL_SIZE + PATHFIND_CELL_SIZE / 2, 0, config_1.WORLD.width),
            y: (0, math_1.clamp)(cy * PATHFIND_CELL_SIZE + PATHFIND_CELL_SIZE / 2, 0, config_1.WORLD.height)
        };
    }
    isPathCellWalkable(mapKey, cx, cy) {
        const maxCellX = Math.floor(config_1.WORLD.width / PATHFIND_CELL_SIZE);
        const maxCellY = Math.floor(config_1.WORLD.height / PATHFIND_CELL_SIZE);
        if (cx < 0 || cy < 0 || cx > maxCellX || cy > maxCellY)
            return false;
        const world = this.pathCellToWorld(cx, cy);
        const offset = Math.max(2, PATH_PLAN_RADIUS * 0.55);
        const probes = [
            { x: world.x, y: world.y },
            { x: world.x + offset, y: world.y },
            { x: world.x - offset, y: world.y },
            { x: world.x, y: world.y + offset },
            { x: world.x, y: world.y - offset },
            { x: world.x + offset, y: world.y + offset },
            { x: world.x - offset, y: world.y + offset },
            { x: world.x + offset, y: world.y - offset },
            { x: world.x - offset, y: world.y - offset }
        ];
        for (const probe of probes) {
            if (this.isPathBlockedAt(mapKey, probe.x, probe.y, PATH_PLAN_RADIUS))
                return false;
        }
        return true;
    }
    findPath(mapKey, fromX, fromY, toX, toY) {
        const startRaw = this.worldToPathCell(fromX, fromY);
        const goalRaw = this.worldToPathCell(toX, toY);
        const start = this.findNearestWalkableCell(mapKey, startRaw.cx, startRaw.cy, 20) || startRaw;
        const goal = this.findNearestWalkableCell(mapKey, goalRaw.cx, goalRaw.cy, 72) || goalRaw;
        const sameCell = start.cx === goal.cx && start.cy === goal.cy;
        if (sameCell)
            return [{ x: (0, math_1.clamp)(toX, 0, config_1.WORLD.width), y: (0, math_1.clamp)(toY, 0, config_1.WORLD.height) }];
        const walkableMemo = new Map();
        const isWalkable = (cx, cy) => {
            const key = `${cx},${cy}`;
            if (walkableMemo.has(key))
                return Boolean(walkableMemo.get(key));
            const ok = this.isPathCellWalkable(mapKey, cx, cy);
            walkableMemo.set(key, ok);
            return ok;
        };
        const startKey = `${start.cx},${start.cy}`;
        const goalKey = `${goal.cx},${goal.cy}`;
        const open = new Set([startKey]);
        const closed = new Set();
        const g = new Map([[startKey, 0]]);
        const f = new Map();
        const cameFrom = new Map();
        f.set(startKey, this.pathHeuristic(start.cx, start.cy, goal.cx, goal.cy));
        const dirs = [
            { x: 1, y: 0, c: 1 },
            { x: -1, y: 0, c: 1 },
            { x: 0, y: 1, c: 1 },
            { x: 0, y: -1, c: 1 },
            { x: 1, y: 1, c: 1.4142 },
            { x: 1, y: -1, c: 1.4142 },
            { x: -1, y: 1, c: 1.4142 },
            { x: -1, y: -1, c: 1.4142 }
        ];
        let iter = 0;
        while (open.size > 0 && iter < PATHFIND_MAX_ITERS) {
            iter += 1;
            let current = '';
            let bestF = Number.POSITIVE_INFINITY;
            for (const node of open) {
                const score = Number(f.get(node) ?? Number.POSITIVE_INFINITY);
                if (score < bestF) {
                    bestF = score;
                    current = node;
                }
            }
            if (!current)
                break;
            if (current === goalKey) {
                return this.rebuildPath(cameFrom, current, toX, toY);
            }
            open.delete(current);
            closed.add(current);
            const [cxRaw, cyRaw] = current.split(',');
            const cx = Number(cxRaw);
            const cy = Number(cyRaw);
            for (const dir of dirs) {
                const nx = cx + dir.x;
                const ny = cy + dir.y;
                const nkey = `${nx},${ny}`;
                if (closed.has(nkey))
                    continue;
                if (!isWalkable(nx, ny))
                    continue;
                if (dir.x !== 0 && dir.y !== 0) {
                    const from = this.pathCellToWorld(cx, cy);
                    const to = this.pathCellToWorld(nx, ny);
                    if (this.isPathSegmentBlocked(mapKey, from.x, from.y, to.x, to.y))
                        continue;
                }
                const tentative = Number(g.get(current) ?? Number.POSITIVE_INFINITY) + dir.c;
                if (!open.has(nkey))
                    open.add(nkey);
                else if (tentative >= Number(g.get(nkey) ?? Number.POSITIVE_INFINITY))
                    continue;
                cameFrom.set(nkey, current);
                g.set(nkey, tentative);
                f.set(nkey, tentative + this.pathHeuristic(nx, ny, goal.cx, goal.cy));
            }
        }
        return [];
    }
    isPathBlockedAt(mapKey, x, y, radiusOverride) {
        const px = (0, math_1.clamp)(x, 0, config_1.WORLD.width);
        const py = (0, math_1.clamp)(y, 0, config_1.WORLD.height);
        const radius = Number.isFinite(Number(radiusOverride)) ? Number(radiusOverride) : PATH_PROBE_RADIUS;
        const tiledSampler = this.mapService.getMapTiledCollisionSampler(mapKey);
        if (tiledSampler)
            return tiledSampler.isBlockedAt(px, py, radius);
        const features = config_1.MAP_FEATURES_BY_KEY[mapKey] || [];
        for (const feature of features) {
            if (!feature.collision)
                continue;
            if (feature.shape === 'rect') {
                const insideX = px >= (feature.x - radius) && px <= (feature.x + feature.w + radius);
                const insideY = py >= (feature.y - radius) && py <= (feature.y + feature.h + radius);
                if (insideX && insideY)
                    return true;
                continue;
            }
            const dx = px - feature.x;
            const dy = py - feature.y;
            if (dx * dx + dy * dy <= (feature.r + radius) * (feature.r + radius))
                return true;
        }
        return false;
    }
    isPathSegmentBlocked(mapKey, x1, y1, x2, y2) {
        const dx = x2 - x1;
        const dy = y2 - y1;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len <= 0.01)
            return false;
        const step = Math.max(6, PATHFIND_CELL_SIZE * 0.5);
        const steps = Math.max(1, Math.ceil(len / step));
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const x = x1 + dx * t;
            const y = y1 + dy * t;
            if (this.isPathBlockedAt(mapKey, x, y))
                return true;
        }
        return false;
    }
    findNearestWalkableCell(mapKey, cx, cy, maxRadius) {
        if (this.isPathCellWalkable(mapKey, cx, cy))
            return { cx, cy };
        for (let r = 1; r <= maxRadius; r++) {
            for (let dx = -r; dx <= r; dx++) {
                const top = { cx: cx + dx, cy: cy - r };
                const bottom = { cx: cx + dx, cy: cy + r };
                if (this.isPathCellWalkable(mapKey, top.cx, top.cy))
                    return top;
                if (this.isPathCellWalkable(mapKey, bottom.cx, bottom.cy))
                    return bottom;
            }
            for (let dy = -r + 1; dy <= r - 1; dy++) {
                const left = { cx: cx - r, cy: cy + dy };
                const right = { cx: cx + r, cy: cy + dy };
                if (this.isPathCellWalkable(mapKey, left.cx, left.cy))
                    return left;
                if (this.isPathCellWalkable(mapKey, right.cx, right.cy))
                    return right;
            }
        }
        return null;
    }
    pathHeuristic(ax, ay, bx, by) {
        const dx = Math.abs(ax - bx);
        const dy = Math.abs(ay - by);
        const diag = Math.min(dx, dy);
        const straight = dx + dy - diag * 2;
        return diag * 1.4142 + straight;
    }
    rebuildPath(cameFrom, current, toX, toY) {
        const reversed = [current];
        while (cameFrom.has(current)) {
            current = String(cameFrom.get(current));
            reversed.push(current);
        }
        reversed.reverse();
        const path = reversed
            .slice(1)
            .map((key) => {
            const [cxRaw, cyRaw] = key.split(',');
            const cx = Number(cxRaw);
            const cy = Number(cyRaw);
            return this.pathCellToWorld(cx, cy);
        });
        path.push({ x: (0, math_1.clamp)(toX, 0, config_1.WORLD.width), y: (0, math_1.clamp)(toY, 0, config_1.WORLD.height) });
        return path;
    }
}
exports.MovementService = MovementService;
//# sourceMappingURL=MovementService.js.map