type BroadcastMapFn = (mapKey: string, mapId: string, payload: any) => void;
type GetMapWorldFn = (mapKey: string) => {
    width: number;
    height: number;
};
type ProjectToWalkableFn = (mapKey: string, x: number, y: number) => {
    x: number;
    y: number;
};
export declare class EventService {
    private readonly mobService;
    private readonly broadcastMapInstance;
    private readonly getMapWorld;
    private readonly projectToWalkable;
    private readonly activeByInstance;
    private readonly nextStartByEvent;
    constructor(mobService: any, broadcastMapInstance: BroadcastMapFn, getMapWorld: GetMapWorldFn, projectToWalkable: ProjectToWalkableFn);
    tick(now: number): void;
    getActiveEventsForMap(mapKey: string, mapId: string): {
        id: string;
        name: string;
        mapKey: string;
        mapId: string;
        x: number;
        y: number;
        startedAt: number;
        endsAt: number;
    }[];
    private syncActiveState;
    private startEvent;
    private finishEvent;
    private mapInstanceId;
}
export {};
//# sourceMappingURL=EventService.d.ts.map