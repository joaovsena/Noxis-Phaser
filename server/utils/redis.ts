import { createClient } from 'redis';
import { logEvent } from './logger';

export async function createRedisClient(): Promise<any | null> {
    const url = String(process.env.REDIS_URL || '').trim();
    if (!url) return null;
    const client = createClient({ url });
    client.on('error', (error) => {
        logEvent('ERROR', 'redis_error', { error: String(error) });
    });
    await client.connect();
    logEvent('INFO', 'redis_connected', { url });
    return client;
}
