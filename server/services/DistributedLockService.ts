import { randomUUID } from 'crypto';

export class DistributedLockService {
    constructor(private readonly redis: any | null) {}

    async acquire(lockKey: string, ttlMs: number = 4000): Promise<string | null> {
        if (!this.redis) return randomUUID();
        const token = randomUUID();
        const ok = await this.redis.set(lockKey, token, { NX: true, PX: Math.max(250, Math.floor(ttlMs)) });
        return ok === 'OK' ? token : null;
    }

    async release(lockKey: string, token: string): Promise<void> {
        if (!this.redis) return;
        const script = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;
        await this.redis.eval(script, {
            keys: [lockKey],
            arguments: [token]
        });
    }
}
