"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.perfStats = void 0;
const perf_hooks_1 = require("perf_hooks");
class PerfStats {
    constructor() {
        this.buckets = new Map();
        this.counters = new Map();
        this.startedAt = Date.now();
        this.lastResetAt = Date.now();
    }
    recordDuration(name, durationMs) {
        const safeDuration = Math.max(0, Number(durationMs || 0));
        const bucket = this.buckets.get(name) || { count: 0, totalMs: 0, maxMs: 0 };
        bucket.count += 1;
        bucket.totalMs += safeDuration;
        bucket.maxMs = Math.max(bucket.maxMs, safeDuration);
        this.buckets.set(name, bucket);
    }
    increment(name, amount = 1) {
        const safeAmount = Number.isFinite(Number(amount)) ? Number(amount) : 1;
        this.counters.set(name, (this.counters.get(name) || 0) + safeAmount);
    }
    time(name, fn) {
        const start = perf_hooks_1.performance.now();
        try {
            return fn();
        }
        finally {
            this.recordDuration(name, perf_hooks_1.performance.now() - start);
        }
    }
    snapshot() {
        const durations = {};
        for (const [name, bucket] of this.buckets.entries()) {
            durations[name] = {
                count: bucket.count,
                totalMs: Number(bucket.totalMs.toFixed(3)),
                avgMs: Number((bucket.totalMs / Math.max(1, bucket.count)).toFixed(3)),
                maxMs: Number(bucket.maxMs.toFixed(3))
            };
        }
        const counters = {};
        for (const [name, value] of this.counters.entries())
            counters[name] = value;
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
exports.perfStats = new PerfStats();
//# sourceMappingURL=perfStats.js.map