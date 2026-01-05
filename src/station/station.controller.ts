import {
    Controller,
    Get,
    Post,
    Body,
    Patch,
    Param,
    Delete,
    Query,
    UseGuards,
    ValidationPipe,
} from '@nestjs/common';
import { StationService } from './station.service';
import { CreateStationDto, CreateStationFromAddressDto } from './dto/create-station.dto';
import { UpdateStationDto } from './dto/update-station.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import {
    StationResponseDto,
    PaginatedStationResponseDto,
    DistanceResponseDto,
    PlaceSearchResponseDto
} from './dto/station-response.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('Stations')
@Controller('stations')
export class StationController {
    constructor(private readonly stationService: StationService) { }

    @Get('stats')
    @ApiOperation({ summary: 'Lấy thống kê tổng quan về trạm' })
    @ApiResponse({
        status: 200,
        description: 'Thống kê trạm',
        schema: {
            type: 'object',
            properties: {
                total: { type: 'number', example: 50 },
                active: { type: 'number', example: 40 },
                inactive: { type: 'number', example: 8 },
                deleted: { type: 'number', example: 2 }
            }
        }
    })
    async getStats() {
        return this.stationService.getStats();
    }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SELLER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Tạo trạm mới' })
    @ApiResponse({ status: 201, description: 'Trạm đã được tạo thành công', type: StationResponseDto })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    create(@Body() createStationDto: CreateStationDto): Promise<StationResponseDto> {
        return this.stationService.create(createStationDto);
    }

    @Post('from-address')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SELLER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Tạo trạm từ địa chỉ sử dụng OpenStreetMap' })
    @ApiResponse({ status: 201, description: 'Trạm đã được tạo từ địa chỉ thành công', type: StationResponseDto })
    @ApiResponse({ status: 400, description: 'Lỗi khi lấy dữ liệu từ OpenStreetMap' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    createFromAddress(@Body() createFromAddressDto: CreateStationFromAddressDto): Promise<StationResponseDto> {
        return this.stationService.createFromAddress(createFromAddressDto);
    }

    @Get()
    @ApiOperation({ summary: 'Lấy danh sách trạm với phân trang' })
    @ApiQuery({ name: 'page', required: false, description: 'Số trang', example: 1 })
    @ApiQuery({ name: 'limit', required: false, description: 'Số bản ghi mỗi trang', example: 10 })
    @ApiQuery({ name: 'search', required: false, description: 'Tìm kiếm theo tên, địa chỉ', example: 'Bến xe' })
    @ApiQuery({ name: 'sortBy', required: false, description: 'Sắp xếp theo trường', example: 'name' })
    @ApiQuery({ name: 'sortOrder', required: false, description: 'Thứ tự sắp xếp', enum: ['asc', 'desc'] })
    @ApiResponse({ status: 200, description: 'Danh sách trạm với phân trang', type: PaginatedStationResponseDto })
    findAll(@Query(new ValidationPipe({ transform: true })) paginationDto: PaginationDto): Promise<PaginatedStationResponseDto> {
        return this.stationService.findAll(paginationDto);
    }

    @Get('search')
    @ApiOperation({ summary: 'Tìm kiếm trạm theo tên hoặc địa chỉ' })
    @ApiResponse({ status: 200, description: 'Kết quả tìm kiếm', type: [StationResponseDto] })
    searchStations(@Query('q') query: string): Promise<StationResponseDto[]> {
        return this.stationService.searchStations(query);
    }

    @Get('nearby')
    @ApiOperation({ summary: 'Tìm trạm gần nhất' })
    @ApiResponse({ status: 200, description: 'Danh sách trạm gần nhất', type: [StationResponseDto] })
    findNearby(
        @Query('longitude') longitude: number,
        @Query('latitude') latitude: number,
        @Query('maxDistance') maxDistance?: number,
    ): Promise<StationResponseDto[]> {
        return this.stationService.findNearby(longitude, latitude, maxDistance);
    }

    @Get('nearby-bus-stations')
    @ApiOperation({ summary: 'Tìm trạm xe buýt gần nhất từ OpenStreetMap' })
    @ApiResponse({ status: 200, description: 'Danh sách trạm xe buýt gần nhất', type: [PlaceSearchResponseDto] })
    findNearbyBusStations(
        @Query('longitude') longitude: number,
        @Query('latitude') latitude: number,
        @Query('radius') radius?: number,
    ): Promise<PlaceSearchResponseDto[]> {
        return this.stationService.findNearbyBusStations(longitude, latitude, radius);
    }

    @Get('search-places')
    @ApiOperation({ summary: 'Tìm kiếm địa điểm trên OpenStreetMap' })
    @ApiResponse({ status: 200, description: 'Kết quả tìm kiếm địa điểm', type: [PlaceSearchResponseDto] })
    searchPlaces(@Query('q') query: string): Promise<PlaceSearchResponseDto[]> {
        return this.stationService.searchPlaces(query);
    }

    @Get('distance/:id1/:id2')
    @ApiOperation({ summary: 'Tính khoảng cách giữa 2 trạm' })
    @ApiResponse({ status: 200, description: 'Khoảng cách giữa 2 trạm (km)', type: DistanceResponseDto })
    getDistance(@Param('id1') id1: string, @Param('id2') id2: string): Promise<DistanceResponseDto> {
        return this.stationService.getStationDistance(id1, id2);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Lấy thông tin chi tiết một trạm' })
    @ApiResponse({ status: 200, description: 'Thông tin trạm', type: StationResponseDto })
    @ApiResponse({ status: 404, description: 'Không tìm thấy trạm' })
    findOne(@Param('id') id: string): Promise<StationResponseDto> {
        return this.stationService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SELLER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Cập nhật thông tin trạm' })
    @ApiResponse({ status: 200, description: 'Trạm đã được cập nhật thành công', type: StationResponseDto })
    @ApiResponse({ status: 404, description: 'Không tìm thấy trạm' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    update(@Param('id') id: string, @Body() updateStationDto: UpdateStationDto): Promise<StationResponseDto> {
        return this.stationService.update(id, updateStationDto);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Xóa trạm (soft delete)' })
    @ApiResponse({ status: 200, description: 'Trạm đã được xóa thành công', type: StationResponseDto })
    @ApiResponse({ status: 404, description: 'Không tìm thấy trạm' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    remove(@Param('id') id: string): Promise<StationResponseDto> {
        return this.stationService.remove(id);
    }

    @Post(':id/restore')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Khôi phục trạm đã xóa' })
    @ApiResponse({ status: 200, description: 'Trạm đã được khôi phục thành công', type: StationResponseDto })
    @ApiResponse({ status: 404, description: 'Không tìm thấy trạm' })
    @ApiResponse({ status: 400, description: 'Trạm này chưa bị xóa' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    restore(@Param('id') id: string): Promise<StationResponseDto> {
        return this.stationService.restore(id);
    }
}
