declare class PerfStats {
    private readonly buckets;
    private readonly counters;
    private readonly startedAt;
    private lastResetAt;
    recordDuration(name: string, durationMs: number): void;
    increment(name: string, amount?: number): void;
    time<T>(name: string, fn: () => T): T;
    snapshot(): {
        uptimeMs: number;
        windowMs: number;
        durations: Record<string, any>;
        counters: Record<string, number>;
    };
    reset(): void;
}
export declare const perfStats: PerfStats;
export {};
//# sourceMappingURL=perfStats.d.ts.map