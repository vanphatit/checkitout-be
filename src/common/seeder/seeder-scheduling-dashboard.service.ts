import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { faker } from '@faker-js/faker';
import { Scheduling } from '../../scheduling/entities/scheduling.entity';

/**
 * Service for creating additional schedulings specifically for today
 * to populate dashboard statistics
 */
@Injectable()
export class SeederSchedulingDashboardService {
    private readonly logger = new Logger(SeederSchedulingDashboardService.name);

    constructor(
        @InjectModel(Scheduling.name) private schedulingModel: Model<Scheduling>,
    ) { }

    /**
     * Create additional schedulings for today to ensure dashboard has data
     * @param routes Array of routes
     * @param buses Array of buses
     * @returns Promise<Scheduling[]> Created schedulings
     */
    async seedTodaySchedulings(routes: any[], buses: any[]): Promise<any[]> {
        this.logger.log('📅 Bắt đầu seed schedulings cho hôm nay...');

        if (routes.length === 0 || buses.length === 0) {
            this.logger.warn('⚠️ Không có routes hoặc buses, bỏ qua seed schedulings hôm nay');
            return [];
        }

        const schedulings: any[] = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Create 10-15 schedulings for today with varied times
        const totalSchedulings = faker.number.int({ min: 10, max: 15 });
        this.logger.log(`🎯 Sẽ tạo ${totalSchedulings} schedulings cho hôm nay`);

        // Status distribution for today: 40% scheduled, 30% in-progress, 30% completed
        const statusWeights = [
            { status: 'scheduled' as const, weight: 0.40 },
            { status: 'in-progress' as const, weight: 0.30 },
            { status: 'completed' as const, weight: 0.30 },
        ];

        for (let i = 0; i < totalSchedulings; i++) {
            try {
                const route = faker.helpers.arrayElement(routes);
                const bus = faker.helpers.arrayElement(buses);

                // Generate departure time throughout the day
                const hours = faker.number.int({ min: 5, max: 22 });
                const minutes = faker.helpers.arrayElement([0, 15, 30, 45]);
                const departureTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

                const durationInMinutes = route.estimatedDuration || Math.floor((route.distance || 100) * 1.2);

                // Create departure datetime for today
                const departureDateTime = new Date(today);
                departureDateTime.setHours(hours, minutes, 0, 0);

                // Calculate arrival time
                const arrivalDateTime = new Date(departureDateTime);
                arrivalDateTime.setMinutes(arrivalDateTime.getMinutes() + durationInMinutes);

                const arrivalTime = `${arrivalDateTime.getHours().toString().padStart(2, '0')}:${arrivalDateTime.getMinutes().toString().padStart(2, '0')}`;

                // Determine status based on current time
                const now = new Date();
                let status: 'scheduled' | 'in-progress' | 'completed';

                if (departureDateTime > now) {
                    status = 'scheduled';
                } else if (arrivalDateTime < now) {
                    status = 'completed';
                } else {
                    status = 'in-progress';
                }

                // For realistic distribution, override with weighted random
                const statusRand = Math.random();
                let cumulative = 0;
                for (const sw of statusWeights) {
                    cumulative += sw.weight;
                    if (statusRand < cumulative) {
                        status = sw.status;
                        break;
                    }
                }

                // Calculate seats
                const totalSeats = bus.vacancy || bus.seats?.length || 0;
                let bookedSeats = 0;

                if (status === 'completed') {
                    // Completed trips: high booking rate (70-100%)
                    bookedSeats = faker.number.int({ min: Math.floor(totalSeats * 0.7), max: totalSeats });
                } else if (status === 'in-progress') {
                    // In-progress: medium booking rate (50-90%)
                    bookedSeats = faker.number.int({ min: Math.floor(totalSeats * 0.5), max: Math.floor(totalSeats * 0.9) });
                } else {
                    // Scheduled: low to medium booking rate (0-60%)
                    bookedSeats = faker.number.int({ min: 0, max: Math.floor(totalSeats * 0.6) });
                }

                const scheduling = new this.schedulingModel({
                    routeId: route._id.toString(),
                    busId: bus._id.toString(),
                    busIds: [bus._id.toString()],
                    etd: departureTime,
                    eta: arrivalTime,
                    departureDate: departureDateTime,
                    arrivalDate: arrivalDateTime,
                    price: (route.basePrice || 100000) + faker.number.int({ min: -20000, max: 50000 }),
                    driver: {
                        name: faker.person.fullName(),
                        phone: this.generateVietnamesePhone(),
                        licenseNumber: faker.string.alphanumeric(10).toUpperCase(),
                    },
                    status: status,
                    availableSeats: Math.max(totalSeats - bookedSeats, 0),
                    bookedSeats,
                    estimatedDuration: durationInMinutes,
                    isActive: true,
                });

                const saved = await scheduling.save();
                schedulings.push(saved);

                // Log progress every 5 schedulings
                if ((i + 1) % 5 === 0) {
                    this.logger.log(`✨ Đã tạo ${i + 1}/${totalSchedulings} schedulings cho hôm nay...`);
                }
            } catch (error) {
                this.logger.error(`❌ Lỗi tạo scheduling ${i + 1}: ${error.message}`);
            }
        }

        this.logger.log(`✅ Đã tạo ${schedulings.length} schedulings cho hôm nay`);
        this.logSchedulingDistribution(schedulings);

        return schedulings;
    }

    /**
     * Log scheduling distribution by status
     */
    private logSchedulingDistribution(schedulings: any[]): void {
        const distribution = schedulings.reduce((acc, s) => {
            acc[s.status] = (acc[s.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        this.logger.log(`📊 Phân bố schedulings hôm nay:`);
        Object.entries(distribution).forEach(([status, count]) => {
            this.logger.log(`   - ${status}: ${count}`);
        });
    }

    /**
     * Generate Vietnamese phone number
     */
    private generateVietnamesePhone(): string {
        const prefixes = ['032', '033', '034', '035', '036', '037', '038', '039', '056', '058', '059', '070', '076', '077', '078', '079', '081', '082', '083', '084', '085', '086', '088', '089', '090', '091', '092', '093', '094', '096', '097', '098', '099'];
        const prefix = faker.helpers.arrayElement(prefixes);
        const suffix = faker.string.numeric(7);
        return `${prefix}${suffix}`;
    }
}
