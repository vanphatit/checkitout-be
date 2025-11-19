import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { faker } from '@faker-js/faker';
import { Station } from '../../station/entities/station.entity';
import { Route } from '../../route/entities/route.entity';
import { Scheduling } from '../../scheduling/entities/scheduling.entity';
import { Bus } from '../../bus/entities/bus.entity';

@Injectable()
export class SeederService {
    private readonly logger = new Logger(SeederService.name);

    constructor(
        @InjectModel(Station.name) private stationModel: Model<Station>,
        @InjectModel(Route.name) private routeModel: Model<Route>,
        @InjectModel(Scheduling.name) private schedulingModel: Model<Scheduling>,
        @InjectModel(Bus.name) private busModel: Model<Bus>,
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

            this.logger.log('🎉 Seed dữ liệu hoàn thành!');
        } catch (error) {
            this.logger.error('❌ Lỗi khi seed dữ liệu:', error);
            throw error;
        }
    }

    private async clearData(): Promise<void> {
        this.logger.log('🧹 Xóa dữ liệu cũ...');
        await Promise.all([
            this.schedulingModel.deleteMany({}),
            this.routeModel.deleteMany({}),
            this.stationModel.deleteMany({}),
            this.busModel.deleteMany({}),
        ]);
    }

    private async seedStations(): Promise<any[]> {
        const vietnamCities = [
            { name: 'Bến xe Miền Đông', address: '292 Đinh Bộ Lĩnh, Bình Thạnh, TP.HCM', lat: 10.8142, lng: 106.7078 },
            { name: 'Bến xe Miền Tây', address: '395 Kinh Dương Vương, An Lạc, Bình Tân, TP.HCM', lat: 10.8231, lng: 106.6297 },
            { name: 'Bến xe An Sương', address: 'Quốc lộ 22, Tân Hưng Thuận, Quận 12, TP.HCM', lat: 10.8603, lng: 106.6192 },
            { name: 'Bến xe Cần Thơ', address: '91 Nguyễn Trãi, An Phú, Ninh Kiều, Cần Thơ', lat: 10.0452, lng: 105.7469 },
            { name: 'Bến xe Mỹ Tho', address: 'Ấp Bến Phà, Tân Long, Mỹ Tho, Tiền Giang', lat: 10.3599, lng: 106.3601 },
            { name: 'Bến xe Vũng Tàu', address: '52 Nam Kỳ Khởi Nghĩa, Phường 1, Vũng Tàu', lat: 10.3459, lng: 107.0843 },
            { name: 'Bến xe Đà Lạt', address: '1 Tô Hiến Thành, Phường 3, Đà Lạt', lat: 11.9404, lng: 108.4583 },
            { name: 'Bến xe Nha Trang', address: '58 Lê Hồng Phong, Phước Hòa, Nha Trang', lat: 12.2585, lng: 109.1967 },
            { name: 'Bến xe Hà Nội', address: 'Giáp Bát, Hoàng Mai, Hà Nội', lat: 20.9735, lng: 105.8234 },
            { name: 'Bến xe Đà Nẵng', address: '200 Tôn Đức Thắng, Hòa Minh, Liên Chiểu, Đà Nẵng', lat: 16.0544, lng: 108.2022 },
        ];

        const facilities = [
            'Toilet', 'Canteen', 'Parking', 'WiFi', 'ATM',
            'Waiting Room', 'Air Conditioning', 'Security',
            'Ticket Counter', 'Baggage Storage'
        ];

        const stations: any[] = [];
        for (const cityData of vietnamCities) {
            const randomFacilities = faker.helpers.arrayElements(facilities, { min: 2, max: 6 });

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
            { type: 'giường nằm', seats: 34 },
            { type: 'ghế ngồi', seats: 45 },
            { type: 'limousine', seats: 28 },
            { type: 'VIP', seats: 24 },
        ];

        const buses: any[] = [];
        for (let i = 0; i < 20; i++) {
            const busType = faker.helpers.arrayElement(busTypes);
            const licensePlate = this.generateLicensePlate();

            // Generate seats
            const seats: any[] = [];
            for (let j = 1; j <= busType.seats; j++) {
                seats.push({
                    seatNumber: j.toString().padStart(2, '0'),
                    isAvailable: true,
                    price: faker.number.int({ min: 80000, max: 200000 }),
                });
            }

            const bus = new this.busModel({
                licensePlate,
                type: busType.type,
                capacity: busType.seats,
                status: faker.helpers.arrayElement(['active', 'maintenance', 'inactive']),
                seats,
                facilities: faker.helpers.arrayElements([
                    'WiFi', 'Air Conditioning', 'USB Charging', 'Reclining Seats',
                    'Blanket', 'Water', 'Toilet', 'TV/Entertainment'
                ], { min: 2, max: 5 }),
                driver: {
                    name: faker.person.fullName(),
                    phone: this.generateVietnamesePhone(),
                    licenseNumber: faker.string.alphanumeric(10).toUpperCase(),
                },
                isActive: true,
            });

            buses.push(await bus.save());
        }

        return buses;
    }

    private async seedRoutes(stations: any[]): Promise<any[]> {
        const routes: any[] = [];
        const usedPairs = new Set<string>();

        for (let i = 0; i < 15; i++) {
            const departureStation = faker.helpers.arrayElement(stations);
            let arrivalStation = faker.helpers.arrayElement(stations);

            // Ensure different stations
            while (arrivalStation._id.toString() === departureStation._id.toString()) {
                arrivalStation = faker.helpers.arrayElement(stations);
            }

            const pairKey = `${departureStation._id.toString()}-${arrivalStation._id.toString()}`;
            if (usedPairs.has(pairKey)) continue;
            usedPairs.add(pairKey);

            // Randomly add intermediate stations
            const intermediateStations: any[] = [];
            if (faker.datatype.boolean(0.3)) {
                const availableStations = stations.filter((s: any) =>
                    s._id.toString() !== departureStation._id.toString() && s._id.toString() !== arrivalStation._id.toString()
                );
                if (availableStations.length > 0) {
                    intermediateStations.push(faker.helpers.arrayElement(availableStations)._id.toString());
                }
            }

            const distance = faker.number.int({ min: 50000, max: 500000 }); // 50km - 500km in meters
            const duration = Math.floor(distance / 1000 * 1.2); // ~1.2 minutes per km

            const route = new this.routeModel({
                name: `${departureStation.name.replace('Bến xe ', '')} - ${arrivalStation.name.replace('Bến xe ', '')}`,
                description: faker.lorem.sentence(),
                departureStationId: departureStation._id.toString(),
                arrivalStationId: arrivalStation._id.toString(),
                intermediateStations,
                distance,
                duration,
                basePrice: faker.number.int({ min: 80000, max: 300000 }),
                pricePerKm: faker.number.int({ min: 500, max: 2000 }),
                operatingHours: {
                    start: '05:00',
                    end: '22:00',
                },
                operatingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
                isActive: true,
            });

            routes.push(await route.save());
        }

        return routes;
    }

    private async seedSchedulings(routes: any[], buses: any[]): Promise<any[]> {
        const schedulings: any[] = [];
        const today = new Date();

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
                const durationInMinutes = route.duration || 120;

                const arrivalMinutes = hours * 60 + minutes + durationInMinutes;
                const arrivalHours = Math.floor(arrivalMinutes / 60) % 24;
                const arrivalMins = arrivalMinutes % 60;
                const arrivalTime = `${arrivalHours.toString().padStart(2, '0')}:${arrivalMins.toString().padStart(2, '0')}`;

                let arrivalDate = new Date(currentDate);
                if (arrivalMinutes >= 24 * 60) {
                    arrivalDate.setDate(arrivalDate.getDate() + 1);
                }

                const totalSeats = bus.seats?.length || 0;
                const bookedSeats = faker.number.int({ min: 0, max: Math.floor(totalSeats * 0.8) });

                const scheduling = new this.schedulingModel({
                    routeId: route._id.toString(),
                    busId: bus._id.toString(),
                    departureTime,
                    arrivalTime,
                    departureDate: currentDate.toISOString().split('T')[0],
                    arrivalDate: arrivalDate.toISOString().split('T')[0],
                    price: (route.basePrice || 100000) + faker.number.int({ min: -20000, max: 50000 }),
                    driver: {
                        name: faker.person.fullName(),
                        phone: this.generateVietnamesePhone(),
                        licenseNumber: faker.string.alphanumeric(10).toUpperCase(),
                    },
                    status: faker.helpers.arrayElement(['scheduled', 'in-transit', 'completed', 'cancelled']),
                    totalSeats,
                    bookedSeats,
                    availableSeats: totalSeats - bookedSeats,
                    isActive: true,
                });

                schedulings.push(await scheduling.save());
            }
        }

        return schedulings;
    }

    private generateVietnamesePhone(): string {
        const prefixes = ['090', '091', '094', '083', '084', '085', '081', '082', '032', '033', '034', '035', '036', '037', '038', '039'];
        const prefix = faker.helpers.arrayElement(prefixes);
        const suffix = faker.string.numeric(7);
        return `${prefix}${suffix}`;
    }

    private generateLicensePlate(): string {
        const provinces = ['51A', '51B', '51C', '51D', '51E', '51F', '51G', '51H', '50A', '50B'];
        const province = faker.helpers.arrayElement(provinces);
        const numbers = faker.string.numeric(5);
        return `${province}-${numbers}`;
    }

    private generateRandomTime(): string {
        const hour = faker.number.int({ min: 5, max: 21 });
        const minute = faker.helpers.arrayElement([0, 15, 30, 45]);
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
    }
}