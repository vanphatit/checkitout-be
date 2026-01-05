import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Scheduling, SchedulingDocument } from '../entities/scheduling.entity';
import { SchedulingSearchService } from './scheduling-search.service';
import { BusUpdatedEvent, RouteUpdatedEvent, StationUpdatedEvent } from '../../common/events/scheduling-reindex.event';

@Injectable()
export class SchedulingReindexListener {
    private readonly logger = new Logger(SchedulingReindexListener.name);

    constructor(
        @InjectModel(Scheduling.name) private schedulingModel: Model<SchedulingDocument>,
        private readonly schedulingSearchService: SchedulingSearchService,
    ) { }

    @OnEvent('bus.updated')
    async handleBusUpdated(event: BusUpdatedEvent) {
        this.logger.log(`Bus ${event.busId} updated, reindexing related schedulings...`);

        try {
            // Find all schedulings that use this bus
            const schedulings = await this.schedulingModel
                .find({
                    busIds: new Types.ObjectId(event.busId),
                    isDeleted: false,
                })
                .populate('routeId', 'name')
                .exec();

            this.logger.log(`Found ${schedulings.length} schedulings to reindex`);

            // Reindex each scheduling
            for (const scheduling of schedulings) {
                try {
                    await this.schedulingSearchService.updateScheduling(
                        (scheduling._id as Types.ObjectId).toString(),
                        scheduling,
                    );
                } catch (error) {
                    this.logger.warn(`Failed to reindex scheduling ${(scheduling._id as Types.ObjectId).toString()}: ${error.message}`);
                }
            }

            this.logger.log(`Finished reindexing schedulings for bus ${event.busId}`);
        } catch (error) {
            this.logger.error(`Error reindexing schedulings for bus ${event.busId}:`, error);
        }
    }

    @OnEvent('route.updated')
    async handleRouteUpdated(event: RouteUpdatedEvent) {
        this.logger.log(`Route ${event.routeId} updated, reindexing related schedulings...`);

        try {
            // Find all schedulings for this route
            const schedulings = await this.schedulingModel
                .find({
                    routeId: new Types.ObjectId(event.routeId),
                    isDeleted: false,
                })
                .populate('routeId', 'name')
                .exec();

            this.logger.log(`Found ${schedulings.length} schedulings to reindex`);

            // Reindex each scheduling
            for (const scheduling of schedulings) {
                try {
                    await this.schedulingSearchService.updateScheduling(
                        (scheduling._id as Types.ObjectId).toString(),
                        scheduling,
                    );
                } catch (error) {
                    this.logger.warn(`Failed to reindex scheduling ${(scheduling._id as Types.ObjectId).toString()}: ${error.message}`);
                }
            }

            this.logger.log(`Finished reindexing schedulings for route ${event.routeId}`);
        } catch (error) {
            this.logger.error(`Error reindexing schedulings for route ${event.routeId}:`, error);
        }
    }

    @OnEvent('station.updated')
    async handleStationUpdated(event: StationUpdatedEvent) {
        this.logger.log(`Station ${event.stationId} updated, finding affected routes...`);

        try {
            // Since stations are referenced through routes, we need to find routes that use this station
            // This would require importing RouteModel, which creates circular dependency
            // Better approach: Handle this at route level when station changes
            // For now, just log it
            this.logger.log(`Station update received. Routes using this station should emit route.updated events.`);
        } catch (error) {
            this.logger.error(`Error handling station update ${event.stationId}:`, error);
        }
    }
}
