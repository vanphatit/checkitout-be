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
    UseInterceptors,
    UploadedFile,
    Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { SchedulingService, CreateSchedulingResponse, BulkSchedulingResponse } from './scheduling.service';
import {
    CreateSchedulingDto,
    UpdateSchedulingDto,
    CreateBulkSchedulingDto,
} from './dto/scheduling.dto';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
    ApiConsumes,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { ExcelImportService } from './services/excel-import.service';
import { SchedulingSearchService } from './services/scheduling-search.service';

@ApiTags('Scheduling')
@Controller('scheduling')
export class SchedulingController {
    constructor(
        private readonly schedulingService: SchedulingService,
        private readonly excelImportService: ExcelImportService,
        private readonly schedulingSearchService: SchedulingSearchService,
    ) { }

    @Post()
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SELLER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Tạo lịch trình mới' })
    @ApiResponse({
        status: 201,
        description: 'Lịch trình đã được tạo thành công',
    })
    @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    create(@Body() createSchedulingDto: CreateSchedulingDto): Promise<CreateSchedulingResponse> {
        return this.schedulingService.create(createSchedulingDto);
    }

    @Post('bulk')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SELLER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Tạo nhiều lịch trình cùng lúc (lặp theo ngày)' })
    @ApiResponse({
        status: 201,
        description: 'Các lịch trình đã được tạo thành công',
    })
    @ApiResponse({ status: 400, description: 'Dữ liệu không hợp lệ' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    createBulk(@Body() createBulkSchedulingDto: CreateBulkSchedulingDto): Promise<BulkSchedulingResponse> {
        return this.schedulingService.createBulk(createBulkSchedulingDto);
    }

    @Get()
    @ApiOperation({
        summary: 'Lấy danh sách lịch trình với pagination và Elasticsearch',
    })
    @ApiResponse({ status: 200, description: 'Danh sách lịch trình' })
    @ApiQuery({
        name: 'routeId',
        required: false,
        description: 'Lọc theo tuyến đường',
    })
    @ApiQuery({
        name: 'date',
        required: false,
        description: 'Lọc theo ngày (YYYY-MM-DD)',
    })
    @ApiQuery({
        name: 'status',
        required: false,
        description: 'Lọc theo trạng thái',
    })
    @ApiQuery({
        name: 'query',
        required: false,
        description: 'Tìm kiếm theo tên tuyến đường',
    })
    @ApiQuery({
        name: 'page',
        required: false,
        description: 'Trang hiện tại (default: 1)',
    })
    @ApiQuery({
        name: 'limit',
        required: false,
        description: 'Số lượng mỗi trang (default: 10)',
    })
    @ApiQuery({
        name: 'includeDeleted',
        required: false,
        description: 'Bao gồm lịch trình đã xóa (chỉ admin)',
    })
    @ApiQuery({
        name: 'sortBy',
        required: false,
        description: 'Sắp xếp theo (departureDate, createdAt, price, availableSeats)',
    })
    @ApiQuery({
        name: 'sortOrder',
        required: false,
        description: 'Thứ tự sắp xếp (asc, desc)',
    })
    async findAll(
        @Query('routeId') routeId?: string,
        @Query('date') date?: string,
        @Query('status') status?: string,
        @Query('query') query?: string,
        @Query('page') page?: string,
        @Query('limit') limit?: string,
        @Query('includeDeleted') includeDeleted?: string,
        @Query('sortBy') sortBy?: string,
        @Query('sortOrder') sortOrder?: string,
    ) {
        const pageNum = parseInt(page || '1', 10);
        const limitNum = parseInt(limit || '10', 10);
        const shouldIncludeDeleted = includeDeleted === 'true';

        try {
            // Try Elasticsearch first
            const result = await this.schedulingSearchService.searchSchedulings({
                query,
                date,
                status,
                routeId,
                page: pageNum,
                limit: limitNum,
                sortBy: sortBy || 'departureDate',
                sortOrder: sortOrder || 'asc',
            });

            // Populate full scheduling data from MongoDB (with includeDeleted flag)
            const schedulingIds = result.schedulings.map((s) => s._id);
            const fullSchedulings =
                await this.schedulingService.findByIds(schedulingIds, shouldIncludeDeleted);

            return {
                data: fullSchedulings,
                pagination: {
                    total: result.total,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(result.total / limitNum),
                },
            };
        } catch (error) {
            // Fallback to MongoDB if Elasticsearch fails
            const schedulings = await this.schedulingService.findAll({
                routeId,
                date,
                status,
                includeDeleted: shouldIncludeDeleted,
            });

            // Manual pagination
            const startIndex = (pageNum - 1) * limitNum;
            const endIndex = startIndex + limitNum;
            const paginatedData = schedulings.slice(startIndex, endIndex);

            return {
                data: paginatedData,
                pagination: {
                    total: schedulings.length,
                    page: pageNum,
                    limit: limitNum,
                    totalPages: Math.ceil(schedulings.length / limitNum),
                },
            };
        }
    }

    @Get('stats')
    @ApiOperation({ summary: 'Lấy thống kê lịch trình' })
    @ApiResponse({ status: 200, description: 'Thống kê lịch trình' })
    getStats() {
        return this.schedulingService.getStats();
    }

    @Post('reindex')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({
        summary: 'Reindex tất cả scheduling vào Elasticsearch',
        description:
            'Xóa và tạo lại toàn bộ index scheduling trong Elasticsearch. Chỉ ADMIN có quyền.',
    })
    @ApiResponse({ status: 201, description: 'Reindex thành công' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    async reindexSchedulings() {
        await this.schedulingSearchService.reindexAll();
        return {
            success: true,
            message: 'Đã reindex tất cả scheduling vào Elasticsearch',
        };
    }

    @Post(':id/restore')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Khôi phục lịch trình đã xóa' })
    @ApiResponse({ status: 200, description: 'Khôi phục thành công' })
    @ApiResponse({ status: 404, description: 'Không tìm thấy lịch trình' })
    @ApiResponse({ status: 400, description: 'Lịch trình chưa bị xóa' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    restore(@Param('id') id: string) {
        return this.schedulingService.restore(id);
    }

    @Get('available')
    @ApiOperation({ summary: 'Lấy danh sách lịch trình có sẵn cho đặt vé' })
    @ApiResponse({ status: 200, description: 'Danh sách lịch trình có sẵn' })
    @ApiQuery({ name: 'routeId', required: true, description: 'ID tuyến đường' })
    @ApiQuery({
        name: 'date',
        required: true,
        description: 'Ngày cần tìm (YYYY-MM-DD)',
    })
    findAvailable(
        @Query('routeId') routeId: string,
        @Query('date') date: string,
    ) {
        return this.schedulingService.findAvailable(routeId, date);
    }

    @Get('by-route/:routeId')
    @ApiOperation({ summary: 'Lấy lịch trình theo tuyến đường' })
    @ApiResponse({
        status: 200,
        description: 'Danh sách lịch trình của tuyến đường',
    })
    @ApiQuery({
        name: 'date',
        required: false,
        description: 'Lọc theo ngày (YYYY-MM-DD)',
    })
    findByRoute(@Param('routeId') routeId: string, @Query('date') date?: string) {
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
    @ApiResponse({
        status: 200,
        description: 'Lịch trình đã được cập nhật thành công',
    })
    @ApiResponse({ status: 404, description: 'Không tìm thấy lịch trình' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    update(
        @Param('id') id: string,
        @Body() updateSchedulingDto: UpdateSchedulingDto,
    ) {
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
    @ApiOperation({ summary: 'Xóa lịch trình (soft delete) - Kiểm tra vé đang sử dụng' })
    @ApiResponse({
        status: 200,
        description: 'Lịch trình đã được xóa thành công',
    })
    @ApiResponse({ status: 400, description: 'Không thể xóa - có vé đang sử dụng' })
    @ApiResponse({ status: 404, description: 'Không tìm thấy lịch trình' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    remove(@Param('id') id: string) {
        return this.schedulingService.remove(id);
    }

    // Excel Import/Export Endpoints

    @Post('import/excel')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SELLER)
    @UseInterceptors(FileInterceptor('file'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Import lịch trình từ file Excel' })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({ status: 201, description: 'Import thành công' })
    @ApiResponse({ status: 400, description: 'File Excel không hợp lệ' })
    @ApiResponse({ status: 403, description: 'Không có quyền truy cập' })
    async importFromExcel(@UploadedFile() file: Express.Multer.File) {
        try {
            if (!file) {
                throw new Error('Vui lòng chọn file Excel để upload');
            }

            if (!file.originalname.match(/\.(xlsx|xls)$/)) {
                throw new Error('File phải có định dạng Excel (.xlsx hoặc .xls)');
            }

            console.log('📂 File uploaded:', {
                originalname: file.originalname,
                mimetype: file.mimetype,
                size: file.size,
            });

            const result = await this.excelImportService.importFromExcel(file);

            console.log('✅ Import completed:', {
                totalRows: result.totalRows,
                successCount: result.successCount,
                errorCount: result.errorCount,
            });

            return result;
        } catch (error) {
            console.error('❌ Import failed in controller:', error.message);
            throw error;
        }
    }

    @Post('import/validate')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SELLER)
    @UseInterceptors(FileInterceptor('file'))
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Validate file Excel trước khi import' })
    @ApiConsumes('multipart/form-data')
    @ApiResponse({ status: 200, description: 'Validation thành công' })
    @ApiResponse({ status: 400, description: 'File Excel không hợp lệ' })
    async validateImport(@UploadedFile() file: Express.Multer.File) {
        if (!file) {
            throw new Error('Vui lòng chọn file Excel để validate');
        }

        if (!file.originalname.match(/\.(xlsx|xls)$/)) {
            throw new Error('File phải có định dạng Excel (.xlsx hoặc .xls)');
        }

        return this.excelImportService.validateImportData(file);
    }

    @Get('export/template')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SELLER)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Tải template Excel để import lịch trình' })
    @ApiResponse({ status: 200, description: 'Template đã được tạo thành công' })
    async downloadTemplate(@Res() res: Response) {
        const buffer = await this.excelImportService.generateTemplate();

        res.set({
            'Content-Type':
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition': 'attachment; filename="lich_trinh_template.xlsx"',
            'Content-Length': buffer.length,
        });

        res.send(buffer);
    }
}
