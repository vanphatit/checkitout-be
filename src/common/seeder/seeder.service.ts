import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { faker } from '@faker-js/faker';
import * as XLSX from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';
import { Station } from '../../station/entities/station.entity';
import { Route } from '../../route/entities/route.entity';
import { Scheduling } from '../../scheduling/entities/scheduling.entity';
import { Bus } from '../../bus/entities/bus.entity';
import { Promotion } from '../../promotion/entities/promotion.entity';
import { Seat } from '../../seat/entities/seat.entity';
import { Ticket } from '../../ticket/entities/ticket.entity';
import { SchedulingSearchService } from '../../scheduling/services/scheduling-search.service';
import { SchedulingService } from '../../scheduling/scheduling.service';
import { SeederDashboardService } from './seeder-dashboard.service';
import { SeederSchedulingDashboardService } from './seeder-scheduling-dashboard.service';

@Injectable()
export class SeederService {
    private readonly logger = new Logger(SeederService.name);

    constructor(
        @InjectModel(Station.name) private stationModel: Model<Station>,
        @InjectModel(Route.name) private routeModel: Model<Route>,
        @InjectModel(Scheduling.name) private schedulingModel: Model<Scheduling>,
        @InjectModel(Bus.name) private busModel: Model<Bus>,
        @InjectModel(Promotion.name) private promotionModel: Model<Promotion>,
        @InjectModel(Seat.name) private seatModel: Model<Seat>,
        @InjectModel(Ticket.name) private ticketModel: Model<Ticket>,
        private schedulingSearchService: SchedulingSearchService,
        @Inject(forwardRef(() => SchedulingService))
        private schedulingService: SchedulingService,
        private seederDashboardService: SeederDashboardService,
        private seederSchedulingDashboardService: SeederSchedulingDashboardService,
    ) { }

    async seedAll(): Promise<void> {
        try {
            this.logger.log('🌱 Bắt đầu seed dữ liệu...');

            await this.clearData();

            const stations = await this.seedStations();
            this.logger.log(`✅ Đã tạo ${stations.length} trạm`);

            const buses = await this.seedBuses();
            this.logger.log(`✅ Đã tạo ${buses.length} xe buýt`);

            const routes = await this.seedRoutes(stations);
            this.logger.log(`✅ Đã tạo ${routes.length} tuyến đường`);

            const schedulings = await this.seedSchedulings(routes, buses);
            this.logger.log(`✅ Đã tạo ${schedulings.length} lịch trình`);

            // Create additional schedulings for today's dashboard
            const todaySchedulings = await this.seederSchedulingDashboardService.seedTodaySchedulings(routes, buses);

            // Merge all schedulings
            const allSchedulings = [...schedulings, ...todaySchedulings];

            const promotions = await this.seedPromotions(allSchedulings);
            this.logger.log(`✅ Đã tạo ${promotions.length} promotion(s)`);

            // Seed dashboard tickets with all schedulings
            const tickets = await this.seederDashboardService.seedTicketsForDashboard(allSchedulings);
            this.logger.log(`✅ Đã tạo ${tickets.length} tickets cho dashboard`);

            // Reindex Elasticsearch
            this.logger.log('🔄 Đồng bộ dữ liệu với Elasticsearch...');
            await this.schedulingSearchService.reindexAll();
            this.logger.log('✅ Đã đồng bộ với Elasticsearch');

            this.logger.log('🎉 Seed dữ liệu hoàn thành!');
        } catch (error) {
            this.logger.error('❌ Lỗi khi seed dữ liệu:', error);
            throw error;
        }
    }

    private async clearData(): Promise<void> {
        this.logger.log('🧹 Xóa dữ liệu cũ...');

        // Clear MongoDB
        await Promise.all([
            this.schedulingModel.deleteMany({}),
            this.routeModel.deleteMany({}),
            this.stationModel.deleteMany({}),
            this.busModel.deleteMany({}),
            this.promotionModel.deleteMany({}),
            this.seatModel.deleteMany({}),
            this.ticketModel.deleteMany({}),
        ]);

        // Clear Elasticsearch index
        try {
            this.logger.log('🧹 Xóa Elasticsearch index cũ...');
            await this.schedulingSearchService.clearIndex();
            this.logger.log('✅ Đã xóa Elasticsearch index');
        } catch (error) {
            this.logger.warn('⚠️ Không thể xóa Elasticsearch index (có thể chưa tồn tại):', error.message);
        }
    }

    private async seedPromotions(schedulings: any[]): Promise<any[]> {
        const promos: any[] = [];
        const now = new Date();

        // Create a few sample promotions
        for (let i = 0; i < 8; i++) {
            // start within next 10 days
            const start = new Date(now);
            start.setDate(now.getDate() + faker.number.int({ min: 0, max: 10 }));

            // expiry 3-20 days after start
            const expiry = new Date(start);
            expiry.setDate(start.getDate() + faker.number.int({ min: 3, max: 20 }));

            const promo = new this.promotionModel({
                name: `${faker.commerce.productAdjective()} Promo ${i + 1}`,
                startDate: start,
                expiryDate: expiry,
                value: faker.number.int({ min: 5, max: 50 }),
                createdBy: 'seeder',
            });

            promos.push(await promo.save());
        }

        return promos;
    }

    private async seedStations(): Promise<any[]> {
        const vietnamCities = [
            // South Vietnam - TP.HCM and surrounding
            {
                name: 'Bến xe Miền Đông',
                address: '292 Đinh Bộ Lĩnh, Bình Thạnh, TP.HCM',
                lat: 10.8142,
                lng: 106.7078,
            },
            {
                name: 'Bến xe Miền Tây',
                address: '395 Kinh Dương Vương, An Lạc, Bình Tân, TP.HCM',
                lat: 10.8231,
                lng: 106.6297,
            },
            {
                name: 'Bến xe An Sương',
                address: 'Quốc lộ 22, Tân Hưng Thuận, Quận 12, TP.HCM',
                lat: 10.8603,
                lng: 106.6192,
            },
            {
                name: 'Trạm Củ Chi',
                address: 'Củ Chi, TP.HCM',
                lat: 10.9736,
                lng: 106.4935,
            },
            {
                name: 'Trạm Bến Lức',
                address: 'Bến Lức, Long An',
                lat: 10.6456,
                lng: 106.4623,
            },
            {
                name: 'Bến xe Long An',
                address: 'Tân An, Long An',
                lat: 10.5359,
                lng: 106.4056,
            },
            {
                name: 'Bến xe Mỹ Tho',
                address: 'Ấp Bến Phà, Tân Long, Mỹ Tho, Tiền Giang',
                lat: 10.3599,
                lng: 106.3601,
            },
            {
                name: 'Trạm Cai Lậy',
                address: 'Cai Lậy, Tiền Giang',
                lat: 10.3739,
                lng: 106.1314,
            },
            {
                name: 'Bến xe Cần Thơ',
                address: '91 Nguyễn Trãi, An Phú, Ninh Kiều, Cần Thơ',
                lat: 10.0452,
                lng: 105.7469,
            },
            {
                name: 'Trạm Long Xuyên',
                address: 'Long Xuyên, An Giang',
                lat: 10.3861,
                lng: 105.4344,
            },

            // Đồng Nai - Bà Rịa Vũng Tàu
            {
                name: 'Bến xe Biên Hòa',
                address: 'Long Bình Tân, Biên Hòa, Đồng Nai',
                lat: 10.947,
                lng: 106.8233,
            },
            {
                name: 'Trạm Long Thành',
                address: 'Long Thành, Đồng Nai',
                lat: 10.7884,
                lng: 106.9794,
            },
            {
                name: 'Trạm Xuân Lộc',
                address: 'Xuân Lộc, Đồng Nai',
                lat: 10.9261,
                lng: 107.4102,
            },
            {
                name: 'Bến xe Vũng Tàu',
                address: '52 Nam Kỳ Khởi Nghĩa, Phường 1, Vũng Tàu',
                lat: 10.3459,
                lng: 107.0843,
            },
            {
                name: 'Trạm Bà Rịa',
                address: 'Bà Rịa, Bà Rịa - Vũng Tàu',
                lat: 10.5117,
                lng: 107.1839,
            },

            // Bình Dương - Bình Phước
            {
                name: 'Bến xe Bình Dương',
                address: 'QL13, Thủ Dầu Một, Bình Dương',
                lat: 10.9804,
                lng: 106.6519,
            },
            {
                name: 'Trạm Dầu Tiếng',
                address: 'Dầu Tiếng, Bình Dương',
                lat: 11.3644,
                lng: 106.4378,
            },
            {
                name: 'Trạm Chơn Thành',
                address: 'Chơn Thành, Bình Phước',
                lat: 11.4547,
                lng: 106.6022,
            },

            // South Central - Route to Dalat
            {
                name: 'Bến xe Đà Lạt',
                address: '1 Tô Hiến Thành, Phường 3, Đà Lạt',
                lat: 11.9404,
                lng: 108.4583,
            },
            {
                name: 'Trạm Di Linh',
                address: 'Di Linh, Lâm Đồng',
                lat: 11.5792,
                lng: 108.0867,
            },
            {
                name: 'Trạm Đức Trọng',
                address: 'Đức Trọng, Lâm Đồng',
                lat: 11.7436,
                lng: 108.3694,
            },

            // Bình Thuận - Ninh Thuận (QL1A South to Central)
            {
                name: 'Trạm Hàm Tân',
                address: 'Hàm Tân, Bình Thuận',
                lat: 10.7311,
                lng: 107.7236,
            },
            {
                name: 'Bến xe Phan Thiết',
                address: 'Hùng Vương, Phan Thiết, Bình Thuận',
                lat: 10.928,
                lng: 108.102,
            },
            {
                name: 'Trạm La Gi',
                address: 'La Gi, Bình Thuận',
                lat: 10.6633,
                lng: 107.7736,
            },
            {
                name: 'Trạm Thuận Nam',
                address: 'Thuận Nam, Ninh Thuận',
                lat: 11.2167,
                lng: 108.6167,
            },
            {
                name: 'Bến xe Phan Rang',
                address: 'Phan Rang-Tháp Chàm, Ninh Thuận',
                lat: 11.5676,
                lng: 108.9899,
            },
            {
                name: 'Trạm Ninh Phước',
                address: 'Ninh Phước, Ninh Thuận',
                lat: 11.8333,
                lng: 108.9833,
            },

            // Khánh Hòa
            {
                name: 'Bến xe Cam Ranh',
                address: 'Cam Ranh, Khánh Hòa',
                lat: 11.9214,
                lng: 109.1592,
            },
            {
                name: 'Bến xe Nha Trang',
                address: '58 Lê Hồng Phong, Phước Hòa, Nha Trang',
                lat: 12.2585,
                lng: 109.1967,
            },
            {
                name: 'Trạm Diên Khánh',
                address: 'Diên Khánh, Khánh Hòa',
                lat: 12.25,
                lng: 109.0667,
            },
            {
                name: 'Trạm Vạn Ninh',
                address: 'Vạn Ninh, Khánh Hòa',
                lat: 12.6833,
                lng: 109.1833,
            },

            // Phú Yên
            {
                name: 'Trạm Đông Hòa',
                address: 'Đông Hòa, Phú Yên',
                lat: 13.05,
                lng: 109.25,
            },
            {
                name: 'Bến xe Tuy Hòa',
                address: 'Tuy Hòa, Phú Yên',
                lat: 13.095,
                lng: 109.2967,
            },
            {
                name: 'Trạm Sông Cầu',
                address: 'Sông Cầu, Phú Yên',
                lat: 13.45,
                lng: 109.2167,
            },

            // Bình Định
            {
                name: 'Trạm Tuy Phước',
                address: 'Tuy Phước, Bình Định',
                lat: 13.5833,
                lng: 109.2,
            },
            {
                name: 'Bến xe Quy Nhơn',
                address: 'Trần Hưng Đạo, Quy Nhơn, Bình Định',
                lat: 13.783,
                lng: 109.2196,
            },
            {
                name: 'Trạm An Nhơn',
                address: 'An Nhơn, Bình Định',
                lat: 13.8667,
                lng: 109.1,
            },
            {
                name: 'Trạm Bồng Sơn',
                address: 'Bồng Sơn, Bình Định',
                lat: 14.1,
                lng: 108.9333,
            },

            // Quảng Ngãi
            {
                name: 'Trạm Đức Phổ',
                address: 'Đức Phổ, Quảng Ngãi',
                lat: 14.7167,
                lng: 108.9167,
            },
            {
                name: 'Bến xe Quảng Ngãi',
                address: 'Nguyễn Chánh, Quảng Ngãi',
                lat: 15.1214,
                lng: 108.8044,
            },
            {
                name: 'Trạm Bình Sơn',
                address: 'Bình Sơn, Quảng Ngãi',
                lat: 15.3167,
                lng: 108.8667,
            },

            // Quảng Nam
            {
                name: 'Trạm Núi Thành',
                address: 'Núi Thành, Quảng Nam',
                lat: 15.4833,
                lng: 108.7167,
            },
            {
                name: 'Bến xe Tam Kỳ',
                address: 'Tam Kỳ, Quảng Nam',
                lat: 15.5737,
                lng: 108.4745,
            },
            {
                name: 'Trạm Điện Bàn',
                address: 'Điện Bàn, Quảng Nam',
                lat: 15.8667,
                lng: 108.2167,
            },
            {
                name: 'Trạm Hội An',
                address: 'Hội An, Quảng Nam',
                lat: 15.8801,
                lng: 108.338,
            },

            // Đà Nẵng
            {
                name: 'Bến xe Đà Nẵng',
                address: '200 Tôn Đức Thắng, Hòa Minh, Liên Chiểu, Đà Nẵng',
                lat: 16.0544,
                lng: 108.2022,
            },

            // Thừa Thiên Huế
            {
                name: 'Trạm Phú Lộc',
                address: 'Phú Lộc, Thừa Thiên Huế',
                lat: 16.3,
                lng: 107.95,
            },
            {
                name: 'Bến xe Huế',
                address: 'An Cựu, Huế, Thừa Thiên Huế',
                lat: 16.4637,
                lng: 107.5909,
            },
            {
                name: 'Trạm Phong Điền',
                address: 'Phong Điền, Thừa Thiên Huế',
                lat: 16.4833,
                lng: 107.4167,
            },

            // Quảng Trị
            {
                name: 'Bến xe Đông Hà',
                address: 'Đông Hà, Quảng Trị',
                lat: 16.8198,
                lng: 107.1003,
            },
            {
                name: 'Trạm Gio Linh',
                address: 'Gio Linh, Quảng Trị',
                lat: 16.9833,
                lng: 107.0333,
            },

            // Quảng Bình
            {
                name: 'Bến xe Đồng Hới',
                address: 'Đồng Hới, Quảng Bình',
                lat: 17.4833,
                lng: 106.6167,
            },
            {
                name: 'Trạm Quảng Ninh',
                address: 'Quảng Ninh, Quảng Bình',
                lat: 17.6667,
                lng: 106.6333,
            },

            // Hà Tĩnh
            {
                name: 'Trạm Kỳ Anh',
                address: 'Kỳ Anh, Hà Tĩnh',
                lat: 18.05,
                lng: 106.2667,
            },
            {
                name: 'Bến xe Hà Tĩnh',
                address: 'Hà Tĩnh',
                lat: 18.3429,
                lng: 105.9053,
            },
            {
                name: 'Trạm Hồng Lĩnh',
                address: 'Hồng Lĩnh, Hà Tĩnh',
                lat: 18.5167,
                lng: 105.6833,
            },

            // Nghệ An
            {
                name: 'Trạm Đô Lương',
                address: 'Đô Lương, Nghệ An',
                lat: 18.8,
                lng: 105.4833,
            },
            {
                name: 'Bến xe Vinh',
                address: 'Lê Lợi, Vinh, Nghệ An',
                lat: 18.6791,
                lng: 105.681,
            },
            {
                name: 'Trạm Diễn Châu',
                address: 'Diễn Châu, Nghệ An',
                lat: 19.0167,
                lng: 105.5833,
            },
            {
                name: 'Trạm Quỳnh Lưu',
                address: 'Quỳnh Lưu, Nghệ An',
                lat: 19.2667,
                lng: 105.6667,
            },

            // Thanh Hóa
            {
                name: 'Trạm Tĩnh Gia',
                address: 'Tĩnh Gia, Thanh Hóa',
                lat: 19.6333,
                lng: 105.7667,
            },
            {
                name: 'Bến xe Thanh Hóa',
                address: 'Thanh Hóa',
                lat: 19.8067,
                lng: 105.7851,
            },
            {
                name: 'Trạm Bỉm Sơn',
                address: 'Bỉm Sơn, Thanh Hóa',
                lat: 20.0833,
                lng: 105.85,
            },

            // Ninh Bình - Nam Định
            {
                name: 'Bến xe Ninh Bình',
                address: 'Ninh Bình',
                lat: 20.2506,
                lng: 105.9745,
            },
            {
                name: 'Trạm Tam Điệp',
                address: 'Tam Điệp, Ninh Bình',
                lat: 20.2167,
                lng: 105.9167,
            },
            {
                name: 'Bến xe Nam Định',
                address: 'Nam Định',
                lat: 20.4388,
                lng: 106.1621,
            },
            {
                name: 'Trạm Giao Thủy',
                address: 'Giao Thủy, Nam Định',
                lat: 20.2833,
                lng: 106.4,
            },

            // Hà Nội
            {
                name: 'Bến xe Hà Nội',
                address: 'Giáp Bát, Hoàng Mai, Hà Nội',
                lat: 20.9735,
                lng: 105.8234,
            },
            {
                name: 'Bến xe Mỹ Đình',
                address: 'Mỹ Đình, Nam Từ Liêm, Hà Nội',
                lat: 21.0285,
                lng: 105.7805,
            },
            {
                name: 'Bến xe Nước Ngầm',
                address: 'Giáp Bát, Hoàng Mai, Hà Nội',
                lat: 20.9816,
                lng: 105.8367,
            },
            {
                name: 'Trạm Sơn Tây',
                address: 'Sơn Tây, Hà Nội',
                lat: 21.1333,
                lng: 105.5,
            },

            // Hưng Yên - Bắc Ninh - Bắc Giang
            {
                name: 'Trạm Hưng Yên',
                address: 'Hưng Yên',
                lat: 20.6464,
                lng: 106.0511,
            },
            {
                name: 'Bến xe Bắc Ninh',
                address: 'Bắc Ninh',
                lat: 21.1861,
                lng: 106.0763,
            },
            {
                name: 'Bến xe Bắc Giang',
                address: 'Bắc Giang',
                lat: 21.2819,
                lng: 106.1946,
            },
            {
                name: 'Trạm Lục Nam',
                address: 'Lục Nam, Bắc Giang',
                lat: 21.3167,
                lng: 106.4667,
            },

            // Hải Dương - Hải Phòng - Quảng Ninh
            {
                name: 'Bến xe Hải Dương',
                address: 'Hải Dương',
                lat: 20.9373,
                lng: 106.3148,
            },
            {
                name: 'Bến xe Hải Phòng',
                address: 'Hải Phòng',
                lat: 20.8449,
                lng: 106.6881,
            },
            {
                name: 'Trạm Uông Bí',
                address: 'Uông Bí, Quảng Ninh',
                lat: 21.0333,
                lng: 106.7667,
            },
            {
                name: 'Bến xe Hạ Long',
                address: 'Hạ Long, Quảng Ninh',
                lat: 20.9559,
                lng: 107.0447,
            },
            {
                name: 'Trạm Cẩm Phả',
                address: 'Cẩm Phả, Quảng Ninh',
                lat: 21.0167,
                lng: 107.3,
            },

            // Lạng Sơn - Cao Bằng
            {
                name: 'Trạm Bắc Sơn',
                address: 'Bắc Sơn, Lạng Sơn',
                lat: 21.6833,
                lng: 106.4667,
            },
            {
                name: 'Bến xe Lạng Sơn',
                address: 'Lạng Sơn',
                lat: 21.8537,
                lng: 106.7614,
            },
            {
                name: 'Trạm Cao Lộc',
                address: 'Cao Lộc, Lạng Sơn',
                lat: 21.9167,
                lng: 106.7833,
            },

            // Thái Nguyên
            {
                name: 'Bến xe Thái Nguyên',
                address: 'Thái Nguyên',
                lat: 21.5671,
                lng: 105.8252,
            },
            {
                name: 'Trạm Phổ Yên',
                address: 'Phổ Yên, Thái Nguyên',
                lat: 21.4167,
                lng: 105.8333,
            },

            // Lào Cai - Yên Bái
            {
                name: 'Bến xe Yên Bái',
                address: 'Yên Bái',
                lat: 21.7167,
                lng: 104.8667,
            },
            {
                name: 'Trạm Văn Chấn',
                address: 'Văn Chấn, Yên Bái',
                lat: 21.5833,
                lng: 104.6167,
            },
            {
                name: 'Bến xe Lào Cai',
                address: 'Lào Cai',
                lat: 22.4809,
                lng: 103.9754,
            },
            {
                name: 'Trạm Sa Pa',
                address: 'Sa Pa, Lào Cai',
                lat: 22.3364,
                lng: 103.8438,
            },
        ];

        const facilities = [
            'Toilet',
            'Canteen',
            'Parking',
            'WiFi',
            'ATM',
            'Waiting Room',
            'Air Conditioning',
            'Security',
            'Ticket Counter',
            'Baggage Storage',
        ];

        const stations: any[] = [];
        for (const cityData of vietnamCities) {
            const randomFacilities = faker.helpers.arrayElements(facilities, {
                min: 2,
                max: 6,
            });

            const station = new this.stationModel({
                name: cityData.name,
                address: cityData.address,
                location: {
                    type: 'Point',
                    coordinates: [cityData.lng, cityData.lat],
                },
                description: faker.lorem.sentences(2),
                contactPhone: this.generateVietnamesePhone(),
                operatingHours: '05:00 - 22:00',
                facilities: randomFacilities,
                isActive: true,
            });

            stations.push(await station.save());
        }

        return stations;
    }

    private async seedBuses(): Promise<any[]> {
        const busTypes = [
            { type: 'SLEEPER', seats: 34 }, // Giường nằm
            { type: 'SEATER', seats: 28 }, // Ghế ngồi
        ];

        const buses: any[] = [];
        let totalSeatsCreated = 0;

        for (let i = 0; i < 20; i++) {
            const busType = faker.helpers.arrayElement(busTypes);
            const licensePlate = this.generateLicensePlate();
            const busNo = `BUS${(i + 1).toString().padStart(3, '0')}`;

            const bus = new this.busModel({
                busNo,
                plateNo: licensePlate,
                type: busType.type,
                vacancy: busType.seats,
                status: faker.helpers.arrayElement(['AVAILABLE', 'UNAVAILABLE']),
                driverName: faker.person.fullName(),
                seats: [],
                images: [],
                createdBy: 'seeder',
            });

            const savedBus = await bus.save();

            // Create seats for this bus
            const seats = await this.createSeatsForBus(
                savedBus._id.toString(),
                busType.type,
                busType.seats,
            );
            savedBus.seats = seats.map((s) => s._id);
            await savedBus.save();

            totalSeatsCreated += seats.length;
            this.logger.log(
                `  ✓ Tạo ${seats.length} ghế cho xe ${busNo} (${busType.type})`,
            );

            buses.push(savedBus);
        }

        this.logger.log(
            `✅ Đã tạo ${totalSeatsCreated} ghế cho ${buses.length} xe buýt`,
        );
        return buses;
    }

    /**
     * Create seats for a bus based on type and capacity
     */
    private async createSeatsForBus(
        busId: string,
        busType: string,
        totalSeats: number,
    ): Promise<any[]> {
        const seats: any[] = [];

        if (busType === 'SLEEPER') {
            // Giường nằm: 34 chỗ, 2 tầng
            // Tầng 1 (Floor 1): A1-A17
            // Tầng 2 (Floor 2): B1-B17
            const floors = ['A', 'B'];
            for (let floor = 0; floor < floors.length; floor++) {
                for (let i = 1; i <= 17; i++) {
                    const seatNo = `${floors[floor]}${i}`;
                    const seat = new this.seatModel({
                        busId: new Types.ObjectId(busId),
                        seatNo,
                        floor: floor + 1,
                        status: 'EMPTY',
                        type: 'sleeper',
                        price: 0,
                    });
                    seats.push(await seat.save());
                }
            }
        } else {
            // Ghế ngồi: 28 chỗ, 1 tầng
            // A1-A28
            for (let i = 1; i <= totalSeats; i++) {
                const seatNo = `A${i}`;
                const seat = new this.seatModel({
                    busId: new Types.ObjectId(busId),
                    seatNo,
                    floor: 1,
                    status: 'EMPTY',
                    type: 'seat',
                    price: 0,
                });
                seats.push(await seat.save());
            }
        }

        return seats;
    }

    private async seedRoutes(stations: any[]): Promise<any[]> {
        const routes: any[] = [];
        const usedPairs = new Set<string>();

        for (let i = 0; i < 15; i++) {
            const departureStation = faker.helpers.arrayElement(stations);
            let arrivalStation = faker.helpers.arrayElement(stations);

            // Ensure different stations
            while (
                arrivalStation._id.toString() === departureStation._id.toString()
            ) {
                arrivalStation = faker.helpers.arrayElement(stations);
            }

            const pairKey = `${departureStation._id.toString()}-${arrivalStation._id.toString()}`;
            if (usedPairs.has(pairKey)) continue;
            usedPairs.add(pairKey);

            // Find intermediate stations based on geographic location
            const intermediateStations = this.findIntermediateStations(
                departureStation,
                arrivalStation,
                stations,
            );

            const stationIds = [
                departureStation._id,
                ...intermediateStations,
                arrivalStation._id,
            ];

            // Calculate actual distance based on stations
            const distanceKm = this.calculateRouteDistance(stationIds, stations);

            // Skip routes that are too long (over 2000km)
            if (distanceKm > 2000) {
                this.logger.warn(
                    `  ⚠️ Bỏ qua route quá dài: ${distanceKm.toFixed(0)}km`,
                );
                continue;
            }

            // Calculate duration: ~1.2 minutes per km, capped at 2880 minutes (48h)
            const calculatedDuration = Math.floor(distanceKm * 1.2);
            const estimatedDuration = Math.min(calculatedDuration, 2880);
            const etd = this.generateRandomTime();

            const route = new this.routeModel({
                name: `${departureStation.name.replace('Bến xe ', '')} - ${arrivalStation.name.replace('Bến xe ', '')}`,
                description: faker.lorem.sentence(),
                stationIds,
                distance: distanceKm,
                etd,
                estimatedDuration,
                basePrice: faker.number.int({ min: 80000, max: 300000 }),
                pricePerKm: faker.number.int({ min: 500, max: 2000 }),
                operatingHours: {
                    start: '05:00',
                    end: '22:00',
                },
                operatingDays: [
                    'monday',
                    'tuesday',
                    'wednesday',
                    'thursday',
                    'friday',
                    'saturday',
                    'sunday',
                ],
                isActive: true,
            });

            routes.push(await route.save());
        }

        return routes;
    }

    /**
     * Find intermediate stations between departure and arrival based on coordinates
     */
    private findIntermediateStations(
        departure: any,
        arrival: any,
        allStations: any[],
    ): any[] {
        const depCoords = departure.location.coordinates;
        const arrCoords = arrival.location.coordinates;

        // Filter out departure and arrival stations
        const candidates = allStations.filter(
            (s) =>
                s._id.toString() !== departure._id.toString() &&
                s._id.toString() !== arrival._id.toString(),
        );

        // Calculate which stations are "between" departure and arrival
        const stationsWithScore = candidates.map((station) => {
            const coords = station.location.coordinates;
            const score = this.calculateIntermediateScore(
                depCoords,
                arrCoords,
                coords,
            );
            return { station, score };
        });

        // Sort by score (lower is better - closer to the line between dep and arr)
        stationsWithScore.sort((a, b) => a.score - b.score);

        // Take 8-18 intermediate stations (for 10-20 total stations including dep/arr)
        const desiredIntermediate = faker.number.int({ min: 8, max: 18 });
        const numIntermediate = Math.min(desiredIntermediate, candidates.length);
        const selected = stationsWithScore.slice(0, numIntermediate);

        // Sort selected stations by distance from departure to maintain order
        selected.sort((a, b) => {
            const distA = this.calculateDistance(
                depCoords,
                a.station.location.coordinates,
            );
            const distB = this.calculateDistance(
                depCoords,
                b.station.location.coordinates,
            );
            return distA - distB;
        });

        return selected.map((s) => s.station._id);
    }

    /**
     * Calculate how "between" a point is relative to two other points
     * Lower score = more aligned with the line between dep and arr
     */
    private calculateIntermediateScore(
        depCoords: number[],
        arrCoords: number[],
        pointCoords: number[],
    ): number {
        const distDepToPoint = this.calculateDistance(depCoords, pointCoords);
        const distPointToArr = this.calculateDistance(pointCoords, arrCoords);
        const distDepToArr = this.calculateDistance(depCoords, arrCoords);

        // If point is roughly on the path, distDepToPoint + distPointToArr ≈ distDepToArr
        // Score = how much longer the detour is
        return distDepToPoint + distPointToArr - distDepToArr;
    }

    /**
     * Calculate distance between two coordinates (Haversine formula)
     */
    private calculateDistance(coords1: number[], coords2: number[]): number {
        const [lon1, lat1] = coords1;
        const [lon2, lat2] = coords2;

        const R = 6371; // Earth radius in km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;

        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);

        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    /**
     * Calculate total route distance through all stations
     */
    private calculateRouteDistance(
        stationIds: any[],
        allStations: any[],
    ): number {
        let totalDistance = 0;

        for (let i = 0; i < stationIds.length - 1; i++) {
            const station1 = allStations.find(
                (s) => s._id.toString() === stationIds[i].toString(),
            );
            const station2 = allStations.find(
                (s) => s._id.toString() === stationIds[i + 1].toString(),
            );

            if (station1 && station2) {
                const dist = this.calculateDistance(
                    station1.location.coordinates,
                    station2.location.coordinates,
                );
                totalDistance += dist;
            }
        }

        return Math.round(totalDistance);
    }

    private async seedSchedulings(routes: any[], buses: any[]): Promise<any[]> {
        const schedulings: any[] = [];
        const today = new Date();
        let totalCreated = 0;
        let totalConflicts = 0;

        for (let dayOffset = 0; dayOffset < 30; dayOffset++) {
            const currentDate = new Date(today);
            currentDate.setDate(today.getDate() + dayOffset);

            // Generate 3-8 schedulings per day
            const dailySchedulings = faker.number.int({ min: 3, max: 8 });

            for (let i = 0; i < dailySchedulings; i++) {
                const route = faker.helpers.arrayElement(routes);
                const bus = faker.helpers.arrayElement(buses);

                const departureTime = this.generateRandomTime();
                const [hours, minutes] = departureTime.split(':').map(Number);
                const durationInMinutes =
                    route.estimatedDuration || Math.floor((route.distance || 100) * 1.2);

                const arrivalDateTime = new Date(currentDate);
                arrivalDateTime.setHours(hours, minutes, 0, 0);
                arrivalDateTime.setMinutes(
                    arrivalDateTime.getMinutes() + durationInMinutes
                );

                const arrivalTime = `${arrivalDateTime
                    .getHours()
                    .toString()
                    .padStart(2, '0')}:${arrivalDateTime
                        .getMinutes()
                        .toString()
                        .padStart(2, '0')}`;

                try {
                    // Use SchedulingService.create() to trigger queue jobs
                    const result = await this.schedulingService.create({
                        routeId: route._id.toString(),
                        busIds: [bus._id.toString()],
                        etd: departureTime,
                        eta: arrivalTime,
                        departureDate: currentDate.toISOString().split('T')[0],
                        price:
                            (route.basePrice || 100000) +
                            faker.number.int({ min: -20000, max: 50000 }),
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
                        this.logger.warn(
                            `  ⚠️ Scheduling ${(result.scheduling as any)._id.toString()} created with ${result.conflicts.length} bus conflicts`
                        );
                    }

                    // Log progress every 50 schedulings
                    if (totalCreated % 50 === 0) {
                        this.logger.log(`  📊 Progress: ${totalCreated} schedulings created...`);
                    }
                } catch (error) {
                    this.logger.warn(
                        `  ⚠️ Failed to create scheduling for ${currentDate.toISOString().split('T')[0]} ${departureTime}: ${error.message}`
                    );
                }
            }
        }

        this.logger.log(`✅ Scheduling seeding complete: ${totalCreated} created, ${totalConflicts} bus conflicts detected`);
        return schedulings;
    }

    private generateVietnamesePhone(): string {
        const prefixes = [
            '090',
            '091',
            '094',
            '083',
            '084',
            '085',
            '081',
            '082',
            '032',
            '033',
            '034',
            '035',
            '036',
            '037',
            '038',
            '039',
        ];
        const prefix = faker.helpers.arrayElement(prefixes);
        const suffix = faker.string.numeric(7);
        return `${prefix}${suffix}`;
    }

    private generateLicensePlate(): string {
        const provinces = [
            '51A',
            '51B',
            '51C',
            '51D',
            '51E',
            '51F',
            '51G',
            '51H',
            '50A',
            '50B',
        ];
        const province = faker.helpers.arrayElement(provinces);
        const numbers = faker.string.numeric(5);
        return `${province}-${numbers}`;
    }

    private generateRandomTime(): string {
        const hour = faker.number.int({ min: 5, max: 21 });
        const minute = faker.helpers.arrayElement([0, 15, 30, 45]);
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }

    /**
     * Generate Excel template with sample data for scheduling import
     */
    async generateExcelTemplate(): Promise<void> {
        try {
            this.logger.log('📊 Tạo Excel template cho import lịch trình...');

            // Get existing data to create realistic examples
            const stations = await this.stationModel.find().limit(5).lean();
            const routes = await this.routeModel.find().limit(3).lean();
            const buses = await this.busModel.find().limit(3).lean();

            if (stations.length === 0 || routes.length === 0 || buses.length === 0) {
                this.logger.warn('⚠️ Chưa có dữ liệu cơ bản, cần seed data trước');
                return;
            }

            const templateData = [
                // Header row
                [
                    'Tên tuyến đường',
                    'Biển số xe',
                    'Ngày khởi hành',
                    'Giờ khởi hành',
                    'Giờ đến',
                    'Giá vé',
                    'Tên tài xế',
                    'SĐT tài xế',
                    'GPLX',
                    'Ghi chú',
                ],
                // Sample data rows
                [
                    (routes[0] as any).name || 'Sài Gòn - Cần Thơ',
                    (buses[0] as any).plateNo || '51B-12345',
                    '2025-12-25',
                    '08:00',
                    '12:30',
                    150000,
                    'Nguyễn Văn A',
                    '0987654321',
                    'B2-123456',
                    'Lịch trình thường',
                ],
                [
                    (routes[0] as any).name || 'Sài Gòn - Cần Thơ',
                    (buses[1] as any).plateNo || '51B-12346',
                    '2025-12-25',
                    '14:30',
                    '19:00',
                    150000,
                    'Trần Văn B',
                    '0987654322',
                    'B2-123457',
                    'Chuyến chiều',
                ],
                [
                    (routes[1] as any).name || 'TP.HCM - Đà Lạt',
                    (buses[2] as any).plateNo || '51C-78901',
                    '2025-12-26',
                    '06:30',
                    '13:30',
                    250000,
                    'Lê Văn C',
                    '0901234567',
                    'B2-789012',
                    'Lịch trình cuối tuần',
                ],
                [
                    (routes[2] as any).name || 'TP.HCM - Vũng Tàu',
                    (buses[0] as any).plateNo || '51B-12345',
                    '2025-12-26',
                    '16:00',
                    '18:30',
                    80000,
                    'Phạm Văn D',
                    '0912345678',
                    'B1-345678',
                    'Chuyến ngắn',
                ],
            ];

            // Create workbook and worksheet
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.aoa_to_sheet(templateData);

            // Set column widths
            worksheet['!cols'] = [
                { width: 25 }, // Tên tuyến đường
                { width: 15 }, // Biển số xe
                { width: 15 }, // Ngày khởi hành
                { width: 15 }, // Giờ khởi hành
                { width: 12 }, // Giờ đến
                { width: 12 }, // Giá vé
                { width: 20 }, // Tên tài xế
                { width: 15 }, // SĐT tài xế
                { width: 15 }, // GPLX
                { width: 25 }, // Ghi chú
            ];

            // Style header row
            const headerStyle = {
                font: { bold: true },
                fill: { fgColor: { rgb: '4472C4' } },
                alignment: { horizontal: 'center', vertical: 'center' },
            };

            // Apply header style
            const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1:J1');
            for (let col = range.s.c; col <= range.e.c; col++) {
                const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
                if (!worksheet[cellRef]) worksheet[cellRef] = { t: 's', v: '' };
                worksheet[cellRef].s = headerStyle;
            }

            XLSX.utils.book_append_sheet(workbook, worksheet, 'Lịch trình Import');

            // Create uploads directory if not exists
            const uploadsDir = path.join(process.cwd(), 'uploads', 'templates');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            // Save file
            const filePath = path.join(uploadsDir, 'lich_trinh_import_template.xlsx');
            XLSX.writeFile(workbook, filePath);

            this.logger.log(`✅ Đã tạo Excel template: ${filePath}`);
        } catch (error) {
            this.logger.error('❌ Lỗi tạo Excel template:', error);
            throw error;
        }
    }

    /**
     * Generate comprehensive Excel template with multiple scenarios
     */
    async generateComprehensiveExcelTemplate(): Promise<void> {
        try {
            this.logger.log('📊 Tạo Excel template đầy đủ với nhiều scenarios...');

            // Get real data
            const stations = await this.stationModel.find().lean();
            const routes = await this.routeModel.find().lean();
            const buses = await this.busModel.find().lean();

            if (!routes.length || !buses.length) {
                this.logger.warn(
                    '⚠️ Cần seed data trước khi tạo comprehensive template',
                );
                return;
            }

            // Create multiple sheets
            const workbook = XLSX.utils.book_new();

            // Sheet 1: Template với hướng dẫn
            const instructionData = [
                ['📋 HƯỚNG DẪN SỬ DỤNG TEMPLATE IMPORT LỊCH TRÌNH'],
                [''],
                ['✅ CÁC TRƯỜNG BẮT BUỘC:'],
                ['• Tên tuyến đường: Phải khớp với tuyến có sẵn trong hệ thống'],
                ['• Biển số xe: Phải khớp với xe có sẵn trong hệ thống'],
                ['• Ngày khởi hành: Định dạng YYYY-MM-DD (VD: 2025-12-25)'],
                ['• Giờ khởi hành: Định dạng HH:MM (VD: 08:30)'],
                [''],
                ['⚠️ LỮU Ý:'],
                ['• Giá vé để trống sẽ lấy giá mặc định từ tuyến đường'],
                ['• Số điện thoại tài xế phải đúng định dạng Việt Nam'],
                ['• Thời gian đến (ETA) có thể để trống, hệ thống sẽ tự tính'],
                [''],
                ['🚀 CÁCH SỬ DỤNG:'],
                ['1. Điền đầy đủ thông tin vào sheet "Import Data"'],
                ['2. Kiểm tra dữ liệu bằng API validate'],
                ['3. Thực hiện import qua API'],
                [''],
                ['📞 HỖ TRỢ: support@checkitout.com'],
            ];

            const instructionSheet = XLSX.utils.aoa_to_sheet(instructionData);
            instructionSheet['!cols'] = [{ width: 80 }];
            XLSX.utils.book_append_sheet(workbook, instructionSheet, 'Hướng dẫn');

            // Sheet 2: Available Routes Reference
            const routeData = [
                ['DANH SÁCH TUYẾN ĐƯỜNG CÓ SẴN', '', '', ''],
                ['STT', 'Tên tuyến đường', 'Giá cơ bản', 'Thời gian (phút)'],
                ...routes.map((route: any, index) => [
                    index + 1,
                    route.name,
                    route.basePrice || 'Chưa set',
                    route.estimatedDuration || 'Chưa set',
                ]),
            ];

            const routeSheet = XLSX.utils.aoa_to_sheet(routeData);
            routeSheet['!cols'] = [
                { width: 5 }, // STT
                { width: 35 }, // Tên tuyến
                { width: 15 }, // Giá
                { width: 15 }, // Thời gian
            ];
            XLSX.utils.book_append_sheet(workbook, routeSheet, 'Tuyến đường');

            // Sheet 3: Available Buses Reference
            const busData = [
                ['DANH SÁCH XE CÓ SẴN', '', '', ''],
                ['STT', 'Biển số xe', 'Loại xe', 'Số ghế'],
                ...buses.map((bus: any, index) => [
                    index + 1,
                    bus.plateNo,
                    bus.type,
                    bus.vacancy || 30,
                ]),
            ];

            const busSheet = XLSX.utils.aoa_to_sheet(busData);
            busSheet['!cols'] = [
                { width: 5 }, // STT
                { width: 15 }, // Biển số
                { width: 15 }, // Loại
                { width: 10 }, // Số ghế
            ];
            XLSX.utils.book_append_sheet(workbook, busSheet, 'Danh sách xe');

            // Sheet 4: Import Data Template
            const importTemplate = [
                [
                    'Tên tuyến đường',
                    'Biển số xe',
                    'Ngày khởi hành',
                    'Giờ khởi hành',
                    'Giờ đến',
                    'Giá vé',
                    'Tên tài xế',
                    'SĐT tài xế',
                    'GPLX',
                    'Ghi chú',
                ],
                // Sample realistic data
                ...this.generateSampleSchedulingData(routes, buses, 10),
            ];

            const importSheet = XLSX.utils.aoa_to_sheet(importTemplate);
            importSheet['!cols'] = [
                { width: 25 }, // Tên tuyến
                { width: 15 }, // Biển số
                { width: 15 }, // Ngày
                { width: 15 }, // Giờ đi
                { width: 12 }, // Giờ đến
                { width: 12 }, // Giá
                { width: 20 }, // Tài xế
                { width: 15 }, // SĐT
                { width: 15 }, // GPLX
                { width: 25 }, // Ghi chú
            ];
            XLSX.utils.book_append_sheet(workbook, importSheet, 'Import Data');

            // Save comprehensive template
            const uploadsDir = path.join(process.cwd(), 'uploads', 'templates');
            if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
            }

            const filePath = path.join(
                uploadsDir,
                'lich_trinh_comprehensive_template.xlsx',
            );
            XLSX.writeFile(workbook, filePath);

            this.logger.log(`✅ Đã tạo comprehensive Excel template: ${filePath}`);
        } catch (error) {
            this.logger.error('❌ Lỗi tạo comprehensive Excel template:', error);
            throw error;
        }
    }

    /**
     * Generate sample scheduling data for Excel template
     */
    private generateSampleSchedulingData(
        routes: any[],
        buses: any[],
        count: number = 10,
    ): any[][] {
        const data: any[][] = [];
        const today = new Date();

        for (let i = 0; i < count; i++) {
            const route = faker.helpers.arrayElement(routes);
            const bus = faker.helpers.arrayElement(buses);

            // Generate future dates
            const futureDate = new Date(today);
            futureDate.setDate(
                today.getDate() + faker.number.int({ min: 1, max: 30 }),
            );

            const departureTime = this.generateRandomTime();
            const [hours, minutes] = departureTime.split(':').map(Number);

            // Calculate ETA (add 2-6 hours)
            const travelHours = faker.number.int({ min: 2, max: 6 });
            const arrivalHour = (hours + travelHours) % 24;
            const arrivalTime = `${arrivalHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

            data.push([
                route.name,
                bus.plateNo,
                futureDate.toISOString().split('T')[0], // YYYY-MM-DD format
                departureTime,
                arrivalTime,
                (route.basePrice || 100000) +
                faker.number.int({ min: -20000, max: 50000 }),
                faker.person.fullName(),
                this.generateVietnamesePhone(),
                this.generateDriverLicense(),
                faker.helpers.arrayElement([
                    'Lịch trình thường ngày',
                    'Chuyến cuối tuần',
                    'Lịch trình đặc biệt',
                    'Chuyến du lịch',
                    '',
                    'Lịch trình linh hoạt',
                ]),
            ]);
        }

        return data;
    }

    /**
     * Generate Vietnamese driver license number
     */
    private generateDriverLicense(): string {
        const classes = ['B1', 'B2', 'C', 'D', 'E'];
        const licenseClass = faker.helpers.arrayElement(classes);
        const numbers = faker.string.numeric(6);
        return `${licenseClass}-${numbers}`;
    }

    /**
     * Seed Excel templates
     */
    async seedExcelTemplates(): Promise<void> {
        try {
            this.logger.log('📊 Bắt đầu seed Excel templates...');

            await this.generateExcelTemplate();
            await this.generateComprehensiveExcelTemplate();

            this.logger.log('✅ Đã tạo tất cả Excel templates!');
        } catch (error) {
            this.logger.error('❌ Lỗi seed Excel templates:', error);
            throw error;
        }
    }

    /**
     * Generate Excel template with REAL data from database
     */
    async generateRealDataExcelTemplate(): Promise<{
        fileName: string;
        filePath: string;
        stats: any;
    }> {
        try {
            this.logger.log('🔄 Fetching real data from database...');

            // Fetch real data from database
            const stations = await this.stationModel.find({}).exec();
            const routes = await this.routeModel
                .find({})
                .populate('startStation')
                .populate('endStation')
                .exec();
            const buses = await this.busModel.find({}).exec();
            const schedules = await this.schedulingModel
                .find({})
                .populate('route')
                .populate('bus')
                .exec();

            this.logger.log(
                `📊 Found real data: ${stations.length} stations, ${routes.length} routes, ${buses.length} buses, ${schedules.length} schedules`,
            );

            // If database is empty, generate large fake dataset
            if (stations.length < 10 || routes.length < 10 || buses.length < 10) {
                this.logger.warn(
                    '⚠️ Database has insufficient data, generating large fake dataset...',
                );
                return this.generateLargeFakeDataset();
            }

            // Create Excel with real data
            return this.createExcelWithRealData({
                stations,
                routes,
                buses,
                schedules,
            });
        } catch (error) {
            this.logger.error('❌ Error generating real data Excel:', error);
            throw error;
        }
    }

    /**
     * Generate large fake dataset if database is empty
     */
    private async generateLargeFakeDataset(): Promise<{
        fileName: string;
        filePath: string;
        stats: any;
    }> {
        const cities = [
            'TP.HCM',
            'Hà Nội',
            'Đà Nẵng',
            'Hải Phòng',
            'Cần Thơ',
            'Biên Hòa',
            'Huế',
            'Nha Trang',
            'Buôn Ma Thuột',
            'Thừa Thiên Huế',
            'Bắc Ninh',
            'Thanh Hóa',
            'Nghệ An',
            'Gia Lai',
            'Bình Dương',
            'Đồng Nai',
            'Khánh Hòa',
            'Lâm Đồng',
            'Bà Rịa-Vũng Tàu',
            'Long An',
            'Tiền Giang',
            'Bến Tre',
            'Trà Vinh',
            'Vĩnh Long',
            'An Giang',
            'Kiên Giang',
            'Sóc Trăng',
            'Bạc Liêu',
            'Cà Mau',
            'Đắk Lắk',
            'Đắk Nông',
            'Quảng Nam',
            'Quảng Ngãi',
        ];

        const districts = [
            'Quận 1',
            'Quận 2',
            'Quận 3',
            'Ba Đình',
            'Hoàn Kiếm',
            'Hai Bà Trưng',
            'Thanh Xuân',
            'Liên Chiểu',
            'Hải Châu',
            'Sơn Trà',
        ];

        // Generate 120+ stations
        const fakeStations: any[] = [];
        for (let i = 0; i < 125; i++) {
            const city = cities[i % cities.length];
            const district = districts[i % districts.length];
            fakeStations.push({
                _id: `station_${i + 1}`,
                name: `Bến xe ${city} - ${district}`,
                address: `Số ${Math.floor(Math.random() * 999) + 1} ${district}, ${city}`,
                city: city,
                coordinates: {
                    latitude: 10.762622 + (Math.random() - 0.5) * 10,
                    longitude: 106.660172 + (Math.random() - 0.5) * 10,
                },
                status: 'ACTIVE',
            });
        }

        // Generate 110+ routes
        const fakeRoutes: any[] = [];
        for (let i = 0; i < 115; i++) {
            const startIdx = Math.floor(Math.random() * fakeStations.length);
            let endIdx = Math.floor(Math.random() * fakeStations.length);
            while (endIdx === startIdx)
                endIdx = Math.floor(Math.random() * fakeStations.length);

            const startStation = fakeStations[startIdx];
            const endStation = fakeStations[endIdx];
            const distance = Math.floor(Math.random() * 800) + 50;
            const basePrice = Math.floor(distance * (150 + Math.random() * 100));

            fakeRoutes.push({
                _id: `route_${i + 1}`,
                name: `${startStation.city} - ${endStation.city}`,
                startStation: startStation,
                endStation: endStation,
                distance: distance,
                estimatedDuration: Math.floor((distance / 60) * 60),
                basePrice: basePrice,
                isActive: true,
            });
        }

        // Generate 85+ buses
        const fakeBuses: any[] = [];
        const busTypes = ['SLEEPER', 'SEATER', 'LIMOUSINE'];
        const provinces = [
            '51',
            '50',
            '30',
            '29',
            '43',
            '92',
            '65',
            '72',
            '81',
            '83',
        ];

        for (let i = 0; i < 85; i++) {
            const province = provinces[i % provinces.length];
            const letter = String.fromCharCode(65 + (i % 26));
            const number = String(10000 + i).padStart(5, '0');

            const busType = busTypes[i % busTypes.length];
            const seatCount =
                busType === 'SLEEPER'
                    ? 28 + (i % 6)
                    : busType === 'SEATER'
                        ? 40 + (i % 8)
                        : 20 + (i % 4);

            fakeBuses.push({
                _id: `bus_${i + 1}`,
                licensePlate: `${province}${letter}-${number}`,
                busType: busType,
                seatCount: seatCount,
                status: 'AVAILABLE',
                model: `Model ${busType} ${i + 1}`,
                year: 2018 + (i % 7),
            });
        }

        // Generate 150+ schedules
        const fakeSchedules: any[] = [];
        const driverNames = [
            'Nguyễn Văn An',
            'Trần Thị Bình',
            'Lê Văn Cường',
            'Phạm Thị Dung',
            'Hoàng Văn Em',
            'Võ Thị Phượng',
            'Đỗ Văn Giang',
            'Bùi Thị Hạnh',
            'Đinh Văn Inh',
            'Dương Thị Kim',
            'Lý Văn Long',
            'Mai Thị My',
            'Tô Văn Nam',
            'Chu Thị Oanh',
            'Vương Văn Phúc',
        ];

        for (let i = 0; i < 155; i++) {
            const route = fakeRoutes[i % fakeRoutes.length];
            const bus = fakeBuses[i % fakeBuses.length];
            const driverName = driverNames[i % driverNames.length];

            const baseDate = new Date();
            baseDate.setDate(baseDate.getDate() + (i % 90));

            const hours = 6 + (i % 16);
            const minutes = (i % 4) * 15;

            const departureTime = new Date(baseDate);
            departureTime.setHours(hours, minutes, 0, 0);

            const arrivalTime = new Date(departureTime);
            arrivalTime.setMinutes(
                arrivalTime.getMinutes() + route.estimatedDuration,
            );

            fakeSchedules.push({
                _id: `schedule_${i + 1}`,
                route: route,
                bus: bus,
                departureDate: baseDate.toISOString().split('T')[0],
                departureTime: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`,
                estimatedArrivalTime: `${arrivalTime.getHours().toString().padStart(2, '0')}:${arrivalTime.getMinutes().toString().padStart(2, '0')}`,
                price: route.basePrice + Math.floor(Math.random() * 50000),
                driverName: driverName,
                driverPhone: `09${Math.floor(Math.random() * 90000000) + 10000000}`,
                driverLicense: `B2-${Math.floor(Math.random() * 900000) + 100000}`,
                status: 'SCHEDULED',
                notes: `Chuyến ${i + 1} - ${route.name}`,
            });
        }

        return this.createExcelWithRealData({
            stations: fakeStations,
            routes: fakeRoutes,
            buses: fakeBuses,
            schedules: fakeSchedules,
        });
    }

    /**
     * Create Excel file with real/fake data
     */
    private async createExcelWithRealData(
        data: any,
    ): Promise<{ fileName: string; filePath: string; stats: any }> {
        const XLSX = require('xlsx');
        const workbook = XLSX.utils.book_new();

        // Create uploads directory if not exists
        const uploadsDir = path.join(process.cwd(), 'uploads', 'templates');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        // Sheet 1: Instructions
        const instructionData = [
            ['🚌 EXCEL IMPORT TEMPLATE - REAL DATA FROM DATABASE'],
            [''],
            ['📊 THỐNG KÊ DỮ LIỆU:'],
            [`📍 Stations: ${data.stations.length} bến xe`],
            [`🛣️ Routes: ${data.routes.length} tuyến đường`],
            [`🚌 Buses: ${data.buses.length} xe khách`],
            [`📅 Schedules: ${data.schedules.length} lịch trình reference`],
            [''],
            ['✅ HƯỚNG DẪN IMPORT:'],
            ['1. Xem dữ liệu thật ở các sheet reference'],
            ['2. Copy chính xác tên route và biển số xe'],
            ['3. Điền vào sheet "📊 Import Template"'],
            ['4. Validate qua API trước khi import'],
            ['5. Upload và import vào hệ thống'],
            [''],
            ['⚠️ LƯU Ý: Tất cả data đều THẬT từ database!'],
            ['🎯 Ready for production import với 100+ records!'],
        ];

        const instructionSheet = XLSX.utils.aoa_to_sheet(instructionData);
        instructionSheet['!cols'] = [{ width: 70 }];

        // Apply styling to instruction sheet
        if (instructionSheet['A1']) {
            instructionSheet['A1'].s = {
                font: {
                    bold: true,
                    size: 16,
                    color: { rgb: '1F4E79' },
                    name: 'Segoe UI',
                },
                fill: { fgColor: { rgb: 'E7F3FF' } },
                alignment: { horizontal: 'center', vertical: 'center' },
            };
        }

        XLSX.utils.book_append_sheet(workbook, instructionSheet, '📋 Instructions');

        // Sheet 2: Stations
        const stationData = [
            ['📍 STATIONS THẬT TRONG HỆ THỐNG', '', '', '', ''],
            ['STT', 'Tên Station', 'Thành phố', 'Địa chỉ', 'Trạng thái'],
        ];

        data.stations.forEach((station, index) => {
            stationData.push([
                index + 1,
                station.name,
                station.city,
                station.address,
                station.status === 'ACTIVE' ? '🟢 Active' : '🔴 Inactive',
            ]);
        });

        const stationSheet = XLSX.utils.aoa_to_sheet(stationData);
        stationSheet['!cols'] = [
            { width: 8 },
            { width: 40 },
            { width: 20 },
            { width: 50 },
            { width: 15 },
        ];

        // Apply header styling to station sheet
        for (let col = 0; col < 5; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: 1, c: col });
            if (stationSheet[cellRef]) {
                stationSheet[cellRef].s = {
                    font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Segoe UI' },
                    fill: { fgColor: { rgb: '2E75B6' } },
                    alignment: { horizontal: 'center', vertical: 'center' },
                };
            }
        }

        XLSX.utils.book_append_sheet(workbook, stationSheet, '📍 Stations');

        // Sheet 3: Routes
        const routeData = [
            ['🛣️ ROUTES THẬT - COPY CHÍNH XÁC TÊN', '', '', '', '', ''],
            ['STT', 'Tên Route (Copy this!)', 'Từ', 'Đến', 'KM', 'Giá (VNĐ)'],
        ];

        data.routes.forEach((route, index) => {
            const startName =
                route.startStation?.name || route.startStation?.city || 'Unknown';
            const endName =
                route.endStation?.name || route.endStation?.city || 'Unknown';
            const price =
                route.basePrice?.toLocaleString?.('vi-VN') || route.basePrice || 0;

            routeData.push([
                index + 1,
                route.name,
                startName,
                endName,
                route.distance || 0,
                price,
            ]);
        });

        const routeSheet = XLSX.utils.aoa_to_sheet(routeData);
        routeSheet['!cols'] = [
            { width: 8 },
            { width: 40 },
            { width: 25 },
            { width: 25 },
            { width: 12 },
            { width: 18 },
        ];

        // Apply header styling to route sheet
        for (let col = 0; col < 6; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: 1, c: col });
            if (routeSheet[cellRef]) {
                routeSheet[cellRef].s = {
                    font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Segoe UI' },
                    fill: { fgColor: { rgb: '2E75B6' } },
                    alignment: { horizontal: 'center', vertical: 'center' },
                };
            }
        }

        XLSX.utils.book_append_sheet(workbook, routeSheet, '🛣️ Routes');

        // Sheet 4: Buses
        const busData = [
            ['🚌 BUSES THẬT - COPY CHÍNH XÁC BIỂN SỐ', '', '', '', '', ''],
            ['STT', 'Biển số (Copy this!)', 'Loại', 'Ghế', 'Model', 'Status'],
        ];

        data.buses.forEach((bus, index) => {
            const typeEmoji =
                bus.busType === 'SLEEPER'
                    ? '🛏️'
                    : bus.busType === 'SEATER'
                        ? '💺'
                        : '🏪';
            busData.push([
                index + 1,
                bus.licensePlate,
                `${typeEmoji} ${bus.busType}`,
                bus.seatCount,
                bus.model || 'Standard',
                bus.status === 'AVAILABLE' ? '🟢 Ready' : '🔴 Busy',
            ]);
        });

        const busSheet = XLSX.utils.aoa_to_sheet(busData);
        busSheet['!cols'] = [
            { width: 8 },
            { width: 20 },
            { width: 20 },
            { width: 12 },
            { width: 20 },
            { width: 15 },
        ];

        // Apply header styling to bus sheet
        for (let col = 0; col < 6; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: 1, c: col });
            if (busSheet[cellRef]) {
                busSheet[cellRef].s = {
                    font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Segoe UI' },
                    fill: { fgColor: { rgb: '2E75B6' } },
                    alignment: { horizontal: 'center', vertical: 'center' },
                };
            }
        }

        XLSX.utils.book_append_sheet(workbook, busSheet, '🚌 Buses');

        // Sheet 5: Import Template (for user to fill)
        const importData = [
            [
                '🛣️ Tên Route',
                '🚌 Biển số',
                '📅 Ngày (YYYY-MM-DD)',
                '🕐 Giờ đi (HH:MM)',
                '🕒 Giờ đến',
                '💰 Giá',
                '👨‍✈️ Tài xế',
                '📞 SĐT',
                '🆔 GPLX',
                '📝 Ghi chú',
            ],
            ['ĐIỀN DỮ LIỆU VÀO ĐÂY ↓', '', '', '', '', '', '', '', '', ''],
        ];

        // Add 100 empty rows for input
        for (let i = 0; i < 100; i++) {
            importData.push(['', '', '', '', '', '', '', '', '', '']);
        }

        const importSheet = XLSX.utils.aoa_to_sheet(importData);
        importSheet['!cols'] = [
            { width: 35 },
            { width: 18 },
            { width: 20 },
            { width: 16 },
            { width: 14 },
            { width: 16 },
            { width: 22 },
            { width: 16 },
            { width: 16 },
            { width: 30 },
        ];

        // Style header
        for (let col = 0; col < 10; col++) {
            const cellRef = XLSX.utils.encode_cell({ r: 0, c: col });
            if (importSheet[cellRef]) {
                importSheet[cellRef].s = {
                    font: { bold: true, color: { rgb: 'FFFFFF' }, size: 12 },
                    fill: { fgColor: { rgb: '2E75B6' } },
                    alignment: {
                        horizontal: 'center',
                        vertical: 'center',
                        wrapText: true,
                    },
                };
            }
        }

        // Style instruction row
        const instructionRowRef = XLSX.utils.encode_cell({ r: 1, c: 0 });
        if (importSheet[instructionRowRef]) {
            importSheet[instructionRowRef].s = {
                font: { bold: true, color: { rgb: 'FF6B35' }, size: 11 },
                fill: { fgColor: { rgb: 'FFF0E6' } },
                alignment: { horizontal: 'center', vertical: 'center' },
            };
        }

        XLSX.utils.book_append_sheet(workbook, importSheet, '📊 Import Template');

        // Save file
        const timestamp = new Date().getTime();
        const fileName = `checkitout_real_data_${timestamp}.xlsx`;
        const filePath = path.join(uploadsDir, fileName);
        XLSX.writeFile(workbook, filePath);

        this.logger.log(`✅ Created Excel with real data: ${fileName}`);

        return {
            fileName,
            filePath,
            stats: {
                stations: data.stations.length,
                routes: data.routes.length,
                buses: data.buses.length,
                schedules: data.schedules.length,
            },
        };
    }
}
