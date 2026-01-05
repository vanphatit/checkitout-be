import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import Redis from 'ioredis';
import { Seat } from '../entities/seat.entity';
import { SeatStatus } from '../enums/seat-status.enum';

export interface SeatLock {
    schedulingId: string;
    seatId: string;
    clientId: string;
    userId?: string;
    lockedAt: Date;
    expiresAt: Date;
}

@Injectable()
export class SeatLockService {
    private readonly logger = new Logger(SeatLockService.name);
    private readonly redis: Redis;
    private readonly LOCK_TTL = 600; // 10 minutes in seconds
    private readonly LOCK_PREFIX = 'seat:lock:';
    private readonly CLIENT_PREFIX = 'client:seats:';

    constructor(
        @InjectModel(Seat.name) private seatModel: Model<Seat>,
    ) {
        // Initialize Redis connection
        this.redis = new Redis({
            host: process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379'),
            password: process.env.REDIS_PASSWORD || undefined,
            retryStrategy: (times) => {
                const delay = Math.min(times * 50, 2000);
                return delay;
            },
        });

        this.redis.on('connect', () => {
            this.logger.log('Redis connected for seat lock service');
        });

        this.redis.on('error', (error) => {
            this.logger.error(`Redis error: ${error.message}`);
        });

        // Cleanup expired locks periodically
        setInterval(() => this.cleanupExpiredLocks(), 60000); // Every 1 minute
    }

    /**
     * Generate Redis key for seat lock
     */
    private getSeatLockKey(schedulingId: string, seatId: string): string {
        return `${this.LOCK_PREFIX}${schedulingId}:${seatId}`;
    }

    /**
     * Generate Redis key for client's locked seats
     */
    private getClientSeatsKey(clientId: string): string {
        return `${this.CLIENT_PREFIX}${clientId}`;
    }

    /**
     * Lock a seat for a client
     */
    async lockSeat(
        schedulingId: string,
        seatId: string,
        clientId: string,
        userId?: string,
    ): Promise<boolean> {
        const key = this.getSeatLockKey(schedulingId, seatId);

        try {
            // Check if seat is already booked in database
            // Note: seatId here is actually seatNo (like "A3", "B1")
            const seat = await this.seatModel.findOne({ seatNo: seatId });
            if (!seat) {
                throw new Error('Seat not found');
            }
            if (seat.status === SeatStatus.SOLD) {
                throw new Error('Seat already booked');
            }

            // Try to set lock with NX (only if not exists) and EX (expiration)
            const lockData: SeatLock = {
                schedulingId,
                seatId,
                clientId,
                userId,
                lockedAt: new Date(),
                expiresAt: new Date(Date.now() + this.LOCK_TTL * 1000),
            };

            const result = await this.redis.set(
                key,
                JSON.stringify(lockData),
                'EX',
                this.LOCK_TTL,
                'NX',
            );

            if (result === 'OK') {
                // Add seat to client's locked seats list
                await this.redis.sadd(this.getClientSeatsKey(clientId), key);
                await this.redis.expire(this.getClientSeatsKey(clientId), this.LOCK_TTL);

                this.logger.log(`Seat ${seatId} locked by client ${clientId}`);
                return true;
            }

            return false;
        } catch (error) {
            this.logger.error(`Error locking seat: ${error.message}`);
            throw error;
        }
    }

    /**
     * Unlock a seat
     */
    async unlockSeat(
        schedulingId: string,
        seatId: string,
        clientId: string,
    ): Promise<boolean> {
        const key = this.getSeatLockKey(schedulingId, seatId);

        try {
            // Check if the lock belongs to this client
            const lockData = await this.redis.get(key);
            if (!lockData) {
                return false; // Lock doesn't exist
            }

            const lock: SeatLock = JSON.parse(lockData);
            if (lock.clientId !== clientId) {
                return false; // Lock belongs to another client
            }

            // Delete the lock
            await this.redis.del(key);
            await this.redis.srem(this.getClientSeatsKey(clientId), key);

            this.logger.log(`Seat ${seatId} unlocked by client ${clientId}`);
            return true;
        } catch (error) {
            this.logger.error(`Error unlocking seat: ${error.message}`);
            throw error;
        }
    }

    /**
     * Release all seats locked by a client (on disconnect)
     */
    async releaseAllSeatsForClient(clientId: string): Promise<void> {
        const clientKey = this.getClientSeatsKey(clientId);

        try {
            // Get all seats locked by this client
            const seatKeys = await this.redis.smembers(clientKey);

            if (seatKeys.length > 0) {
                // Delete all locks
                await this.redis.del(...seatKeys);
                // Delete client's seat list
                await this.redis.del(clientKey);

                this.logger.log(`Released ${seatKeys.length} seats for client ${clientId}`);
            }
        } catch (error) {
            this.logger.error(`Error releasing seats for client: ${error.message}`);
        }
    }

    /**
     * Get all locked seats for a scheduling
     */
    async getLockedSeats(schedulingId: string): Promise<SeatLock[]> {
        try {
            const pattern = `${this.LOCK_PREFIX}${schedulingId}:*`;
            const keys = await this.redis.keys(pattern);

            if (keys.length === 0) {
                return [];
            }

            const locks: SeatLock[] = [];
            for (const key of keys) {
                const lockData = await this.redis.get(key);
                if (lockData) {
                    locks.push(JSON.parse(lockData));
                }
            }

            return locks;
        } catch (error) {
            this.logger.error(`Error getting locked seats: ${error.message}`);
            return [];
        }
    }

    /**
     * Get all seats locked by a specific client
     */
    async getClientSeats(clientId: string): Promise<string[]> {
        try {
            const clientKey = this.getClientSeatsKey(clientId);
            const seatKeys = await this.redis.smembers(clientKey);
            return seatKeys.map(key => key.split(':').pop() || '');
        } catch (error) {
            this.logger.error(`Error getting client seats: ${error.message}`);
            return [];
        }
    }

    /**
     * Check if a seat is locked
     */
    async isSeatLocked(schedulingId: string, seatId: string): Promise<boolean> {
        const key = this.getSeatLockKey(schedulingId, seatId);
        const exists = await this.redis.exists(key);
        return exists === 1;
    }

    /**
     * Extend lock time for a seat (renew)
     */
    async renewLock(schedulingId: string, seatId: string, clientId: string): Promise<boolean> {
        const key = this.getSeatLockKey(schedulingId, seatId);

        try {
            const lockData = await this.redis.get(key);
            if (!lockData) {
                return false;
            }

            const lock: SeatLock = JSON.parse(lockData);
            if (lock.clientId !== clientId) {
                return false;
            }

            // Extend expiration
            await this.redis.expire(key, this.LOCK_TTL);
            await this.redis.expire(this.getClientSeatsKey(clientId), this.LOCK_TTL);

            this.logger.log(`Lock renewed for seat ${seatId}`);
            return true;
        } catch (error) {
            this.logger.error(`Error renewing lock: ${error.message}`);
            return false;
        }
    }

    /**
     * Cleanup expired locks (fallback mechanism)
     */
    private async cleanupExpiredLocks(): Promise<void> {
        try {
            const pattern = `${this.LOCK_PREFIX}*`;
            const keys = await this.redis.keys(pattern);

            for (const key of keys) {
                const ttl = await this.redis.ttl(key);
                if (ttl < 0) {
                    // Key exists but has no expiration, delete it
                    await this.redis.del(key);
                    this.logger.warn(`Cleaned up expired lock: ${key}`);
                }
            }
        } catch (error) {
            this.logger.error(`Error during cleanup: ${error.message}`);
        }
    }

    /**
     * Force unlock a seat (admin action)
     */
    async forceUnlock(schedulingId: string, seatId: string): Promise<boolean> {
        const key = this.getSeatLockKey(schedulingId, seatId);

        try {
            const lockData = await this.redis.get(key);
            if (lockData) {
                const lock: SeatLock = JSON.parse(lockData);
                await this.redis.srem(this.getClientSeatsKey(lock.clientId), key);
            }
            await this.redis.del(key);
            this.logger.log(`Force unlocked seat ${seatId}`);
            return true;
        } catch (error) {
            this.logger.error(`Error force unlocking seat: ${error.message}`);
            return false;
        }
    }
}
