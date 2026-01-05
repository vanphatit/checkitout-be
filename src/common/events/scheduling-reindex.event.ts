export class BusUpdatedEvent {
    constructor(public readonly busId: string) { }
}

export class RouteUpdatedEvent {
    constructor(public readonly routeId: string) { }
}

export class StationUpdatedEvent {
    constructor(public readonly stationId: string) { }
}
