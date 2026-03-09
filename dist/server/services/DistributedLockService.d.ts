export declare class DistributedLockService {
    private readonly redis;
    constructor(redis: any | null);
    acquire(lockKey: string, ttlMs?: number): Promise<string | null>;
    release(lockKey: string, token: string): Promise<void>;
}
//# sourceMappingURL=DistributedLockService.d.ts.map