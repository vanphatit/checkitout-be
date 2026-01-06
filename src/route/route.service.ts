import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { plainToClass } from 'class-transformer';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Route, RouteDocument } from './entities/route.entity';
import { Station, StationDocument } from '../station/entities/station.entity';
import { Scheduling, SchedulingDocument } from '../scheduling/entities/scheduling.entity';
import { CreateRouteDto, UpdateRouteDto, CreateRouteFromAutoDto } from './dto/route.dto';
import { RouteStatsResponseDto } from './dto/route-stats-response.dto';
import { OpenStreetMapService, LocationCoordinates } from '../common/services/openstreetmap.service';
import {
    ResourceNotFoundException,
    BusinessLogicException
} from '../common/exceptions/custom-exceptions';
import { RouteUpdatedEvent } from '../common/events/scheduling-reindex.event';

@Injectable()
export class RouteService {
    constructor(
        @InjectModel(Route.name) private routeModel: Model<RouteDocument>,
        @InjectModel(Station.name) private stationModel: Model<StationDocument>,
        @InjectModel(Scheduling.name) private schedulingModel: Model<SchedulingDocument>,
        private openStreetMapService: OpenStreetMapService,
        private readonly eventEmitter: EventEmitter2,
    ) { }

    async create(createRouteDto: CreateRouteDto): Promise<Route> {
        // Validate stations exist
        await this.validateStations(createRouteDto.stationIds);

        const newRoute = new this.routeModel({
            ...createRouteDto,
            stationIds: createRouteDto.stationIds.map(id => new Types.ObjectId(id)),
        });

        return await newRoute.save();
    }

    async createFromAuto(createFromAutoDto: CreateRouteFromAutoDto): Promise<Route> {
        // Validate stations exist
        await this.validateStations(createFromAutoDto.stationIds);

        // Get station locations
        const stations = await this.stationModel.find({
            _id: { $in: createFromAutoDto.stationIds.map(id => new Types.ObjectId(id)) }
        }).exec();

        if (stations.length < 2) {
            throw new BadRequestException('Cần ít nhất 2 trạm để tạo tuyến đường');
        }

        try {
            // Create waypoints for OpenStreetMap routing
            const waypoints: LocationCoordinates[] = stations.map(station => ({
                latitude: station.location.coordinates[1],
                longitude: station.location.coordinates[0]
            }));

            const routeInfo = await this.openStreetMapService.calculateRoute(waypoints);

            const newRoute = new this.routeModel({
                name: createFromAutoDto.name,
                stationIds: createFromAutoDto.stationIds.map(id => new Types.ObjectId(id)),
                distance: routeInfo.distance,
                etd: createFromAutoDto.etd,
                estimatedDuration: routeInfo.duration,
                description: createFromAutoDto.description,
                basePrice: createFromAutoDto.basePrice,
                pricePerKm: createFromAutoDto.pricePerKm,
                operatingHours: createFromAutoDto.operatingHours,
                operatingDays: createFromAutoDto.operatingDays,
                googleRouteData: {
                    polyline: routeInfo.polyline,
                    legs: routeInfo.legs?.map(leg => ({
                        distance: { text: `${leg.distance.toFixed(1)} km`, value: leg.distance * 1000 },
                        duration: { text: `${Math.round(leg.duration)} phút`, value: leg.duration * 60 },
                        startLocation: { lat: leg.startLocation.latitude, lng: leg.startLocation.longitude },
                        endLocation: { lat: leg.endLocation.latitude, lng: leg.endLocation.longitude },
                    })),
                },
            });

            return await newRoute.save();
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException('Lỗi khi tạo tuyến đường: ' + error.message);
        }
    }

    async findAll(includeDeleted: boolean = false): Promise<Route[]> {
        const query = includeDeleted ? {} : { isDeleted: false };
        return await this.routeModel
            .find(query)
            .populate('stationIds', 'name address location isActive isDeleted')
            .exec();
    }

    async findOne(id: string): Promise<Route> {
        const route = await this.routeModel
            .findOne({ _id: id, isDeleted: false })
            .populate('stationIds', 'name address location isActive isDeleted')
            .exec();

        if (!route) {
            throw new NotFoundException('Không tìm thấy tuyến đường');
        }

        return route;
    }

    async update(id: string, updateRouteDto: UpdateRouteDto): Promise<Route> {
        if (updateRouteDto.stationIds) {
            await this.validateStations(updateRouteDto.stationIds);
        }

        const updateData = { ...updateRouteDto };
        if (updateRouteDto.stationIds) {
            (updateData as any).stationIds = updateRouteDto.stationIds.map(id => new Types.ObjectId(id));
        }

        const updatedRoute = await this.routeModel
            .findByIdAndUpdate(id, updateData, { new: true })
            .populate('stationIds', 'name address location isActive isDeleted')
            .exec();

        if (!updatedRoute) {
            throw new NotFoundException('Không tìm thấy tuyến đường');
        }

        // Emit event để reindex schedulings liên quan
        this.eventEmitter.emit('route.updated', new RouteUpdatedEvent(id));

        return updatedRoute;
    }

    async remove(id: string): Promise<void> {
        // Kiểm tra tuyến đường có tồn tại không
        const route = await this.routeModel.findOne({ _id: id, isDeleted: false }).exec();
        if (!route) {
            throw new NotFoundException('Không tìm thấy tuyến đường');
        }

        // Kiểm tra xem tuyến đường có đang được sử dụng trong scheduling nào không
        const schedulingsUsingRoute = await this.schedulingModel.find({
            routeId: new Types.ObjectId(id),
            isDeleted: false
        }).exec();

        if (schedulingsUsingRoute.length > 0) {
            throw new ConflictException(
                `Không thể xóa tuyến đường này vì đang có ${schedulingsUsingRoute.length} lịch trình đang sử dụng. ` +
                `Vui lòng xóa hoặc vô hiệu hóa các lịch trình này trước khi xóa tuyến đường.`
            );
        }

        // Nếu không có lịch trình nào sử dụng, thực hiện xóa mềm
        const result = await this.routeModel
            .findByIdAndUpdate(id, { isDeleted: true }, { new: true })
            .exec();

        if (!result) {
            throw new NotFoundException('Không tìm thấy tuyến đường');
        }
    }

    async findByStations(originStationId: string, destinationStationId: string): Promise<Route[]> {
        const originId = new Types.ObjectId(originStationId);
        const destinationId = new Types.ObjectId(destinationStationId);

        return await this.routeModel
            .find({
                isDeleted: false,
                isActive: true,
                stationIds: { $all: [originId, destinationId] }
            })
            .populate('stationIds', 'name address location isActive isDeleted')
            .exec();
    }

    async searchRoutes(query: string): Promise<Route[]> {
        const searchRegex = new RegExp(query, 'i');
        return await this.routeModel
            .find({
                isDeleted: false,
                isActive: true,
                $or: [
                    { name: searchRegex },
                    { description: searchRegex }
                ]
            })
            .populate('stationIds', 'name address location isActive isDeleted')
            .exec();
    }

    async recalculateDistance(id: string): Promise<Route> {
        const route = await this.routeModel.findById(id).exec();
        if (!route) {
            throw new NotFoundException('Không tìm thấy tuyến đường');
        }

        // Get station locations
        const stations = await this.stationModel.find({
            _id: { $in: route.stationIds }
        }).exec();

        if (stations.length < 2) {
            throw new BadRequestException('Tuyến đường cần ít nhất 2 trạm');
        }

        try {
            // Create waypoints for OpenStreetMap routing
            const waypoints: LocationCoordinates[] = stations.map(station => ({
                latitude: station.location.coordinates[1],
                longitude: station.location.coordinates[0]
            }));

            const routeInfo = await this.openStreetMapService.calculateRoute(waypoints);

            const updatedRoute = await this.routeModel
                .findByIdAndUpdate(
                    id,
                    {
                        distance: routeInfo.distance,
                        estimatedDuration: routeInfo.duration,
                        googleRouteData: {
                            polyline: routeInfo.polyline,
                            legs: routeInfo.legs?.map(leg => ({
                                distance: { text: `${leg.distance.toFixed(1)} km`, value: leg.distance * 1000 },
                                duration: { text: `${Math.round(leg.duration)} phút`, value: leg.duration * 60 },
                                startLocation: { lat: leg.startLocation.latitude, lng: leg.startLocation.longitude },
                                endLocation: { lat: leg.endLocation.latitude, lng: leg.endLocation.longitude },
                            })),
                        },
                    },
                    { new: true }
                )
                .populate('stationIds', 'name address location isActive')
                .exec();

            if (!updatedRoute) {
                throw new NotFoundException('Không tìm thấy tuyến đường sau khi cập nhật');
            }

            return updatedRoute;
        } catch (error) {
            if (error instanceof BadRequestException || error instanceof NotFoundException) {
                throw error;
            }
            throw new BadRequestException('Lỗi khi tính toán lại tuyến đường: ' + error.message);
        }
    }

    async suggestIntermediateStations(originId: string, destinationId: string): Promise<any> {
        // Lấy thông tin 2 trạm đầu cuối
        const [origin, destination] = await Promise.all([
            this.stationModel.findById(originId).exec(),
            this.stationModel.findById(destinationId).exec()
        ]);

        if (!origin || !destination) {
            throw new BadRequestException('Không tìm thấy trạm đầu hoặc trạm cuối');
        }

        // Lấy tất cả trạm active trừ 2 trạm đầu/cuối
        const allStations = await this.stationModel.find({
            _id: { $nin: [new Types.ObjectId(originId), new Types.ObjectId(destinationId)] },
            isDeleted: false,
            isActive: true
        }).exec();

        // Tính khoảng cách và góc từ origin đến destination
        const originCoords = { latitude: origin.location.coordinates[1], longitude: origin.location.coordinates[0] };
        const destCoords = { latitude: destination.location.coordinates[1], longitude: destination.location.coordinates[0] };
        const totalDistance = this.openStreetMapService.calculateDistance(originCoords, destCoords);

        // Lọc các trạm nằm gần đường thẳng giữa origin-destination
        const suggestedStations = allStations
            .map(station => {
                const stationCoords = {
                    latitude: station.location.coordinates[1],
                    longitude: station.location.coordinates[0]
                };

                // Tính khoảng cách từ origin và destination đến station
                const distFromOrigin = this.openStreetMapService.calculateDistance(originCoords, stationCoords);
                const distFromDest = this.openStreetMapService.calculateDistance(stationCoords, destCoords);

                // Nếu station nằm trên đường đi, thì distFromOrigin + distFromDest ≈ totalDistance
                const deviation = Math.abs((distFromOrigin + distFromDest) - totalDistance);

                // Lọc các trạm có độ lệch < 20% tổng khoảng cách (nằm gần đường thẳng)
                return {
                    _id: (station._id as any).toString(),
                    name: station.name,
                    address: station.address,
                    location: station.location,
                    isActive: station.isActive,
                    distanceFromOrigin: Math.round(distFromOrigin * 100) / 100,
                    deviation: Math.round(deviation * 100) / 100
                };
            })
            .filter(station => station.deviation < totalDistance * 0.2) // Độ lệch < 20%
            .sort((a, b) => a.distanceFromOrigin - b.distanceFromOrigin); // Sắp xếp theo khoảng cách từ origin

        return {
            origin: {
                _id: (origin._id as any).toString(),
                name: origin.name,
                address: origin.address,
                location: origin.location,
                isActive: origin.isActive
            },
            destination: {
                _id: (destination._id as any).toString(),
                name: destination.name,
                address: destination.address,
                location: destination.location,
                isActive: destination.isActive
            },
            suggestedStations,
            totalDistance: Math.round(totalDistance * 100) / 100
        };
    }

    private async validateStations(stationIds: string[]): Promise<void> {
        const stations = await this.stationModel.find({
            _id: { $in: stationIds.map(id => new Types.ObjectId(id)) },
            isDeleted: false,
            isActive: true
        }).exec();

        if (stations.length !== stationIds.length) {
            throw new BadRequestException('Một hoặc nhiều trạm không tồn tại hoặc không hoạt động');
        }
    }

    async getStats(): Promise<RouteStatsResponseDto> {
        try {
            const [total, active, inactive, deleted] = await Promise.all([
                this.routeModel.countDocuments({}).exec(),
                this.routeModel.countDocuments({ isDeleted: false, isActive: true }).exec(),
                this.routeModel.countDocuments({ isDeleted: false, isActive: false }).exec(),
                this.routeModel.countDocuments({ isDeleted: true }).exec()
            ]);

            return plainToClass(RouteStatsResponseDto, {
                total,
                active,
                inactive,
                deleted
            }, { excludeExtraneousValues: true });
        } catch (error) {
            throw new BusinessLogicException(`Lỗi khi lấy thống kê: ${error.message}`);
        }
    }

    async restore(id: string): Promise<Route> {
        try {
            const route = await this.routeModel.findById(id).exec();

            if (!route) {
                throw new ResourceNotFoundException('Tuyến đường', id);
            }

            if (!route.isDeleted) {
                throw new BusinessLogicException('Tuyến đường này chưa bị xóa');
            }

            route.isDeleted = false;
            return await route.save();
        } catch (error) {
            if (error.name === 'CastError') {
                throw new BusinessLogicException('ID tuyến đường không hợp lệ');
            }
            throw error;
        }
    }
}
