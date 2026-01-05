import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { plainToClass } from 'class-transformer';
import { Station, StationDocument } from './entities/station.entity';
import {
  CreateStationDto,
  CreateStationFromAddressDto,
} from './dto/create-station.dto';
import { UpdateStationDto } from './dto/update-station.dto';
import {
  StationResponseDto,
  PaginatedStationResponseDto,
  DistanceResponseDto,
  PlaceSearchResponseDto,
} from './dto/station-response.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { OpenStreetMapService } from '../common/services/openstreetmap.service';
import {
  ResourceNotFoundException,
  BusinessLogicException,
  DuplicateResourceException,
} from '../common/exceptions/custom-exceptions';

@Injectable()
export class StationService {
  constructor(
    @InjectModel(Station.name) private stationModel: Model<StationDocument>,
    private openStreetMapService: OpenStreetMapService,
  ) {}

  private toStationResponseDto(
    station: StationDocument | any,
  ): StationResponseDto {
    const stationObj = station.toObject ? station.toObject() : station;
    return plainToClass(
      StationResponseDto,
      {
        _id: stationObj._id.toString(),
        name: stationObj.name,
        address: stationObj.address,
        description: stationObj.description,
        latitude: stationObj.location?.coordinates[1],
        longitude: stationObj.location?.coordinates[0],
        facilities: stationObj.facilities,
        osmData: stationObj.osmData,
        isActive: stationObj.isActive,
        createdAt: stationObj.createdAt,
        updatedAt: stationObj.updatedAt,
      },
      { excludeExtraneousValues: true },
    );
  }

  async create(
    createStationDto: CreateStationDto,
  ): Promise<StationResponseDto> {
    const { longitude, latitude, ...stationData } = createStationDto;

    const newStation = new this.stationModel({
      ...stationData,
      location: {
        type: 'Point',
        coordinates: [longitude, latitude],
      },
    });

    const savedStation = await newStation.save();
    return this.toStationResponseDto(savedStation);
  }

  async createFromAddress(
    createFromAddressDto: CreateStationFromAddressDto,
  ): Promise<StationResponseDto> {
    try {
      // Geocode địa chỉ để lấy tọa độ
      const geocodeResults = await this.openStreetMapService.geocodeAddress(
        createFromAddressDto.address,
      );

      if (!geocodeResults.length) {
        throw new BadRequestException('Không tìm thấy địa chỉ này');
      }

      const place = geocodeResults[0];

      const newStation = new this.stationModel({
        name: createFromAddressDto.name || place.name,
        address: place.address,
        location: {
          type: 'Point',
          coordinates: [
            place.coordinates.longitude,
            place.coordinates.latitude,
          ],
        },
        description: createFromAddressDto.description,
        facilities: createFromAddressDto.facilities || [],
        osmData: {
          displayName: place.displayName,
          type: 'geocoded',
        },
      });

      const savedStation = await newStation.save();
      return this.toStationResponseDto(savedStation);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        'Lỗi khi tạo trạm từ địa chỉ: ' + error.message,
      );
    }
  }

  async findAll(
    paginationDto: PaginationDto,
  ): Promise<PaginatedStationResponseDto> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
    } = paginationDto;

    try {
      // Build query
      const query: any = { isActive: true };
      if (search) {
        query.$or = [
          { name: { $regex: search, $options: 'i' } },
          { address: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } },
        ];
      }

      // Build sort
      const sort: any = {};
      sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

      // Execute query with pagination
      const skip = (page - 1) * limit;
      const [data, total] = await Promise.all([
        this.stationModel
          .find(query)
          .sort(sort)
          .skip(skip)
          .limit(limit)
          .lean()
          .exec(),
        this.stationModel.countDocuments(query).exec(),
      ]);

      const totalPages = Math.ceil(total / limit);
      const transformedData = data.map((station) =>
        this.toStationResponseDto(station as any),
      );

      return plainToClass(
        PaginatedStationResponseDto,
        {
          data: transformedData,
          total,
          page,
          limit,
          totalPages,
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
        { excludeExtraneousValues: true },
      );
    } catch (error) {
      throw new BusinessLogicException(
        `Lỗi khi lấy danh sách trạm: ${error.message}`,
      );
    }
  }

  async findOne(id: string): Promise<StationResponseDto> {
    try {
      const station = await this.stationModel.findById(id).exec();

      if (!station || !station.isActive) {
        throw new ResourceNotFoundException('Trạm', id);
      }

      return this.toStationResponseDto(station);
    } catch (error) {
      if (error.name === 'CastError') {
        throw new BusinessLogicException('ID trạm không hợp lệ');
      }
      throw error;
    }
  }

  async update(
    id: string,
    updateStationDto: UpdateStationDto,
  ): Promise<StationResponseDto> {
    const { longitude, latitude, ...updateData } = updateStationDto;

    const updatePayload: any = { ...updateData };

    if (longitude !== undefined && latitude !== undefined) {
      updatePayload.location = {
        type: 'Point',
        coordinates: [longitude, latitude],
      };
    }

    const updatedStation = await this.stationModel
      .findByIdAndUpdate(id, updatePayload, { new: true })
      .exec();

    if (!updatedStation) {
      throw new NotFoundException('Không tìm thấy trạm');
    }

    return this.toStationResponseDto(updatedStation);
  }

  async remove(id: string): Promise<StationResponseDto> {
    const result = await this.stationModel
      .findByIdAndUpdate(id, { isActive: false }, { new: true })
      .exec();

    if (!result) {
      throw new NotFoundException('Không tìm thấy trạm');
    }

    return this.toStationResponseDto(result);
  }

  async findNearby(
    longitude: number,
    latitude: number,
    maxDistance: number = 5000,
  ): Promise<StationResponseDto[]> {
    const stations = await this.stationModel
      .find({
        isActive: true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude],
            },
            $maxDistance: maxDistance,
          },
        },
      })
      .exec();

    return stations.map((station) => this.toStationResponseDto(station));
  }

  async searchStations(query: string): Promise<StationResponseDto[]> {
    const searchRegex = new RegExp(query, 'i');
    const stations = await this.stationModel
      .find({
        isActive: true,
        $or: [{ name: searchRegex }, { address: searchRegex }],
      })
      .exec();

    return stations.map((station) => this.toStationResponseDto(station));
  }

  async findNearbyBusStations(
    longitude: number,
    latitude: number,
    radius: number = 5,
  ): Promise<PlaceSearchResponseDto[]> {
    try {
      const places = await this.openStreetMapService.findNearbyPlaces(
        latitude,
        longitude,
        radius,
        'bus_station',
      );
      return places.map((place: any) =>
        plainToClass(
          PlaceSearchResponseDto,
          {
            place_id: place.osm_id?.toString() || place.place_id || 'unknown',
            name: place.name || place.display_name?.split(',')[0] || 'Unknown',
            display_name: place.display_name || place.name,
            address: place.display_name || place.address,
            longitude: parseFloat(place.lon || place.longitude || '0'),
            latitude: parseFloat(place.lat || place.latitude || '0'),
            type: place.type || 'amenity',
            subtype: place.amenity || place.subtype || 'bus_station',
            distance: place.distance,
          },
          { excludeExtraneousValues: true },
        ),
      );
    } catch (error) {
      throw new BadRequestException(
        'Lỗi khi tìm trạm xe buýt gần nhất: ' + error.message,
      );
    }
  }

  async searchPlaces(query: string): Promise<PlaceSearchResponseDto[]> {
    try {
      const places = await this.openStreetMapService.searchPlaces(query);
      return places.map((place: any) =>
        plainToClass(
          PlaceSearchResponseDto,
          {
            place_id: place.osm_id?.toString() || place.place_id || 'unknown',
            name: place.name || place.display_name?.split(',')[0] || 'Unknown',
            display_name: place.display_name || place.name,
            address: place.display_name || place.address,
            longitude: parseFloat(place.lon || place.longitude || '0'),
            latitude: parseFloat(place.lat || place.latitude || '0'),
            type: place.type || 'place',
            subtype: place.amenity || place.subtype,
          },
          { excludeExtraneousValues: true },
        ),
      );
    } catch (error) {
      throw new BadRequestException(
        'Lỗi khi tìm kiếm địa điểm: ' + error.message,
      );
    }
  }

  async getStationDistance(
    stationId1: string,
    stationId2: string,
  ): Promise<DistanceResponseDto> {
    const station1 = await this.stationModel.findById(stationId1).exec();
    const station2 = await this.stationModel.findById(stationId2).exec();

    if (!station1) {
      throw new ResourceNotFoundException('Trạm', stationId1);
    }
    if (!station2) {
      throw new ResourceNotFoundException('Trạm', stationId2);
    }

    const point1 = {
      latitude: station1.location.coordinates[1],
      longitude: station1.location.coordinates[0],
    };

    const point2 = {
      latitude: station2.location.coordinates[1],
      longitude: station2.location.coordinates[0],
    };

    const distance = this.openStreetMapService.calculateDistance(
      point1,
      point2,
    );

    return plainToClass(
      DistanceResponseDto,
      {
        station1Id: stationId1,
        station1Name: station1.name,
        station2Id: stationId2,
        station2Name: station2.name,
        distance: Math.round(distance * 100) / 100, // Round to 2 decimal places
        unit: 'km',
      },
      { excludeExtraneousValues: true },
    );
  }
}
