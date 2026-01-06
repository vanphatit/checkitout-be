import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { faker } from '@faker-js/faker';
import { Ticket } from '../../ticket/entities/ticket.entity';
import { User } from '../../users/entities/user.entity';
import { Seat } from '../../seat/entities/seat.entity';
import { Scheduling } from '../../scheduling/entities/scheduling.entity';
import { Station } from '../../station/entities/station.entity';

/**
 * Service for seeding dashboard statistics data
 */
@Injectable()
export class SeederDashboardService {
    private readonly logger = new Logger(SeederDashboardService.name);

    constructor(
        @InjectModel(Ticket.name) private ticketModel: Model<Ticket>,
        @InjectModel(User.name) private userModel: Model<User>,
        @InjectModel(Seat.name) private seatModel: Model<Seat>,
        @InjectModel(Scheduling.name) private schedulingModel: Model<Scheduling>,
        @InjectModel(Station.name) private stationModel: Model<Station>,
    ) { }

    /**
     * Seed tickets for dashboard statistics with realistic distribution
     */
    async seedTicketsForDashboard(schedulings: any[]): Promise<any[]> {
        this.logger.log('🎫 Bắt đầu seed tickets cho dashboard...');

        try {
            // Get all users from DB
            const users = await this.userModel.find().lean();
            this.logger.log(`📊 Tìm thấy ${users.length} users trong DB`);

            if (users.length === 0) {
                this.logger.warn('⚠️ Không có users trong DB, bỏ qua seed tickets');
                return [];
            }

            if (schedulings.length === 0) {
                this.logger.warn('⚠️ Không có schedulings, bỏ qua seed tickets');
                return [];
            }

            const tickets: any[] = [];
            const totalTickets = faker.number.int({ min: 250, max: 350 });
            const now = new Date();
            this.logger.log(`🎯 Sẽ tạo ${totalTickets} tickets`);

            // Status distribution: 65% SUCCESS, 20% PENDING, 10% FAILED, 5% TRANSFER
            const statusWeights = [
                { status: 'SUCCESS', weight: 0.65 },
                { status: 'PENDING', weight: 0.20 },
                { status: 'FAILED', weight: 0.10 },
                { status: 'TRANSFER', weight: 0.05 },
            ];

            // Time distribution: 20% TODAY, 20% last 7d, 40% last 30d, 20% last 12m
            const timeRanges = [
                { days: 0, weight: 0.20 },  // TODAY - 20%
                { days: 7, weight: 0.20 },
                { days: 30, weight: 0.40 },
                { days: 365, weight: 0.20 },
            ];

            let successCount = 0;
            let skipCount = 0;

            for (let i = 0; i < totalTickets; i++) {
                try {
                    // Select random scheduling
                    const scheduling = faker.helpers.arrayElement(schedulings);

                    // Populate scheduling with route data
                    const populatedScheduling = await this.schedulingModel
                        .findById(scheduling._id)
                        .populate('routeId')
                        .lean();

                    if (!populatedScheduling || !populatedScheduling.routeId) {
                        this.logger.debug(`Ticket ${i + 1}: Scheduling không có route`);
                        skipCount++;
                        continue;
                    }

                    const route = populatedScheduling.routeId as any;

                    // Validate route has stationIds array with at least 2 stations
                    if (!route || !route.stationIds || route.stationIds.length < 2) {
                        this.logger.debug(`Ticket ${i + 1}: Route invalid - hasRoute: ${!!route}, hasStations: ${!!route?.stationIds}, stationCount: ${route?.stationIds?.length || 0}`);
                        skipCount++;
                        continue;
                    }

                    // Get origin and destination from stationIds array
                    const originStationId = route.stationIds[0];
                    const destinationStationId = route.stationIds[route.stationIds.length - 1];
                    const user = faker.helpers.arrayElement(users);

                    // Determine status based on weights
                    let status = 'SUCCESS';
                    const statusRand = Math.random();
                    let cumulative = 0;
                    for (const sw of statusWeights) {
                        cumulative += sw.weight;
                        if (statusRand < cumulative) {
                            status = sw.status;
                            break;
                        }
                    }

                    // Determine created date based on time distribution
                    const timeRand = Math.random();
                    let daysAgo = 0;  // Default to today
                    cumulative = 0;
                    for (const tr of timeRanges) {
                        cumulative += tr.weight;
                        if (timeRand < cumulative) {
                            daysAgo = tr.days === 0 ? 0 : faker.number.int({ min: 1, max: tr.days });
                            break;
                        }
                    }

                    const createdAt = new Date(now);
                    createdAt.setDate(createdAt.getDate() - daysAgo);

                    // For today's tickets, use current time or recent hours
                    if (daysAgo === 0) {
                        createdAt.setHours(
                            faker.number.int({ min: 0, max: now.getHours() }),
                            faker.number.int({ min: 0, max: 59 }),
                            faker.number.int({ min: 0, max: 59 })
                        );
                    } else {
                        createdAt.setHours(
                            faker.number.int({ min: 6, max: 22 }),
                            faker.number.int({ min: 0, max: 59 }),
                            faker.number.int({ min: 0, max: 59 })
                        );
                    }

                    // Generate realistic price
                    const basePrice = faker.number.int({ min: 100000, max: 500000 });
                    const promotionValue = status === 'SUCCESS'
                        ? faker.number.int({ min: 0, max: 20 })
                        : 0;
                    const discountAmount = Math.floor((basePrice * promotionValue) / 100);
                    const finalPrice = basePrice - discountAmount;

                    // Get random seat from ANY bus in busIds array
                    let seat: any = null;

                    // Try all buses in busIds array
                    if (scheduling.busIds && Array.isArray(scheduling.busIds)) {
                        for (const busId of scheduling.busIds) {
                            const foundSeats = await this.seatModel
                                .find({ busId: busId })
                                .limit(1)
                                .lean();

                            if (foundSeats.length > 0) {
                                seat = foundSeats[0];
                                break;
                            }
                        }
                    }

                    // Fallback to busId if busIds didn't work
                    if (!seat && scheduling.busId) {
                        const foundSeats = await this.seatModel
                            .find({ busId: scheduling.busId })
                            .limit(1)
                            .lean();

                        if (foundSeats.length > 0) {
                            seat = foundSeats[0];
                        }
                    }

                    if (!seat) {
                        this.logger.debug(`Ticket ${i + 1}: Không tìm thấy seat cho scheduling ${populatedScheduling._id}`);
                        skipCount++;
                        continue;
                    }

                    // Get the actual busId used for this seat
                    const usedBusId = seat.busId;

                    if (!usedBusId) {
                        this.logger.warn(`Ticket ${i + 1}: Seat không có busId`);
                        skipCount++;
                        continue;
                    }

                    // Get station names using IDs from route.stationIds
                    const originStation = await this.stationModel.findById(originStationId).lean();
                    const destStation = await this.stationModel.findById(destinationStationId).lean();

                    if (!originStation || !destStation) {
                        this.logger.warn(`Ticket ${i + 1}: Không tìm thấy station`);
                        skipCount++;
                        continue;
                    }

                    // Create ticket snapshot
                    const snapshot = {
                        seat: {
                            seatId: seat._id.toString(),
                            seatNo: seat.seatNo,
                            busId: usedBusId.toString(),
                        },
                        scheduling: {
                            schedulingId: populatedScheduling._id.toString(),
                            departureDate: populatedScheduling.departureDate,
                            arrivalDate: populatedScheduling.arrivalDate || populatedScheduling.departureDate,
                            price: populatedScheduling.price,
                            busId: usedBusId.toString(),
                        },
                        route: {
                            routeId: route._id.toString(),
                            name: route.name,
                            from: {
                                stationId: originStationId.toString(),
                                name: originStation?.name || 'Unknown Station',
                            },
                            to: {
                                stationId: destinationStationId.toString(),
                                name: destStation?.name || 'Unknown Station',
                            },
                            distance: route.distance,
                            etd: populatedScheduling.etd,
                        },
                        promotion: promotionValue > 0 ? {
                            promotionId: 'promo_' + faker.string.alphanumeric(8),
                            name: `Giảm ${promotionValue}%`,
                            value: promotionValue,
                            type: 'PERCENTAGE',
                            description: `Khuyến mãi giảm ${promotionValue}%`,
                        } : null,
                        pricing: {
                            originalPrice: basePrice,
                            promotionValue: promotionValue,
                            discountAmount: discountAmount,
                            finalPrice: finalPrice,
                        },
                        snapshotCreatedAt: createdAt,
                    };

                    // Create ticket
                    // promotionId is required, so create a dummy ObjectId if no promotion
                    const dummyPromotionId = new Types.ObjectId();

                    const ticket = new this.ticketModel({
                        userId: user._id,
                        seatId: seat._id,
                        schedulingId: populatedScheduling._id,
                        promotionId: dummyPromotionId, // Dummy promotion for seeded data
                        paymentMethod: 'BANKING', // Valid enum: CASH or BANKING
                        totalPrice: finalPrice,
                        status: status,
                        snapshot: snapshot,
                        expiredTime: new Date(createdAt.getTime() + 15 * 60 * 1000), // 15 min expiry
                        createdAt: createdAt,
                        updatedAt: createdAt,
                    });

                    // For SUCCESS tickets, add payment details
                    if (status === 'SUCCESS') {
                        ticket.transactionId = `TXN${faker.string.numeric(10)}`;
                        ticket.vnpayTransactionNo = faker.string.numeric(13);
                        ticket.bankCode = faker.helpers.arrayElement(['NCB', 'VIETCOMBANK', 'TECHCOMBANK', 'MBBANK']);
                        ticket.responseCode = '00';
                        ticket.responseMessage = 'Giao dịch thành công';
                        ticket.paidAt = createdAt;
                    }

                    await ticket.save();
                    tickets.push(ticket);
                    successCount++;

                    // Log success every 50 tickets
                    if (successCount % 50 === 0) {
                        this.logger.log(`✨ Đã tạo ${successCount}/${totalTickets} tickets...`);
                    }
                } catch (error) {
                    this.logger.error(`❌ Lỗi tạo ticket ${i + 1}: ${error.message}`);
                    if (error.stack) {
                        this.logger.debug(error.stack);
                    }
                    skipCount++;
                    continue;
                }
            }

            this.logger.log(`✅ Đã tạo ${successCount} tickets (${skipCount} bỏ qua) với phân bố:`);
            const statusCount = tickets.reduce((acc, t) => {
                acc[t.status] = (acc[t.status] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);
            Object.entries(statusCount).forEach(([status, count]) => {
                const percentage = (((count as number) / tickets.length) * 100).toFixed(1);
                this.logger.log(`   ${status}: ${count} tickets (${percentage}%)`);
            });

            return tickets;
        } catch (error) {
            this.logger.error('❌ Lỗi seed tickets:', error);
            return [];
        }
    }
}
