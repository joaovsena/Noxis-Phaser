"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DistributedLockService = void 0;
const crypto_1 = require("crypto");
class DistributedLockService {
    constructor(redis) {
        this.redis = redis;
    }
    async acquire(lockKey, ttlMs = 4000) {
        if (!this.redis)
            return (0, crypto_1.randomUUID)();
        const token = (0, crypto_1.randomUUID)();
        const ok = await this.redis.set(lockKey, token, { NX: true, PX: Math.max(250, Math.floor(ttlMs)) });
        return ok === 'OK' ? token : null;
    }
    async release(lockKey, token) {
        if (!this.redis)
            return;
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
exports.DistributedLockService = DistributedLockService;
//# sourceMappingURL=DistributedLockService.js.map