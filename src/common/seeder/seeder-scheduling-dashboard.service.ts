import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { faker } from '@faker-js/faker';
import { Scheduling } from '../../scheduling/entities/scheduling.entity';
import { SchedulingService } from '../../scheduling/scheduling.service';

/**
 * Service for creating additional schedulings specifically for today
 * to populate dashboard statistics
 */
@Injectable()
export class SeederSchedulingDashboardService {
    private readonly logger = new Logger(SeederSchedulingDashboardService.name);

    constructor(
        @InjectModel(Scheduling.name) private schedulingModel: Model<Scheduling>,
        @Inject(forwardRef(() => SchedulingService))
        private schedulingService: SchedulingService,
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

        let totalCreated = 0;
        let totalConflicts = 0;

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

                // Use SchedulingService.create() instead of direct DB creation
                const result = await this.schedulingService.create({
                    routeId: route._id.toString(),
                    busIds: [bus._id.toString()],
                    etd: departureTime,
                    eta: arrivalTime,
                    departureDate: today.toISOString().split('T')[0],
                    price: (route.basePrice || 100000) + faker.number.int({ min: -20000, max: 50000 }),
                    driver: {
                        name: faker.person.fullName(),
                        phone: this.generateVietnamesePhone(),
                        licenseNumber: faker.string.alphanumeric(10).toUpperCase(),
                    },
                });

                schedulings.push(result.scheduling);
                totalCreated++;

                if (result.conflicts && result.conflicts.length > 0) {
                    totalConflicts += result.conflicts.length;
                }

                // Log progress every 5 schedulings
                if ((i + 1) % 5 === 0) {
                    this.logger.log(`✨ Đã tạo ${i + 1}/${totalSchedulings} schedulings cho hôm nay...`);
                }
            } catch (error) {
                this.logger.error(`❌ Lỗi tạo scheduling ${i + 1}: ${error.message}`);
            }
        }

        this.logger.log(`✅ Đã tạo ${totalCreated} schedulings cho hôm nay (${totalConflicts} conflicts)`);
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
