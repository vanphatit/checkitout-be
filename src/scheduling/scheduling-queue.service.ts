import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { SchedulingStatusJob } from './scheduling.processor';

@Injectable()
export class SchedulingQueueService {
    private readonly logger = new Logger(SchedulingQueueService.name);

    constructor(
        @InjectQueue('scheduling-status')
        private schedulingQueue: Queue<SchedulingStatusJob>,
    ) { }

    /**
     * Add delayed jobs for a scheduling
     * - start-trip job: triggers at ETD to change scheduled → in-progress
     * - complete-trip job: triggers at ETA to change in-progress → completed
     */
    async addSchedulingJobs(
        schedulingId: string,
        etd: Date,
        eta: Date,
    ): Promise<void> {
        const now = new Date();
        const startDelay = Math.max(0, etd.getTime() - now.getTime());
        const completeDelay = Math.max(0, eta.getTime() - now.getTime());

        try {
            // Add start-trip job
            if (startDelay > 0) {
                await this.schedulingQueue.add(
                    'start-trip',
                    {
                        schedulingId,
                        targetStatus: 'in-progress',
                        etd: etd.toISOString(),
                    },
                    {
                        delay: startDelay,
                        jobId: `start-${schedulingId}`,
                        removeOnComplete: true,
                        removeOnFail: false,
                    },
                );

                this.logger.log(
                    `Added start-trip job for scheduling ${schedulingId}, delay: ${Math.round(startDelay / 1000)}s (${etd.toISOString()})`,
                );
            } else {
                this.logger.warn(
                    `ETD ${etd.toISOString()} is in the past, skipping start-trip job for ${schedulingId}`,
                );
            }

            // Add complete-trip job
            if (completeDelay > 0) {
                await this.schedulingQueue.add(
                    'complete-trip',
                    {
                        schedulingId,
                        targetStatus: 'completed',
                        eta: eta.toISOString(),
                    },
                    {
                        delay: completeDelay,
                        jobId: `complete-${schedulingId}`,
                        removeOnComplete: true,
                        removeOnFail: false,
                    },
                );

                this.logger.log(
                    `Added complete-trip job for scheduling ${schedulingId}, delay: ${Math.round(completeDelay / 1000)}s (${eta.toISOString()})`,
                );
            } else {
                this.logger.warn(
                    `ETA ${eta.toISOString()} is in the past, skipping complete-trip job for ${schedulingId}`,
                );
            }
        } catch (error) {
            this.logger.error(
                `Failed to add jobs for scheduling ${schedulingId}:`,
                error,
            );
            throw error;
        }
    }

    /**
     * Remove all jobs for a scheduling (when deleting)
     */
    async removeSchedulingJobs(schedulingId: string): Promise<void> {
        try {
            const startJobId = `start-${schedulingId}`;
            const completeJobId = `complete-${schedulingId}`;

            const startJob = await this.schedulingQueue.getJob(startJobId);
            const completeJob = await this.schedulingQueue.getJob(completeJobId);

            if (startJob) {
                await startJob.remove();
                this.logger.log(`Removed start-trip job for scheduling ${schedulingId}`);
            }

            if (completeJob) {
                await completeJob.remove();
                this.logger.log(`Removed complete-trip job for scheduling ${schedulingId}`);
            }
        } catch (error) {
            this.logger.error(
                `Failed to remove jobs for scheduling ${schedulingId}:`,
                error,
            );
            throw error;
        }
    }

    /**
     * Update jobs for a scheduling (when updating ETD/ETA)
     * Remove old jobs and create new ones
     */
    async updateSchedulingJobs(
        schedulingId: string,
        etd: Date,
        eta: Date,
    ): Promise<void> {
        this.logger.log(`Updating jobs for scheduling ${schedulingId}`);

        // Remove existing jobs
        await this.removeSchedulingJobs(schedulingId);

        // Add new jobs with updated times
        await this.addSchedulingJobs(schedulingId, etd, eta);
    }

    /**
     * Get pending jobs count for monitoring
     */
    async getPendingJobsCount(): Promise<{
        waiting: number;
        delayed: number;
        active: number;
    }> {
        const [waiting, delayed, active] = await Promise.all([
            this.schedulingQueue.getWaitingCount(),
            this.schedulingQueue.getDelayedCount(),
            this.schedulingQueue.getActiveCount(),
        ]);

        return { waiting, delayed, active };
    }
}
