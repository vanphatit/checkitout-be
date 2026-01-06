import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Scheduling } from './entities/scheduling.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

export interface SchedulingStatusJob {
    schedulingId: string;
    targetStatus: 'in-progress' | 'completed';
    etd?: string;
    eta?: string;
}

@Processor('scheduling-status')
export class SchedulingProcessor {
    private readonly logger = new Logger(SchedulingProcessor.name);

    constructor(
        @InjectModel(Scheduling.name)
        private schedulingModel: Model<Scheduling>,
        private eventEmitter: EventEmitter2,
    ) { }

    @Process('start-trip')
    async handleStartTrip(job: Job<SchedulingStatusJob>) {
        const { schedulingId, etd } = job.data;

        this.logger.log(`Processing start-trip job for scheduling ${schedulingId} at ${new Date().toISOString()}`);

        try {
            const scheduling = await this.schedulingModel.findById(schedulingId);

            if (!scheduling) {
                this.logger.warn(`Scheduling ${schedulingId} not found`);
                return { success: false, reason: 'not-found' };
            }

            // Only update if still in scheduled status
            if (scheduling.status === 'scheduled') {
                scheduling.status = 'in-progress';
                await scheduling.save();

                this.logger.log(`Scheduling ${schedulingId} updated to in-progress`);

                // Emit event for real-time updates
                this.eventEmitter.emit('scheduling.status.changed', {
                    schedulingId: schedulingId,
                    oldStatus: 'scheduled',
                    newStatus: 'in-progress',
                    etd,
                });

                return { success: true, newStatus: 'in-progress' };
            } else {
                this.logger.warn(`Scheduling ${schedulingId} is not in scheduled status (current: ${scheduling.status})`);
                return { success: false, reason: 'invalid-status' };
            }
        } catch (error) {
            this.logger.error(`Error processing start-trip for ${schedulingId}:`, error);
            throw error;
        }
    }

    @Process('complete-trip')
    async handleCompleteTrip(job: Job<SchedulingStatusJob>) {
        const { schedulingId, eta } = job.data;

        this.logger.log(`Processing complete-trip job for scheduling ${schedulingId} at ${new Date().toISOString()}`);

        try {
            const scheduling = await this.schedulingModel.findById(schedulingId);

            if (!scheduling) {
                this.logger.warn(`Scheduling ${schedulingId} not found`);
                return { success: false, reason: 'not-found' };
            }

            // Only update if in in-progress status
            if (scheduling.status === 'in-progress') {
                scheduling.status = 'completed';
                await scheduling.save();

                this.logger.log(`Scheduling ${schedulingId} updated to completed`);

                // Emit event for real-time updates
                this.eventEmitter.emit('scheduling.status.changed', {
                    schedulingId: schedulingId,
                    oldStatus: 'in-progress',
                    newStatus: 'completed',
                    eta,
                });

                return { success: true, newStatus: 'completed' };
            } else {
                this.logger.warn(`Scheduling ${schedulingId} is not in in-progress status (current: ${scheduling.status})`);
                return { success: false, reason: 'invalid-status' };
            }
        } catch (error) {
            this.logger.error(`Error processing complete-trip for ${schedulingId}:`, error);
            throw error;
        }
    }
}
