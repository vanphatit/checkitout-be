import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Ticket } from '../ticket/entities/ticket.entity';
import { Scheduling } from '../scheduling/entities/scheduling.entity';
import { Bus } from '../bus/entities/bus.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class StatisticsService {
    constructor(
        @InjectModel(Ticket.name) private ticketModel: Model<Ticket>,
        @InjectModel(Scheduling.name) private schedulingModel: Model<Scheduling>,
        @InjectModel(Bus.name) private busModel: Model<Bus>,
        @InjectModel(User.name) private userModel: Model<User>,
    ) { }

    /**
     * Get dashboard overview statistics
     */
    async getOverview() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // This month
        const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const nextMonthStart = new Date(today.getFullYear(), today.getMonth() + 1, 1);

        const [todayRevenue, todayTickets, activeSchedulings, newUsers] = await Promise.all([
            // Today's revenue
            this.ticketModel.aggregate([
                {
                    $match: {
                        createdAt: { $gte: today, $lt: tomorrow },
                        status: 'SUCCESS'
                    }
                },
                { $group: { _id: null, total: { $sum: '$totalPrice' } } }
            ]).then(result => result[0]?.total || 0),

            // Today's tickets count
            this.ticketModel.countDocuments({
                createdAt: { $gte: today, $lt: tomorrow }
            }),

            // Active schedulings today
            this.schedulingModel.countDocuments({
                departureDate: {
                    $gte: today.toISOString().split('T')[0],
                    $lt: tomorrow.toISOString().split('T')[0]
                }
            }),

            // New users this month
            this.userModel.countDocuments({
                createdAt: { $gte: thisMonthStart, $lt: nextMonthStart }
            })
        ]);

        return {
            todayRevenue,
            todayTickets,
            activeSchedulings,
            newUsers
        };
    }

    /**
     * Get revenue trend by period
     */
    async getRevenueTrend(period: string = '7d') {
        const now = new Date();
        let startDate: Date;
        let groupFormat: any;

        switch (period) {
            case '7d':
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 7);
                groupFormat = {
                    $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                };
                break;
            case '30d':
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 30);
                groupFormat = {
                    $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                };
                break;
            case '12m':
                startDate = new Date(now);
                startDate.setMonth(startDate.getMonth() - 12);
                groupFormat = {
                    $dateToString: { format: '%Y-%m', date: '$createdAt' }
                };
                break;
            default:
                startDate = new Date(now);
                startDate.setDate(startDate.getDate() - 7);
                groupFormat = {
                    $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
                };
        }

        const data = await this.ticketModel.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate },
                    status: 'SUCCESS'
                }
            },
            {
                $group: {
                    _id: groupFormat,
                    revenue: { $sum: '$totalPrice' }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    date: '$_id',
                    revenue: 1,
                    _id: 0
                }
            }
        ]);

        return data;
    }

    /**
     * Get top routes by revenue
     */
    async getTopRoutes(limit: number = 10) {
        const data = await this.ticketModel.aggregate([
            {
                $match: {
                    status: 'SUCCESS',
                    snapshot: { $exists: true }
                }
            },
            {
                $group: {
                    _id: {
                        routeId: '$snapshot.route.routeId',
                        routeName: '$snapshot.route.name',
                        originStation: '$snapshot.route.from.name',
                        destinationStation: '$snapshot.route.to.name'
                    },
                    revenue: { $sum: '$totalPrice' },
                    ticketCount: { $sum: 1 }
                }
            },
            { $sort: { revenue: -1 } },
            { $limit: limit },
            {
                $project: {
                    routeId: '$_id.routeId',
                    routeName: '$_id.routeName',
                    originStation: '$_id.originStation',
                    destinationStation: '$_id.destinationStation',
                    revenue: 1,
                    ticketCount: 1,
                    _id: 0
                }
            }
        ]);

        return data;
    }

    /**
     * Get ticket status distribution
     */
    async getTicketStatusDistribution() {
        const data = await this.ticketModel.aggregate([
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    status: '$_id',
                    count: 1,
                    _id: 0
                }
            }
        ]);

        // Convert to object format
        const distribution = {};
        data.forEach(item => {
            distribution[item.status] = item.count;
        });

        return distribution;
    }

    /**
     * Get scheduling status for today
     */
    async getSchedulingStatusToday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const data = await this.schedulingModel.aggregate([
            {
                $match: {
                    departureDate: {
                        $gte: today,
                        $lt: tomorrow
                    }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 }
                }
            },
            {
                $project: {
                    status: '$_id',
                    count: 1,
                    _id: 0
                }
            }
        ]);

        // Convert to object format
        const distribution = {
            scheduled: 0,
            'in-progress': 0,
            completed: 0,
            cancelled: 0
        };

        data.forEach(item => {
            const status = item.status.toLowerCase();
            if (distribution.hasOwnProperty(status)) {
                distribution[status] = item.count;
            }
        });

        return distribution;
    }

    /**
     * Get summary statistics for today's schedulings
     */
    async getTodaySchedulingSummary() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const [totalSchedulings, statusBreakdown] = await Promise.all([
            // Total schedulings today
            this.schedulingModel.countDocuments({
                departureDate: {
                    $gte: today,
                    $lt: tomorrow
                }
            }),

            // Status breakdown
            this.schedulingModel.aggregate([
                {
                    $match: {
                        departureDate: {
                            $gte: today,
                            $lt: tomorrow
                        }
                    }
                },
                {
                    $group: {
                        _id: '$status',
                        count: { $sum: 1 }
                    }
                }
            ])
        ]);

        const statusCounts = {
            scheduled: 0,
            'in-progress': 0,
            completed: 0,
            cancelled: 0
        };

        statusBreakdown.forEach(item => {
            const status = item._id.toLowerCase();
            if (statusCounts.hasOwnProperty(status)) {
                statusCounts[status] = item.count;
            }
        });

        return {
            total: totalSchedulings,
            ...statusCounts
        };
    }

    /**
     * Get buses operating today with their scheduling count
     */
    async getBusesToday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const data = await this.schedulingModel.aggregate([
            {
                $match: {
                    departureDate: {
                        $gte: today,
                        $lt: tomorrow
                    }
                }
            },
            { $unwind: '$busIds' },
            {
                $lookup: {
                    from: 'buses',
                    localField: 'busIds',
                    foreignField: '_id',
                    as: 'busInfo'
                }
            },
            { $unwind: '$busInfo' },
            {
                $group: {
                    _id: '$busIds',
                    busName: { $first: '$busInfo.busNo' },
                    licensePlate: { $first: '$busInfo.plateNo' },
                    schedulingCount: { $sum: 1 }
                }
            },
            { $sort: { schedulingCount: -1 } },
            {
                $project: {
                    busId: '$_id',
                    busName: 1,
                    licensePlate: 1,
                    schedulingCount: 1,
                    _id: 0
                }
            }
        ]);

        return data;
    }

    /**
     * Get average seat occupancy trend
     */
    async getOccupancyTrend(days: number = 7) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        const data = await this.schedulingModel.aggregate([
            {
                $match: {
                    departureDate: { $gte: startDate }
                }
            },
            // Lookup buses to get total capacity
            {
                $lookup: {
                    from: 'buses',
                    localField: 'busIds',
                    foreignField: '_id',
                    as: 'buses'
                }
            },
            {
                $project: {
                    departureDate: 1,
                    bookedSeats: 1,
                    totalSeats: {
                        $sum: '$buses.vacancy'
                    }
                }
            },
            {
                $match: {
                    totalSeats: { $gt: 0 } // Only include schedulings with valid capacity
                }
            },
            {
                $project: {
                    date: {
                        $dateToString: { format: '%Y-%m-%d', date: '$departureDate' }
                    },
                    occupancyRate: {
                        $multiply: [
                            {
                                $divide: ['$bookedSeats', '$totalSeats']
                            },
                            100
                        ]
                    }
                }
            },
            {
                $group: {
                    _id: '$date',
                    avgOccupancy: { $avg: '$occupancyRate' }
                }
            },
            { $sort: { _id: 1 } },
            {
                $project: {
                    date: '$_id',
                    occupancy: { $round: ['$avgOccupancy', 2] },
                    _id: 0
                }
            }
        ]);

        return data;
    }

    /**
     * Get detailed schedulings for today with buses and routes info
     */
    async getSchedulingDetailsToday() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const schedulings = await this.schedulingModel
            .find({
                departureDate: {
                    $gte: today,
                    $lt: tomorrow
                }
            })
            .populate({
                path: 'routeId',
                select: 'name stationIds distance estimatedDuration',
                populate: {
                    path: 'stationIds',
                    select: 'name'
                }
            })
            .populate('busIds', 'busNo plateNo type vacancy')
            .sort({ etd: 1 })
            .lean();

        return schedulings.map(scheduling => {
            // Calculate total capacity from all buses
            const buses = (scheduling.busIds as any[]) || [];
            const totalSeats = buses.reduce((sum, bus) => sum + (bus.vacancy || 0), 0);
            const bookedSeats = scheduling.bookedSeats || 0;
            const occupancyRate = totalSeats > 0 ? ((bookedSeats / totalSeats) * 100).toFixed(2) : '0';

            const route = scheduling.routeId as any;
            const stations = route?.stationIds || [];
            const originStation = stations[0]?.name || 'N/A';
            const destinationStation = stations[stations.length - 1]?.name || 'N/A';

            return {
                _id: scheduling._id,
                departureDate: scheduling.departureDate,
                departureTime: scheduling.etd,
                arrivalTime: scheduling.eta || 'N/A',
                status: scheduling.status || 'scheduled',
                price: scheduling.price,
                totalSeats,
                availableSeats: scheduling.availableSeats,
                bookedSeats,
                occupancyRate,
                route: {
                    _id: route?._id,
                    name: route?.name || 'N/A',
                    originStation,
                    destinationStation,
                    distance: route?.distance || 0,
                    estimatedDuration: route?.estimatedDuration || 0,
                },
                buses: buses.map(bus => ({
                    _id: bus._id,
                    name: bus.busNo,
                    licensePlate: bus.plateNo,
                    type: bus.type,
                    capacity: bus.vacancy,
                })),
            };
        });
    }
}
