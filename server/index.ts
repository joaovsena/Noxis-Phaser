import express from 'express';
import { createServer } from 'http';
import { performance } from 'perf_hooks';
import fs from 'fs';
import path from 'path';
import { WebSocket, WebSocketServer } from 'ws';
import { GameController } from './controllers/GameController';
import { PersistenceService } from './services/PersistenceService';
import { MobService } from './services/MobService';
import { WSHandler } from './controllers/WSHandler';
import { logEvent } from './utils/logger';
import { TICK_MS, MAP_IDS, MAP_KEYS, composeMapInstanceId } from './config';
import prisma from './utils/prisma';
import { createRedisClient } from './utils/redis';
import { DistributedLockService } from './services/DistributedLockService';
import { perfStats } from './utils/perfStats';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = String(process.env.HOST || '0.0.0.0');
const publicDir = path.resolve(process.cwd(), 'public');
const clientDistDir = path.resolve(process.cwd(), 'client', 'dist');
const clientIndexPath = path.resolve(clientDistDir, 'index.html');
const parsedWorldStateMs = Number(process.env.WORLD_STATE_MS);
const WORLD_STATE_MS = Number.isFinite(parsedWorldStateMs)
    ? Math.max(20, Math.min(250, Math.floor(parsedWorldStateMs)))
    : 25;
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => {
    res.type('application/json').send('{}');
});
app.get('/healthz', async (_req, res) => {
    try {
        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ ok: true });
    } catch (error) {
        console.error('healthcheck_error', error);
        res.status(503).json({ ok: false });
    }
});
app.get('/debug/perf', (_req, res) => {
    res.status(200).json(perfStats.snapshot());
});
app.post('/debug/perf/reset', (_req, res) => {
    perfStats.reset();
    res.status(200).json({ ok: true });
});
app.use(express.static(publicDir, { index: false }));
if (fs.existsSync(clientDistDir)) {
    app.use(express.static(clientDistDir, { index: false }));
}
app.get(/.*/, (req, res, next) => {
    if (req.path.startsWith('/healthz') || req.path.startsWith('/debug/')) {
        next();
        return;
    }
    if (!fs.existsSync(clientIndexPath)) {
        next();
        return;
    }
    res.sendFile(clientIndexPath);
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

interface ExtendedWebSocket extends WebSocket {
    playerId?: number | null;
    lastStaticInstanceKey?: string | null;
}

async function initializeServer() {
    try {
        await prisma.$connect();
        const redis = await createRedisClient();
        const lockService = new DistributedLockService(redis);

        const persistence = new PersistenceService();
        const mobService = new MobService();
        const gameController = new GameController(persistence, mobService, lockService);
        const wsHandler = new WSHandler(gameController);
        try {
            const mobTemplates = await persistence.getMobTemplates();
            mobService.loadTemplateCache(mobTemplates);
        } catch (error) {
            console.error('mob_template_bootstrap_error', error);
            logEvent('ERROR', 'mob_template_bootstrap_error', { error: String(error) });
            mobService.loadTemplateCache([]);
        }
        for (const mapKey of MAP_KEYS) {
            for (const mapId of MAP_IDS) {
                const mapInstanceId = composeMapInstanceId(mapKey, mapId);
                mobService.seedMapInstance(mapInstanceId);
            }
        }

        wss.on('connection', (ws: WebSocket) => {
            const extWs = ws as ExtendedWebSocket;
            extWs.playerId = null;
            extWs.lastStaticInstanceKey = null;
            logEvent('INFO', 'ws_connected', {});

            extWs.on('message', (raw: Buffer) => {
                try {
                    wsHandler.handleMessage(extWs as any, raw.toString());
                } catch (error) {
                    logEvent('ERROR', 'message_handler_error', { error: String(error) });
                }
            });

            extWs.on('error', (err: any) => {
                logEvent('ERROR', 'websocket_error', { error: String(err) });
            });

            extWs.on('close', async () => {
                if (!extWs.playerId) return;
                const player = gameController.getPlayerByRuntimeId(extWs.playerId);
                if (!player) return;
                logEvent('INFO', 'ws_closed', { playerId: player.id, username: player.username });
                await gameController.handleDisconnect(extWs.playerId);
            });
        });

        let lastTickAt = Date.now();
        let lastWorldBroadcastAt = 0;
        const tickTimer = setInterval(() => {
            const now = Date.now();
            const elapsedMs = Math.max(1, now - lastTickAt);
            lastTickAt = now;
            const dt = Math.max(0.010, Math.min(0.100, elapsedMs / 1000));
            const tickStart = performance.now();
            gameController.tick(dt, now);
            perfStats.recordDuration('server.tick.total', performance.now() - tickStart);

            if (now - lastWorldBroadcastAt < WORLD_STATE_MS) return;
            lastWorldBroadcastAt = now;
            const serializedSnapshotByInstance = new Map<string, string>();
            const broadcastStart = performance.now();
            for (const client of wss.clients) {
                if (client.readyState !== WebSocket.OPEN) continue;
                const extClient = client as ExtendedWebSocket;
                if (!extClient.playerId) continue;
                const player = gameController.getPlayerByRuntimeId(extClient.playerId);
                if (!player) continue;
                const instanceKey = `${String(player.mapKey)}::${String(player.mapId)}`;
                if (extClient.lastStaticInstanceKey !== instanceKey) {
                    client.send(gameController.serializeWorldStaticSnapshot(player.mapId, player.mapKey));
                    extClient.lastStaticInstanceKey = instanceKey;
                }
                let serialized = serializedSnapshotByInstance.get(instanceKey);
                if (!serialized) {
                    serialized = gameController.serializeWorldSnapshot(player.mapId, player.mapKey);
                    serializedSnapshotByInstance.set(instanceKey, serialized);
                }
                client.send(serialized);
            }
            perfStats.recordDuration('server.broadcast.worldState', performance.now() - broadcastStart);
        }, TICK_MS);

        const queueTimer = setInterval(() => {
            void gameController.processPersistenceQueue(25).catch((error) => {
                logEvent('ERROR', 'persistence_queue_error', { error: String(error) });
            });
        }, 1000);

        let shuttingDown = false;
        const shutdown = async (signal: string) => {
            if (shuttingDown) return;
            shuttingDown = true;
            logEvent('INFO', 'server_shutdown_start', { signal });
            clearInterval(tickTimer);
            clearInterval(queueTimer);
            try {
                await gameController.flushAllPlayers(`shutdown:${signal}`);
            } catch (error) {
                logEvent('ERROR', 'server_shutdown_flush_error', { signal, error: String(error) });
            }
            try {
                await gameController.processPersistenceQueue(200);
            } catch (error) {
                logEvent('ERROR', 'server_shutdown_queue_error', { signal, error: String(error) });
            }
            try {
                await prisma.$disconnect();
            } catch (error) {
                logEvent('ERROR', 'server_shutdown_disconnect_error', { signal, error: String(error) });
            }
            if (redis) {
                try {
                    await redis.quit();
                } catch (error) {
                    logEvent('ERROR', 'redis_shutdown_error', { signal, error: String(error) });
                }
            }
            server.close(() => {
                logEvent('INFO', 'server_shutdown_done', { signal });
                process.exit(0);
            });
            setTimeout(() => process.exit(1), 8000).unref();
        };
        process.on('SIGINT', () => { void shutdown('SIGINT'); });
        process.on('SIGTERM', () => { void shutdown('SIGTERM'); });

        server.listen(PORT, HOST, () => {
            logEvent('INFO', 'server_started', { port: PORT, host: HOST });
            console.log(`Server running on http://${HOST}:${PORT}`);
        });
    } catch (error) {
        console.error('server_init_error', error);
        logEvent('ERROR', 'server_init_error', { error: String(error) });
        process.exit(1);
    }
}

initializeServer();







