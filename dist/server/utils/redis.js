"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRedisClient = createRedisClient;
const redis_1 = require("redis");
const logger_1 = require("./logger");
async function createRedisClient() {
    const url = String(process.env.REDIS_URL || '').trim();
    if (!url)
        return null;
    const client = (0, redis_1.createClient)({ url });
    client.on('error', (error) => {
        (0, logger_1.logEvent)('ERROR', 'redis_error', { error: String(error) });
    });
    await client.connect();
    (0, logger_1.logEvent)('INFO', 'redis_connected', { url });
    return client;
}
//# sourceMappingURL=redis.js.map