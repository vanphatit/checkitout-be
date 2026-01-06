import { Injectable, NotFoundException, BadRequestException, Inject, forwardRef, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Scheduling, SchedulingDocument } from './entities/scheduling.entity';
import { Route, RouteDocument } from '../route/entities/route.entity';
import { Bus, BusDocument } from '../bus/entities/bus.entity';
import { CreateSchedulingDto, UpdateSchedulingDto, CreateBulkSchedulingDto } from './dto/scheduling.dto';
import { SchedulingSearchService } from './services/scheduling-search.service';
import { SchedulingQueueService } from './scheduling-queue.service';

export interface BusConflict {
    busId: string;
    plateNo: string;
    message: string;
}

export interface CreateSchedulingResponse {
    scheduling: Scheduling;
    conflicts?: BusConflict[];
    message?: string;
}

export interface BulkSchedulingResponse {
    schedules: Scheduling[];
    totalConflicts: number;
    conflictDetails: Array<{
        date: string;
        conflicts: BusConflict[];
    }>;
}

@Injectable()
export class SchedulingService {
    private readonly logger = new Logger(SchedulingService.name);

    constructor(
        @InjectModel(Scheduling.name) private schedulingModel: Model<SchedulingDocument>,
        @InjectModel(Route.name) private routeModel: Model<RouteDocument>,
        @InjectModel(Bus.name) private busModel: Model<BusDocument>,
        @Inject(forwardRef(() => SchedulingSearchService))
        private schedulingSearchService: SchedulingSearchService,
        private schedulingQueueService: SchedulingQueueService,
    ) { }

    async create(createSchedulingDto: CreateSchedulingDto): Promise<CreateSchedulingResponse> {
        // Validate route exists
        const route = await this.routeModel.findById(createSchedulingDto.routeId).exec();
        if (!route) {
            throw new NotFoundException('Không tìm thấy tuyến đường');
        }

        // Validate buses exist and are available (pass route for duration calculation)
        const { validBusIds, conflicts } = await this.validateBuses(
            createSchedulingDto.busIds,
            createSchedulingDto.departureDate,
            createSchedulingDto.etd,
            undefined,
            route.estimatedDuration
        );

        // If no valid buses, throw error
        if (validBusIds.length === 0) {
            throw new BadRequestException(
                `Không có xe nào khả dụng. ${conflicts.map(c => c.message).join('. ')}`
            );
        }

        // Use only valid buses
        const finalBusIds = validBusIds;

        // Calculate available seats from buses
        const buses = await this.busModel.find({
            _id: { $in: finalBusIds.map(id => new Types.ObjectId(id)) }
        }).exec();

        const totalSeats = buses.reduce((sum, bus) => {
            const seatCount = bus.seats?.length || bus.vacancy || 0;
            return sum + seatCount;
        }, 0);

        const primaryBusId = finalBusIds[0];

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

        // Calculate initial status based on departure/arrival times
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const departureDay = new Date(createSchedulingDto.departureDate);
        departureDay.setHours(0, 0, 0, 0);
        
        const etdDate = this.combineDateAndTime(new Date(createSchedulingDto.departureDate), createSchedulingDto.etd);
        const etaDate = eta && arrivalDate ? this.combineDateAndTime(new Date(arrivalDate), eta) : null;

        let initialStatus = 'scheduled';
        
        // Nếu ngày khởi hành đã qua (không phải hôm nay) → completed
        if (departureDay < today) {
            initialStatus = 'completed';
        }
        // Nếu là hôm nay hoặc tương lai, check theo giờ
        else if (etaDate && etaDate < now) {
            initialStatus = 'completed';  // Đã qua giờ đến
        } else if (etdDate < now) {
            initialStatus = 'in-progress';  // Đã khởi hành, chưa đến
        }

        const newScheduling = new this.schedulingModel({
            ...createSchedulingDto,
            routeId: new Types.ObjectId(createSchedulingDto.routeId),
            busId: primaryBusId ? new Types.ObjectId(primaryBusId) : undefined,
            busIds: finalBusIds.map(id => new Types.ObjectId(id)),
            departureDate: new Date(createSchedulingDto.departureDate),
            arrivalDate: arrivalDate ? new Date(arrivalDate) : undefined,
            eta,
            availableSeats: totalSeats,
            estimatedDuration: route.estimatedDuration,
            recurringEndDate: createSchedulingDto.recurringEndDate ? new Date(createSchedulingDto.recurringEndDate) : undefined,
            status: initialStatus,
        });

        const saved = await newScheduling.save();

        // Log warnings if some buses were excluded
        if (conflicts.length > 0) {
            this.logger.warn(`Created scheduling with ${validBusIds.length}/${createSchedulingDto.busIds.length} buses. Conflicts: ${conflicts.map(c => c.message).join(', ')}`);
        }

        // Add delayed jobs for status transitions (only for future schedulings)
        try {
            if (saved.eta && initialStatus === 'scheduled') {
                const etdDate = this.combineDateAndTime(saved.departureDate, saved.etd);
                const etaDate = this.combineDateAndTime(saved.arrivalDate || saved.departureDate, saved.eta);

                // Only add queue jobs if ETD is in the future
                if (etdDate > now) {
                    await this.schedulingQueueService.addSchedulingJobs(
                        (saved._id as Types.ObjectId).toString(),
                        etdDate,
                        etaDate,
                    );
                }
            }
        } catch (error) {
            this.logger.error(`Failed to add queue jobs for scheduling ${saved._id}:`, error);
        }

        // Index to Elasticsearch
        try {
            const populated = await this.schedulingModel
                .findById(saved._id)
                .populate('routeId', 'name')
                .exec();
            await this.schedulingSearchService.indexScheduling(populated);
        } catch (error) {
            this.logger.error('Failed to index scheduling to Elasticsearch:', error);
        }

        // Return scheduling with conflicts info
        return {
            scheduling: saved,
            conflicts: conflicts.length > 0 ? conflicts : undefined,
            message: conflicts.length > 0
                ? `Đã tạo lịch trình với ${validBusIds.length}/${createSchedulingDto.busIds.length} xe. ${conflicts.length} xe không khả dụng.`
                : undefined
        };
    }

    async createBulk(createBulkDto: CreateBulkSchedulingDto): Promise<BulkSchedulingResponse> {
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

        // Create all schedules and collect conflicts
        const createdSchedules: Scheduling[] = [];
        const conflictDetails: Array<{ date: string; conflicts: BusConflict[] }> = [];
        let totalConflicts = 0;

        for (const scheduleDto of schedules) {
            try {
                const result = await this.create(scheduleDto);
                createdSchedules.push(result.scheduling);

                if (result.conflicts && result.conflicts.length > 0) {
                    conflictDetails.push({
                        date: scheduleDto.departureDate,
                        conflicts: result.conflicts
                    });
                    totalConflicts += result.conflicts.length;
                }
            } catch (error) {
                // Log error but continue with other schedules
                console.error(`Failed to create schedule for ${scheduleDto.departureDate}:`, error.message);
            }
        }

        return {
            schedules: createdSchedules,
            totalConflicts,
            conflictDetails
        };
    }

    async findAll(filters?: {
        routeId?: string;
        date?: string;
        status?: string;
        includeDeleted?: boolean;
    }): Promise<Scheduling[]> {
        const query: any = {};

        // Only filter by isDeleted if not including deleted items
        if (!filters?.includeDeleted) {
            query.isDeleted = false;
        }

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
            .populate('busIds', 'plateNo seats status type')
            .sort({ departureDate: 1, etd: 1 })
            .exec();
    }

    async findOne(id: string): Promise<Scheduling> {
        const scheduling = await this.schedulingModel
            .findById(id)
            .populate({
                path: 'routeId',
                populate: {
                    path: 'stationIds',
                    select: 'name address location isActive'
                }
            })
            .populate('busIds')
            .exec();

        if (!scheduling) {
            throw new NotFoundException('Không tìm thấy lịch trình');
        }

        return scheduling;
    }

    async findByIds(ids: string[], includeDeleted = false): Promise<Scheduling[]> {
        const query: any = {
            _id: { $in: ids.map(id => new Types.ObjectId(id)) }
        };

        // Only filter by isDeleted if not including deleted items
        if (!includeDeleted) {
            query.isDeleted = false;
        }

        return await this.schedulingModel
            .find(query)
            .populate({
                path: 'routeId',
                populate: {
                    path: 'stationIds',
                    select: 'name address location isActive'
                }
            })
            .populate('busIds')
            .sort({ departureDate: 1, etd: 1 })
            .exec();
    }

    async update(id: string, updateSchedulingDto: UpdateSchedulingDto): Promise<Scheduling> {
        const existingScheduling = await this.schedulingModel.findById(id).populate('routeId').exec();
        if (!existingScheduling) {
            throw new NotFoundException('Không tìm thấy lịch trình');
        }

        // Get route for duration if updating bus/time
        let estimatedDuration = existingScheduling.estimatedDuration;
        if (updateSchedulingDto.routeId) {
            const route = await this.routeModel.findById(updateSchedulingDto.routeId).exec();
            if (route) {
                estimatedDuration = route.estimatedDuration;
            }
        } else if ((existingScheduling.routeId as any).estimatedDuration) {
            estimatedDuration = (existingScheduling.routeId as any).estimatedDuration;
        }

        if (updateSchedulingDto.busIds && updateSchedulingDto.departureDate && updateSchedulingDto.etd) {
            const { validBusIds, conflicts } = await this.validateBuses(
                updateSchedulingDto.busIds,
                updateSchedulingDto.departureDate,
                updateSchedulingDto.etd,
                id,
                estimatedDuration
            );

            if (validBusIds.length === 0) {
                throw new BadRequestException(
                    `Không có xe nào khả dụng. ${conflicts.map(c => `${c.plateNo}: ${c.message}`).join(', ')}`
                );
            }

            // Use only valid buses
            updateSchedulingDto.busIds = validBusIds;

            if (conflicts.length > 0) {
                this.logger.warn(`Updated scheduling with ${validBusIds.length}/${updateSchedulingDto.busIds.length} buses. Conflicts: ${conflicts.map(c => c.message).join(', ')}`);
            }
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
            .populate({
                path: 'routeId',
                populate: { path: 'stationIds', select: 'name address location isActive' }
            })
            .populate('busIds')
            .exec();

        if (!updatedScheduling) {
            throw new NotFoundException('Không tìm thấy lịch trình');
        }

        // Update queue jobs if ETD or ETA changed
        try {
            const hasTimeChange = updateSchedulingDto.etd || updateSchedulingDto.eta ||
                updateSchedulingDto.departureDate || updateSchedulingDto.arrivalDate;

            if (hasTimeChange && updatedScheduling.eta) {
                const etdDate = this.combineDateAndTime(
                    updatedScheduling.departureDate,
                    updatedScheduling.etd
                );
                const etaDate = this.combineDateAndTime(
                    updatedScheduling.arrivalDate || updatedScheduling.departureDate,
                    updatedScheduling.eta
                );

                await this.schedulingQueueService.updateSchedulingJobs(
                    (updatedScheduling._id as Types.ObjectId).toString(),
                    etdDate,
                    etaDate,
                );
            }
        } catch (error) {
            this.logger.error(`Failed to update queue jobs for scheduling ${id}:`, error);
        }

        // Update in Elasticsearch
        try {
            await this.schedulingSearchService.updateScheduling(id, updatedScheduling);
        } catch (error) {
            this.logger.warn(`Failed to update scheduling ${id} in Elasticsearch: ${error.message}`);
        }

        return updatedScheduling;
    }

    async remove(id: string): Promise<void> {
        const scheduling = await this.schedulingModel.findById(id).exec();

        if (!scheduling) {
            throw new NotFoundException('Không tìm thấy lịch trình');
        }

        if (scheduling.isDeleted) {
            throw new BadRequestException('Lịch trình đã bị xóa trước đó');
        }

        // Check if there are any tickets for this scheduling
        // Note: Assuming you have Ticket model - adjust import and model name as needed
        // const ticketCount = await this.ticketModel.countDocuments({ schedulingId: id, status: { $ne: 'cancelled' } }).exec();
        // if (ticketCount > 0) {
        //     throw new BadRequestException(`Không thể xóa lịch trình này vì có ${ticketCount} vé đang sử dụng`);
        // }

        // Soft delete - set isDeleted to true
        const result = await this.schedulingModel
            .findByIdAndUpdate(id, {
                isDeleted: true,
                isActive: false,
                status: 'cancelled'
            }, { new: true })
            .exec();

        if (!result) {
            throw new NotFoundException('Không tìm thấy lịch trình');
        }

        // Remove queue jobs since scheduling is cancelled
        try {
            await this.schedulingQueueService.removeSchedulingJobs(id);
        } catch (error) {
            this.logger.error(`Failed to remove queue jobs for scheduling ${id}:`, error);
        }

        // Try to remove from Elasticsearch
        try {
            await this.schedulingSearchService.deleteScheduling(id);
        } catch (error) {
            this.logger.warn(`Failed to delete scheduling ${id} from Elasticsearch: ${error.message}`);
        }
    }

    async restore(id: string): Promise<Scheduling> {
        const scheduling = await this.schedulingModel.findById(id).exec();

        if (!scheduling) {
            throw new NotFoundException('Không tìm thấy lịch trình');
        }

        if (!scheduling.isDeleted) {
            throw new BadRequestException('Lịch trình chưa bị xóa');
        }

        // Restore - set isDeleted to false
        const result = await this.schedulingModel
            .findByIdAndUpdate(id, {
                isDeleted: false,
                isActive: true,
                status: 'scheduled'
            }, { new: true })
            .populate({
                path: 'routeId',
                populate: { path: 'stationIds', select: 'name address location isActive' }
            })
            .populate('busIds')
            .exec();

        if (!result) {
            throw new NotFoundException('Không tìm thấy lịch trình');
        }

        // Try to reindex in Elasticsearch
        try {
            await this.schedulingSearchService.indexScheduling(result);
        } catch (error) {
            this.logger.warn(`Failed to reindex scheduling ${id} in Elasticsearch: ${error.message}`);
        }

        return result;
    }

    async getStats(): Promise<any> {
        const [total, active, inactive, deleted, scheduled, inProgress, completed, cancelled] = await Promise.all([
            this.schedulingModel.countDocuments({}).exec(),
            this.schedulingModel.countDocuments({ isActive: true, isDeleted: false }).exec(),
            this.schedulingModel.countDocuments({ isActive: false, isDeleted: false }).exec(),
            this.schedulingModel.countDocuments({ isDeleted: true }).exec(),
            this.schedulingModel.countDocuments({ status: 'scheduled', isDeleted: false }).exec(),
            this.schedulingModel.countDocuments({ status: 'in-progress', isDeleted: false }).exec(),
            this.schedulingModel.countDocuments({ status: 'completed', isDeleted: false }).exec(),
            this.schedulingModel.countDocuments({ status: 'cancelled', isDeleted: false }).exec(),
        ]);

        return {
            total,
            active,
            inactive,
            deleted,
            scheduled,
            inProgress,
            completed,
            cancelled,
            delayed: total - scheduled - inProgress - completed - cancelled - deleted
        };
    }

    async findByRoute(routeId: string, date?: string): Promise<Scheduling[]> {
        const query: any = {
            routeId: routeId, // Use string directly, not ObjectId
            isDeleted: false,
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
            .populate({
                path: 'routeId',
                populate: { path: 'stationIds', select: 'name address location isActive' }
            })
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
                isDeleted: false,
                isActive: true
            })
            .populate({
                path: 'routeId',
                populate: { path: 'stationIds', select: 'name address location isActive' }
            })
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
            .populate({
                path: 'routeId',
                populate: { path: 'stationIds', select: 'name address location isActive' }
            })
            .populate('busIds')
            .exec();

        if (!result) {
            throw new NotFoundException('Không thể cập nhật lịch trình');
        }

        // Update seat count in Elasticsearch
        try {
            await this.schedulingSearchService.updateScheduling(id, result);
        } catch (error) {
            this.logger.warn(`Failed to update seat count for scheduling ${id} in Elasticsearch: ${error.message}`);
        }

        return result;
    }

    private async validateBuses(
        busIds: string[],
        date: string,
        time: string,
        excludeSchedulingId?: string,
        newTripDuration?: number
    ): Promise<{ validBusIds: string[], conflicts: Array<{ busId: string, plateNo: string, message: string }> }> {
        const conflicts: Array<{ busId: string, plateNo: string, message: string }> = [];

        // Check if buses exist
        const buses = await this.busModel.find({
            _id: { $in: busIds.map(id => new Types.ObjectId(id)) },
        }).exec();

        const foundBusIds = buses.map(b => (b._id as Types.ObjectId).toString());
        const missingBusIds = busIds.filter(id => !foundBusIds.includes(id));

        // Add missing buses to conflicts
        missingBusIds.forEach(id => {
            conflicts.push({
                busId: id,
                plateNo: 'Unknown',
                message: `Xe không tồn tại hoặc đã bị xóa`
            });
        });

        // Check maintenance status (using string comparison since BusStatus enum values are strings)
        const validBuses = buses.filter(b => b.status && b.status.toString() !== 'MAINTENANCE');
        const maintenanceBuses = buses.filter(b => b.status && b.status.toString() === 'MAINTENANCE');

        maintenanceBuses.forEach(b => {
            conflicts.push({
                busId: (b._id as Types.ObjectId).toString(),
                plateNo: b.plateNo,
                message: `Xe đang bảo trì`
            });
        });

        if (validBuses.length === 0) {
            return { validBusIds: [], conflicts };
        }

        // Check if buses are available at the given time (check for time overlaps)
        const departureDate = new Date(date);
        departureDate.setHours(0, 0, 0, 0);

        const nextDate = new Date(departureDate);
        nextDate.setDate(nextDate.getDate() + 1);

        const previousDate = new Date(departureDate);
        previousDate.setDate(previousDate.getDate() - 1);

        console.log('📅 Date validation:', {
            inputDate: date,
            departureDate: departureDate.toISOString(),
            nextDate: nextDate.toISOString(),
            previousDate: previousDate.toISOString()
        });

        // Find all schedulings that could potentially overlap
        const conflictQuery: any = {
            busIds: { $in: validBuses.map(b => b._id) },
            status: { $nin: ['cancelled', 'completed'] },
            isDeleted: false,
            isActive: true,
            $or: [
                {
                    departureDate: { $gte: departureDate, $lt: nextDate }
                },
                {
                    departureDate: { $gte: previousDate, $lt: departureDate },
                    arrivalDate: { $gte: departureDate }
                }
            ]
        };

        if (excludeSchedulingId) {
            conflictQuery._id = { $ne: new Types.ObjectId(excludeSchedulingId) };
        }

        const conflictingSchedules = await this.schedulingModel
            .find(conflictQuery)
            .populate('routeId', 'name estimatedDuration')
            .exec();

        console.log('🔍 Validation check:', {
            busIds: validBuses.map(b => (b._id as Types.ObjectId).toString()),
            date,
            time,
            foundConflicts: conflictingSchedules.length
        });

        // Track which buses have conflicts
        const busesWithConflicts = new Set<string>();

        if (conflictingSchedules.length > 0) {
            const newStartMinutes = this.timeToMinutes(time);
            const newEndMinutes = newStartMinutes + (newTripDuration || 0);

            for (const schedule of conflictingSchedules) {
                const existingStartMinutes = this.timeToMinutes(schedule.etd);
                const existingEndMinutes = schedule.eta
                    ? this.timeToMinutes(schedule.eta)
                    : existingStartMinutes + ((schedule as any).routeId?.estimatedDuration || schedule.estimatedDuration || 0);

                const scheduleDateStr = schedule.departureDate.toISOString().split('T')[0];
                const inputDateStr = new Date(date).toISOString().split('T')[0];
                const isSameDate = scheduleDateStr === inputDateStr;

                if (isSameDate) {
                    const overlaps = (newStartMinutes < existingEndMinutes) && (existingStartMinutes < newEndMinutes);

                    if (overlaps) {
                        // Find which bus(es) from our list are in this conflicting schedule
                        for (const bus of validBuses) {
                            const busIdStr = (bus._id as Types.ObjectId).toString();
                            if (schedule.busIds.some(id => id.toString() === busIdStr)) {
                                busesWithConflicts.add(busIdStr);
                                conflicts.push({
                                    busId: busIdStr,
                                    plateNo: bus.plateNo,
                                    message: `Đã có lịch trình từ ${schedule.etd} đến ${schedule.eta || 'không xác định'}`
                                });
                            }
                        }
                    }
                } else {
                    // Previous day trip check
                    if (schedule.arrivalDate) {
                        const arrivalDateStr = schedule.arrivalDate instanceof Date
                            ? schedule.arrivalDate.toISOString().split('T')[0]
                            : new Date(schedule.arrivalDate).toISOString().split('T')[0];
                        const inputDateStr = new Date(date).toISOString().split('T')[0];

                        if (arrivalDateStr === inputDateStr && newStartMinutes < existingEndMinutes) {
                            for (const bus of validBuses) {
                                const busIdStr = (bus._id as Types.ObjectId).toString();
                                if (schedule.busIds.some(id => id.toString() === busIdStr)) {
                                    busesWithConflicts.add(busIdStr);
                                    conflicts.push({
                                        busId: busIdStr,
                                        plateNo: bus.plateNo,
                                        message: `Vẫn trong chuyến đi từ ngày hôm trước (kết thúc ${schedule.eta})`
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // Return only buses without conflicts
        const validBusIds = validBuses
            .filter(b => !busesWithConflicts.has((b._id as Types.ObjectId).toString()))
            .map(b => (b._id as Types.ObjectId).toString());

        console.log('✅ Validation result:', {
            totalBuses: busIds.length,
            validBuses: validBusIds.length,
            conflicts: conflicts.length
        });

        return { validBusIds, conflicts };
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

    /**
     * Combine date and time into a single Date object
     * @param date - Date object or date string (YYYY-MM-DD)
     * @param time - Time string (HH:MM)
     * @returns Combined Date object
     */
    private combineDateAndTime(date: Date | string, time: string): Date {
        const dateObj = date instanceof Date ? date : new Date(date);
        const [hours, minutes] = time.split(':').map(Number);

        const combined = new Date(dateObj);
        combined.setHours(hours, minutes, 0, 0);

        return combined;
    }
}
