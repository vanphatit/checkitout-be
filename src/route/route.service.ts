import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Route, RouteDocument } from './entities/route.entity';
import { Station, StationDocument } from '../station/entities/station.entity';
import { CreateRouteDto, UpdateRouteDto, CreateRouteFromAutoDto } from './dto/route.dto';
import { OpenStreetMapService, LocationCoordinates } from '../common/services/openstreetmap.service';

@Injectable()
export class RouteService {
    constructor(
        @InjectModel(Route.name) private routeModel: Model<RouteDocument>,
        @InjectModel(Station.name) private stationModel: Model<StationDocument>,
        private openStreetMapService: OpenStreetMapService,
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

    async findAll(): Promise<Route[]> {
        return await this.routeModel
            .find({ isActive: true })
            .populate('stationIds', 'name address location')
            .exec();
    }

    async findOne(id: string): Promise<Route> {
        const route = await this.routeModel
            .findById(id)
            .populate('stationIds', 'name address location')
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
            .populate('stationIds', 'name address location')
            .exec();

        if (!updatedRoute) {
            throw new NotFoundException('Không tìm thấy tuyến đường');
        }

        return updatedRoute;
    }

    async remove(id: string): Promise<void> {
        const result = await this.routeModel
            .findByIdAndUpdate(id, { isActive: false }, { new: true })
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
                isActive: true,
                stationIds: { $all: [originId, destinationId] }
            })
            .populate('stationIds', 'name address location')
            .exec();
    }

    async searchRoutes(query: string): Promise<Route[]> {
        const searchRegex = new RegExp(query, 'i');
        return await this.routeModel
            .find({
                isActive: true,
                $or: [
                    { name: searchRegex },
                    { description: searchRegex }
                ]
            })
            .populate('stationIds', 'name address location')
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
                .populate('stationIds', 'name address location')
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

    private async validateStations(stationIds: string[]): Promise<void> {
        const stations = await this.stationModel.find({
            _id: { $in: stationIds.map(id => new Types.ObjectId(id)) },
            isActive: true
        }).exec();

        if (stations.length !== stationIds.length) {
            throw new BadRequestException('Một hoặc nhiều trạm không tồn tại hoặc không hoạt động');
        }
    }
}