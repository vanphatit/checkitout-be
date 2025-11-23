import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Scheduling, SchedulingDocument } from './entities/scheduling.entity';
import { Route, RouteDocument } from '../route/entities/route.entity';
import { Bus, BusDocument } from '../bus/entities/bus.entity';
import { CreateSchedulingDto, UpdateSchedulingDto, CreateBulkSchedulingDto } from './dto/scheduling.dto';

@Injectable()
export class SchedulingService {
    constructor(
        @InjectModel(Scheduling.name) private schedulingModel: Model<SchedulingDocument>,
        @InjectModel(Route.name) private routeModel: Model<RouteDocument>,
        @InjectModel(Bus.name) private busModel: Model<BusDocument>,
    ) { }

    async create(createSchedulingDto: CreateSchedulingDto): Promise<Scheduling> {
        // Validate route exists
        const route = await this.routeModel.findById(createSchedulingDto.routeId).exec();
        if (!route) {
            throw new NotFoundException('Không tìm thấy tuyến đường');
        }

        // Validate buses exist and are available
        await this.validateBuses(createSchedulingDto.busIds, createSchedulingDto.departureDate, createSchedulingDto.etd);

        // Calculate available seats from buses
        const buses = await this.busModel.find({
            _id: { $in: createSchedulingDto.busIds.map(id => new Types.ObjectId(id)) }
        }).exec();

        const totalSeats = buses.reduce((sum, bus) => {
            const seatCount = bus.seats?.length || bus.vacancy || 0;
            return sum + seatCount;
        }, 0);

        const primaryBusId = createSchedulingDto.busIds[0];

        // Calculate ETA if not provided
        let eta = createSchedulingDto.eta;
        let arrivalDate = createSchedulingDto.arrivalDate;

        if (!eta && route.estimatedDuration) {
            const etdMinutes = this.timeToMinutes(createSchedulingDto.etd);
            const etaMinutes = etdMinutes + route.estimatedDuration;
            eta = this.minutesToTime(etaMinutes);

            // If ETA is next day
            if (etaMinutes >= 24 * 60) {
                const departureDate = new Date(createSchedulingDto.departureDate);
                departureDate.setDate(departureDate.getDate() + 1);
                arrivalDate = departureDate.toISOString().split('T')[0];
                eta = this.minutesToTime(etaMinutes - 24 * 60);
            } else {
                arrivalDate = createSchedulingDto.departureDate;
            }
        }

        const newScheduling = new this.schedulingModel({
            ...createSchedulingDto,
            routeId: new Types.ObjectId(createSchedulingDto.routeId),
            busId: primaryBusId ? new Types.ObjectId(primaryBusId) : undefined,
            busIds: createSchedulingDto.busIds.map(id => new Types.ObjectId(id)),
            departureDate: new Date(createSchedulingDto.departureDate),
            arrivalDate: arrivalDate ? new Date(arrivalDate) : undefined,
            eta,
            availableSeats: totalSeats,
            estimatedDuration: route.estimatedDuration,
            recurringEndDate: createSchedulingDto.recurringEndDate ? new Date(createSchedulingDto.recurringEndDate) : undefined,
        });

        return await newScheduling.save();
    }

    async createBulk(createBulkDto: CreateBulkSchedulingDto): Promise<Scheduling[]> {
        const { startDate, endDate, recurringDays, ...baseScheduling } = createBulkDto;

        const start = new Date(startDate);
        const end = new Date(endDate);
        const schedules: CreateSchedulingDto[] = [];

        // Generate schedules for each day in the range that matches recurring days
        for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
            const dayName = this.getDayName(date.getDay());

            if (recurringDays.includes(dayName)) {
                schedules.push({
                    ...baseScheduling,
                    departureDate: date.toISOString().split('T')[0],
                    isRecurring: true,
                    recurringDays,
                    recurringEndDate: endDate,
                });
            }
        }

        // Create all schedules
        const createdSchedules: Scheduling[] = [];
        for (const scheduleDto of schedules) {
            try {
                const schedule = await this.create(scheduleDto);
                createdSchedules.push(schedule);
            } catch (error) {
                // Log error but continue with other schedules
                console.error(`Failed to create schedule for ${scheduleDto.departureDate}:`, error.message);
            }
        }

        return createdSchedules;
    }

    async findAll(filters?: {
        routeId?: string;
        date?: string;
        status?: string;
    }): Promise<Scheduling[]> {
        const query: any = { isActive: true };

        if (filters?.routeId) {
            query.routeId = new Types.ObjectId(filters.routeId);
        }

        if (filters?.date) {
            const filterDate = new Date(filters.date);
            const nextDay = new Date(filterDate);
            nextDay.setDate(nextDay.getDate() + 1);

            query.departureDate = {
                $gte: filterDate,
                $lt: nextDay
            };
        }

        if (filters?.status) {
            query.status = filters.status;
        }

        return await this.schedulingModel
            .find(query)
            .populate('routeId', 'name distance estimatedDuration')
            .populate('busIds', 'plateNumber seats status type')
            .sort({ departureDate: 1, etd: 1 })
            .exec();
    }

    async findOne(id: string): Promise<Scheduling> {
        const scheduling = await this.schedulingModel
            .findById(id)
            .populate('routeId')
            .populate('busIds')
            .exec();

        if (!scheduling) {
            throw new NotFoundException('Không tìm thấy lịch trình');
        }

        return scheduling;
    }

    async update(id: string, updateSchedulingDto: UpdateSchedulingDto): Promise<Scheduling> {
        if (updateSchedulingDto.busIds && updateSchedulingDto.departureDate && updateSchedulingDto.etd) {
            await this.validateBuses(
                updateSchedulingDto.busIds,
                updateSchedulingDto.departureDate,
                updateSchedulingDto.etd,
                id
            );
        }

        const updateData: any = { ...updateSchedulingDto };

        if (updateSchedulingDto.routeId) {
            updateData.routeId = updateSchedulingDto.routeId;
        }

        if (updateSchedulingDto.busIds) {
            updateData.busIds = updateSchedulingDto.busIds;
            updateData.busId = updateSchedulingDto.busIds[0];

            // Recalculate available seats
            const buses = await this.busModel.find({
                _id: { $in: updateSchedulingDto.busIds.map(id => new Types.ObjectId(id)) }
            }).exec();

            const totalSeats = buses.reduce((sum, bus) => {
                const seatCount = bus.seats?.length || bus.vacancy || 0;
                return sum + seatCount;
            }, 0);
            const currentScheduling = await this.schedulingModel.findById(id).exec();
            updateData.totalSeats = totalSeats;
            updateData.availableSeats = totalSeats - (currentScheduling?.bookedSeats || 0);
        }

        if (updateSchedulingDto.departureDate) {
            updateData.departureDate = updateSchedulingDto.departureDate;
        }

        if (updateSchedulingDto.arrivalDate) {
            updateData.arrivalDate = updateSchedulingDto.arrivalDate;
        }

        if (updateSchedulingDto.recurringEndDate) {
            updateData.recurringEndDate = updateSchedulingDto.recurringEndDate;
        }

        const updatedScheduling = await this.schedulingModel
            .findByIdAndUpdate(id, updateData, { new: true })
            .populate('routeId')
            .populate('busIds')
            .exec();

        if (!updatedScheduling) {
            throw new NotFoundException('Không tìm thấy lịch trình');
        }

        return updatedScheduling;
    }

    async remove(id: string): Promise<void> {
        const result = await this.schedulingModel
            .findByIdAndUpdate(id, { isActive: false }, { new: true })
            .exec();

        if (!result) {
            throw new NotFoundException('Không tìm thấy lịch trình');
        }
    }

    async findByRoute(routeId: string, date?: string): Promise<Scheduling[]> {
        const query: any = {
            routeId: new Types.ObjectId(routeId),
            isActive: true
        };

        if (date) {
            const filterDate = new Date(date);
            const nextDay = new Date(filterDate);
            nextDay.setDate(nextDay.getDate() + 1);

            query.departureDate = {
                $gte: filterDate,
                $lt: nextDay
            };
        }

        return await this.schedulingModel
            .find(query)
            .populate('routeId')
            .populate('busIds')
            .sort({ etd: 1 })
            .exec();
    }

    async findAvailable(routeId: string, date: string): Promise<Scheduling[]> {
        return await this.schedulingModel
            .find({
                routeId: new Types.ObjectId(routeId),
                departureDate: {
                    $gte: new Date(date),
                    $lt: new Date(new Date(date).getTime() + 24 * 60 * 60 * 1000)
                },
                status: 'scheduled',
                availableSeats: { $gt: 0 },
                isActive: true
            })
            .populate('routeId')
            .populate('busIds')
            .sort({ etd: 1 })
            .exec();
    }

    async updateSeatCount(id: string, bookedSeats: number): Promise<Scheduling> {
        const scheduling = await this.schedulingModel.findById(id).exec();
        if (!scheduling) {
            throw new NotFoundException('Không tìm thấy lịch trình');
        }

        const buses = await this.busModel.find({
            _id: { $in: scheduling.busIds }
        }).exec();

        const totalSeats = buses.reduce((sum, bus) => sum + (bus.seats?.length || 0), 0);
        const availableSeats = Math.max(0, totalSeats - bookedSeats);

        const result = await this.schedulingModel
            .findByIdAndUpdate(
                id,
                {
                    bookedSeats,
                    availableSeats
                },
                { new: true }
            )
            .populate('routeId')
            .populate('busIds')
            .exec();

        if (!result) {
            throw new NotFoundException('Không thể cập nhật lịch trình');
        }

        return result;
    }

    private async validateBuses(busIds: string[], date: string, time: string, excludeSchedulingId?: string): Promise<void> {
        // Check if buses exist
        const buses = await this.busModel.find({
            _id: { $in: busIds.map(id => new Types.ObjectId(id)) },
            status: { $ne: 'MAINTENANCE' }
        }).exec();

        if (buses.length !== busIds.length) {
            throw new BadRequestException('Một hoặc nhiều xe không tồn tại hoặc đang bảo trì');
        }

        // Check if buses are available at the given time
        const conflictQuery: any = {
            busIds: { $in: busIds.map(id => new Types.ObjectId(id)) },
            departureDate: new Date(date),
            status: { $nin: ['cancelled', 'completed'] },
            isActive: true
        };

        if (excludeSchedulingId) {
            conflictQuery._id = { $ne: new Types.ObjectId(excludeSchedulingId) };
        }

        const conflictingSchedules = await this.schedulingModel.find(conflictQuery).exec();

        if (conflictingSchedules.length > 0) {
            throw new BadRequestException('Một hoặc nhiều xe đã được lập lịch cho thời gian này');
        }
    }

    private timeToMinutes(time: string): number {
        const [hours, minutes] = time.split(':').map(Number);
        return hours * 60 + minutes;
    }

    private minutesToTime(minutes: number): string {
        const hours = Math.floor(minutes / 60) % 24;
        const mins = minutes % 60;
        return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
    }

    private getDayName(dayIndex: number): string {
        const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        return days[dayIndex];
    }
}
