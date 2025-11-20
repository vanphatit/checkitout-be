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
} from '@nestjs/common';
import { RouteService } from './route.service';
import { CreateRouteDto, UpdateRouteDto, CreateRouteFromAutoDto } from './dto/route.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('Routes')
@Controller('routes')
export class RouteController {
    constructor(private readonly routeService: RouteService) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SELLER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Tạo tuyến đường mới' })
    @ApiResponse({ status: 201, description: 'Tuyến đường đã được tạo thành công' })
    @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    create(@Body() createRouteDto: CreateRouteDto) {
        return this.routeService.create(createRouteDto);
    }

    @Post('auto-calculate')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SELLER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Tạo tuyến đường với tính toán khoảng cách và thời gian tự động từ OpenStreetMap' })
    @ApiResponse({ status: 201, description: 'Tuyến đường đã được tạo thành công' })
    @ApiResponse({ status: 400, description: 'Lỗi khi lấy dữ liệu từ OpenStreetMap' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    createFromAuto(@Body() createFromAutoDto: CreateRouteFromAutoDto) {
        return this.routeService.createFromAuto(createFromAutoDto);
    }

    @Get()
    @ApiOperation({ summary: 'Lấy danh sách tất cả tuyến đường' })
    @ApiResponse({ status: 200, description: 'Danh sách tuyến đường' })
    findAll() {
        return this.routeService.findAll();
    }

    @Get('search')
    @ApiOperation({ summary: 'Tìm kiếm tuyến đường theo tên hoặc mô tả' })
    @ApiResponse({ status: 200, description: 'Kết quả tìm kiếm' })
    searchRoutes(@Query('q') query: string) {
        return this.routeService.searchRoutes(query);
    }

    @Get('by-stations')
    @ApiOperation({ summary: 'Tìm tuyến đường theo trạm xuất phát và đích' })
    @ApiResponse({ status: 200, description: 'Danh sách tuyến đường phù hợp' })
    findByStations(
        @Query('origin') originStationId: string,
        @Query('destination') destinationStationId: string,
    ) {
        return this.routeService.findByStations(originStationId, destinationStationId);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Lấy thông tin chi tiết một tuyến đường' })
    @ApiResponse({ status: 200, description: 'Thông tin tuyến đường' })
    @ApiResponse({ status: 404, description: 'Không tìm thấy tuyến đường' })
    findOne(@Param('id') id: string) {
        return this.routeService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SELLER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Cập nhật thông tin tuyến đường' })
    @ApiResponse({ status: 200, description: 'Tuyến đường đã được cập nhật thành công' })
    @ApiResponse({ status: 404, description: 'Không tìm thấy tuyến đường' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    update(@Param('id') id: string, @Body() updateRouteDto: UpdateRouteDto) {
        return this.routeService.update(id, updateRouteDto);
    }

    @Patch(':id/recalculate')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SELLER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Tính toán lại khoảng cách và thời gian từ OpenStreetMap' })
    @ApiResponse({ status: 200, description: 'Đã tính toán lại thành công' })
    @ApiResponse({ status: 404, description: 'Không tìm thấy tuyến đường' })
    @ApiResponse({ status: 400, description: 'Lỗi khi tính toán từ OpenStreetMap' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    recalculateDistance(@Param('id') id: string) {
        return this.routeService.recalculateDistance(id);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Xóa tuyến đường (soft delete)' })
    @ApiResponse({ status: 200, description: 'Tuyến đường đã được xóa thành công' })
    @ApiResponse({ status: 404, description: 'Không tìm thấy tuyến đường' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    remove(@Param('id') id: string) {
        return this.routeService.remove(id);
    }
}