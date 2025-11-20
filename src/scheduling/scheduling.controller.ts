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
import { SchedulingService } from './scheduling.service';
import { CreateSchedulingDto, UpdateSchedulingDto, CreateBulkSchedulingDto } from './dto/scheduling.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@ApiTags('Scheduling')
@Controller('scheduling')
export class SchedulingController {
    constructor(private readonly schedulingService: SchedulingService) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SELLER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Tạo lịch trình mới' })
    @ApiResponse({ status: 201, description: 'Lịch trình đã được tạo thành công' })
    @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    create(@Body() createSchedulingDto: CreateSchedulingDto) {
        return this.schedulingService.create(createSchedulingDto);
    }

    @Post('bulk')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SELLER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Tạo nhiều lịch trình cùng lúc (lặp theo ngày)' })
    @ApiResponse({ status: 201, description: 'Các lịch trình đã được tạo thành công' })
    @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    createBulk(@Body() createBulkSchedulingDto: CreateBulkSchedulingDto) {
        return this.schedulingService.createBulk(createBulkSchedulingDto);
    }

    @Get()
    @ApiOperation({ summary: 'Lấy danh sách tất cả lịch trình' })
    @ApiResponse({ status: 200, description: 'Danh sách lịch trình' })
    @ApiQuery({ name: 'routeId', required: false, description: 'Lọc theo tuyến đường' })
    @ApiQuery({ name: 'date', required: false, description: 'Lọc theo ngày (YYYY-MM-DD)' })
    @ApiQuery({ name: 'status', required: false, description: 'Lọc theo trạng thái' })
    findAll(
        @Query('routeId') routeId?: string,
        @Query('date') date?: string,
        @Query('status') status?: string,
    ) {
        return this.schedulingService.findAll({ routeId, date, status });
    }

    @Get('available')
    @ApiOperation({ summary: 'Lấy danh sách lịch trình có sẵn cho đặt vé' })
    @ApiResponse({ status: 200, description: 'Danh sách lịch trình có sẵn' })
    @ApiQuery({ name: 'routeId', required: true, description: 'ID tuyến đường' })
    @ApiQuery({ name: 'date', required: true, description: 'Ngày cần tìm (YYYY-MM-DD)' })
    findAvailable(
        @Query('routeId') routeId: string,
        @Query('date') date: string,
    ) {
        return this.schedulingService.findAvailable(routeId, date);
    }

    @Get('by-route/:routeId')
    @ApiOperation({ summary: 'Lấy lịch trình theo tuyến đường' })
    @ApiResponse({ status: 200, description: 'Danh sách lịch trình của tuyến đường' })
    @ApiQuery({ name: 'date', required: false, description: 'Lọc theo ngày (YYYY-MM-DD)' })
    findByRoute(
        @Param('routeId') routeId: string,
        @Query('date') date?: string,
    ) {
        return this.schedulingService.findByRoute(routeId, date);
    }

    @Get(':id')
    @ApiOperation({ summary: 'Lấy thông tin chi tiết một lịch trình' })
    @ApiResponse({ status: 200, description: 'Thông tin lịch trình' })
    @ApiResponse({ status: 404, description: 'Không tìm thấy lịch trình' })
    findOne(@Param('id') id: string) {
        return this.schedulingService.findOne(id);
    }

    @Patch(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SELLER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Cập nhật thông tin lịch trình' })
    @ApiResponse({ status: 200, description: 'Lịch trình đã được cập nhật thành công' })
    @ApiResponse({ status: 404, description: 'Không tìm thấy lịch trình' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    update(@Param('id') id: string, @Body() updateSchedulingDto: UpdateSchedulingDto) {
        return this.schedulingService.update(id, updateSchedulingDto);
    }

    @Patch(':id/seat-count')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SELLER, UserRole.CUSTOMER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Cập nhật số lượng ghế đã đặt' })
    @ApiResponse({ status: 200, description: 'Số lượng ghế đã được cập nhật' })
    @ApiResponse({ status: 404, description: 'Không tìm thấy lịch trình' })
    updateSeatCount(
        @Param('id') id: string,
        @Body('bookedSeats') bookedSeats: number,
    ) {
        return this.schedulingService.updateSeatCount(id, bookedSeats);
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Xóa lịch trình (soft delete)' })
    @ApiResponse({ status: 200, description: 'Lịch trình đã được xóa thành công' })
    @ApiResponse({ status: 404, description: 'Không tìm thấy lịch trình' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    remove(@Param('id') id: string) {
        return this.schedulingService.remove(id);
    }
}