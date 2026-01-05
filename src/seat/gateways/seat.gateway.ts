import {
    WebSocketGateway,
    WebSocketServer,
    SubscribeMessage,
    MessageBody,
    ConnectedSocket,
    OnGatewayConnection,
    OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { SeatLockService } from '../services/seat-lock.service';

@WebSocketGateway({
    cors: {
        origin: process.env.FRONTEND_URL || 'http://localhost:3000',
        credentials: true,
    },
    namespace: '/seats',
})
export class SeatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private readonly logger = new Logger(SeatGateway.name);

    constructor(private readonly seatLockService: SeatLockService) { }

    handleConnection(client: Socket) {
        this.logger.log(`Client connected: ${client.id}`);
    }

    async handleDisconnect(client: Socket) {
        this.logger.log(`Client disconnected: ${client.id}`);
        // Get all seats locked by this client before releasing
        const releasedSeats = await this.seatLockService.getClientSeats(client.id);

        // Release all seats locked by this client
        await this.seatLockService.releaseAllSeatsForClient(client.id);

        // Notify rooms about released seats
        for (const seatId of releasedSeats) {
            // Get scheduling ID from client's rooms
            const rooms = Array.from(client.rooms).filter(r => r.startsWith('scheduling:'));
            rooms.forEach(room => {
                const schedulingId = room.replace('scheduling:', '');
                this.server.to(room).emit('seat:unlocked', { schedulingId, seatId, clientId: client.id });
            });
        }
    }

    /**
     * Client joins a scheduling room to receive seat updates
     */
    @SubscribeMessage('join:scheduling')
    async handleJoinScheduling(
        @MessageBody() data: { schedulingId: string },
        @ConnectedSocket() client: Socket,
    ) {
        const { schedulingId } = data;
        client.join(`scheduling:${schedulingId}`);
        this.logger.log(`Client ${client.id} joined scheduling:${schedulingId}`);

        // Send current locked seats for this scheduling
        const locks = await this.seatLockService.getLockedSeats(schedulingId);
        client.emit('seats:locked', { schedulingId, locks });
        this.logger.log(`Sent ${locks.length} locked seats to client ${client.id}`);

        return { status: 'joined', schedulingId };
    }

    /**
     * Client leaves a scheduling room
     */
    @SubscribeMessage('leave:scheduling')
    handleLeaveScheduling(
        @MessageBody() data: { schedulingId: string },
        @ConnectedSocket() client: Socket,
    ) {
        const { schedulingId } = data;
        client.leave(`scheduling:${schedulingId}`);
        this.logger.log(`Client ${client.id} left scheduling:${schedulingId}`);
        return { status: 'left', schedulingId };
    }

    /**
     * Client requests to lock a seat
     */
    @SubscribeMessage('seat:lock')
    async handleLockSeat(
        @MessageBody() data: { schedulingId: string; seatId: string; userId?: string },
        @ConnectedSocket() client: Socket,
    ) {
        const { schedulingId, seatId, userId } = data;

        try {
            // Try to lock the seat
            const locked = await this.seatLockService.lockSeat(
                schedulingId,
                seatId,
                client.id,
                userId,
            );

            if (locked) {
                // Notify all clients in the room about the locked seat
                const roomName = `scheduling:${schedulingId}`;
                this.server.to(roomName).emit('seat:locked', {
                    schedulingId,
                    seatId,
                    clientId: client.id,
                    userId,
                });

                this.logger.log(`✅ Seat ${seatId} locked by ${client.id} in ${roomName}`);
                this.logger.log(`📢 Broadcasting to room ${roomName}`);
                return { success: true, seatId, message: 'Seat locked successfully' };
            } else {
                this.logger.warn(`❌ Failed to lock seat ${seatId} - already locked`);
                return { success: false, seatId, message: 'Seat already locked by another user' };
            }
        } catch (error) {
            this.logger.error(`Error locking seat: ${error.message}`);
            return { success: false, seatId, message: error.message };
        }
    }

    /**
     * Client requests to unlock a seat
     */
    @SubscribeMessage('seat:unlock')
    async handleUnlockSeat(
        @MessageBody() data: { schedulingId: string; seatId: string },
        @ConnectedSocket() client: Socket,
    ) {
        const { schedulingId, seatId } = data;

        try {
            // Try to unlock the seat
            const unlocked = await this.seatLockService.unlockSeat(
                schedulingId,
                seatId,
                client.id,
            );

            if (unlocked) {
                // Notify all clients in the room about the unlocked seat
                this.server.to(`scheduling:${schedulingId}`).emit('seat:unlocked', {
                    schedulingId,
                    seatId, clientId: client.id,
                });

                this.logger.log(`Seat ${seatId} unlocked by ${client.id} in scheduling ${schedulingId}`);
                return { success: true, seatId, message: 'Seat unlocked successfully' };
            } else {
                return { success: false, seatId, message: 'Seat not locked by this client' };
            }
        } catch (error) {
            this.logger.error(`Error unlocking seat: ${error.message}`);
            return { success: false, seatId, message: error.message };
        }
    }

    /**
     * Manually notify about seat booking (called from booking service)
     */
    notifySeatBooked(schedulingId: string, seatId: string, userId: string) {
        this.server.to(`scheduling:${schedulingId}`).emit('seat:booked', {
            schedulingId,
            seatId,
            userId,
        });
        this.logger.log(`Seat ${seatId} booked in scheduling ${schedulingId}`);
    }

    /**
     * Manually notify about seat cancellation (called from booking service)
     */
    notifySeatCancelled(schedulingId: string, seatId: string) {
        this.server.to(`scheduling:${schedulingId}`).emit('seat:cancelled', {
            schedulingId,
            seatId,
        });
        this.logger.log(`Seat ${seatId} cancelled in scheduling ${schedulingId}`);
    }
}
