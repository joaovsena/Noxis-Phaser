import { performance } from 'perf_hooks';

type PerfBucket = {
    count: number;
    totalMs: number;
    maxMs: number;
};

class PerfStats {
    private readonly buckets = new Map<string, PerfBucket>();
    private readonly counters = new Map<string, number>();
    private readonly startedAt = Date.now();
    private lastResetAt = Date.now();

    recordDuration(name: string, durationMs: number) {
        const safeDuration = Math.max(0, Number(durationMs || 0));
        const bucket = this.buckets.get(name) || { count: 0, totalMs: 0, maxMs: 0 };
        bucket.count += 1;
        bucket.totalMs += safeDuration;
        bucket.maxMs = Math.max(bucket.maxMs, safeDuration);
        this.buckets.set(name, bucket);
    }

    increment(name: string, amount = 1) {
        const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 1;
        this.counters.set(name, (this.counters.get(name) || 0) + safeAmount);
    }

    time<T>(name: string, fn: () => T): T {
        const start = performance.now();
        try {
            return fn();
        } finally {
            this.recordDuration(name, performance.now() - start);
        }
    }

    snapshot() {
        const durations: Record<string, any> = {};
        for (const [name, bucket] of this.buckets.entries()) {
            durations[name] = {
                count: bucket.count,
                totalMs: Number(bucket.totalMs.toFixed(3)),
                avgMs: Number((bucket.totalMs / Math.max(1, bucket.count)).toFixed(3)),
                maxMs: Number(bucket.maxMs.toFixed(3))
            };
        }
        const counters: Record<string, number> = {};
        for (const [name, value] of this.counters.entries()) counters[name] = value;
        return {
            uptimeMs: Date.now() - this.startedAt,
            windowMs: Date.now() - this.lastResetAt,
            durations,
            counters
        };
    }

    reset() {
        this.buckets.clear();
        this.counters.clear();
        this.lastResetAt = Date.now();
    }
}

export const perfStats = new PerfStats();
