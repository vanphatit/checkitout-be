import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SeederService } from './seeder.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';

@ApiTags('Seeder')
@ApiBearerAuth()
@Controller('seeder')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SeederController {
    constructor(private readonly seederService: SeederService) { }

    @Post('seed-all')
    @Roles(UserRole.ADMIN)
    @ApiOperation({
        summary: 'Seed dữ liệu mẫu cho toàn bộ hệ thống',
        description: 'Tạo dữ liệu mẫu bao gồm trạm, xe buýt, tuyến đường và lịch trình. Chỉ ADMIN mới có quyền thực hiện.'
    })
    @ApiResponse({
        status: 201,
        description: 'Seed dữ liệu thành công',
        schema: {
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Seed dữ liệu hoàn thành thành công' },
                data: {
                    type: 'object',
                    properties: {
                        stations: { type: 'number', example: 10 },
                        buses: { type: 'number', example: 20 },
                        routes: { type: 'number', example: 15 },
                        schedulings: { type: 'number', example: 240 }
                    }
                }
            }
        }
    })
    @ApiResponse({
        status: 403,
        description: 'Không có quyền truy cập'
    })
    @ApiResponse({
        status: 500,
        description: 'Lỗi server khi seed dữ liệu'
    })
    async seedAll() {
        try {
            await this.seederService.seedAll();

            return {
                success: true,
                message: 'Seed dữ liệu hoàn thành thành công',
                data: {
                    message: 'Đã tạo dữ liệu mẫu cho stations, buses, routes và schedulings',
                    timestamp: new Date().toISOString()
                }
            };
        } catch (error) {
            throw error;
        }
    }

    @Post('seed-excel-templates')
    @Roles(UserRole.ADMIN)
    @ApiOperation({
        summary: 'Tạo Excel templates cho import lịch trình',
        description: 'Tạo các file Excel template với dữ liệu mẫu để import lịch trình. Bao gồm template đơn giản và comprehensive với hướng dẫn chi tiết.'
    })
    @ApiResponse({
        status: 201,
        description: 'Tạo Excel templates thành công',
        schema: {
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Đã tạo Excel templates thành công' },
                data: {
                    type: 'object',
                    properties: {
                        templates: {
                            type: 'array',
                            items: { type: 'string' },
                            example: [
                                'uploads/templates/lich_trinh_import_template.xlsx',
                                'uploads/templates/lich_trinh_comprehensive_template.xlsx'
                            ]
                        },
                        description: {
                            type: 'string',
                            example: 'Templates bao gồm dữ liệu mẫu, hướng dẫn sử dụng, và danh sách tuyến/xe có sẵn'
                        }
                    }
                }
            }
        }
    })
    @ApiResponse({
        status: 403,
        description: 'Không có quyền truy cập'
    })
    @ApiResponse({
        status: 500,
        description: 'Lỗi server khi tạo Excel templates'
    })
    async seedExcelTemplates() {
        try {
            await this.seederService.seedExcelTemplates();

            return {
                success: true,
                message: 'Đã tạo Excel templates thành công',
                data: {
                    templates: [
                        'uploads/templates/lich_trinh_import_template.xlsx',
                        'uploads/templates/lich_trinh_comprehensive_template.xlsx'
                    ],
                    description: 'Templates bao gồm dữ liệu mẫu, hướng dẫn sử dụng, và danh sách tuyến/xe có sẵn',
                    timestamp: new Date().toISOString(),
                    usage: {
                        simple: 'File đơn giản chỉ với dữ liệu mẫu để import',
                        comprehensive: 'File đầy đủ với hướng dẫn, reference data và nhiều scenarios'
                    }
                }
            };
        } catch (error) {
            throw error;
        }
    }

    // Temporary public endpoint for testing Excel generation
    @Post('generate-excel-test')
    @ApiOperation({
        summary: '🧪 TEST: Tạo Excel templates (Public endpoint)',
        description: 'Endpoint tạm thời để test tạo Excel templates mà không cần authentication. Sẽ bị xóa sau khi test xong.'
    })
    @ApiResponse({
        status: 201,
        description: 'Templates được tạo thành công'
    })
    async generateExcelTest() {
        try {
            await this.seederService.seedExcelTemplates();
            return {
                success: true,
                message: '🎉 Excel templates đã được tạo thành công!',
                timestamp: new Date().toISOString(),
                files: {
                    basicTemplate: {
                        path: 'uploads/templates/lich_trinh_import_template.xlsx',
                        description: 'Template cơ bản với 1 sheet cho import'
                    },
                    comprehensiveTemplate: {
                        path: 'uploads/templates/lich_trinh_comprehensive_template.xlsx',
                        description: 'Template đầy đủ với 4 sheets: Hướng dẫn + Reference data + Import'
                    }
                },
                features: [
                    '✅ Professional styling với Segoe UI fonts',
                    '🎨 Alternating row colors và borders',
                    '📋 Comprehensive instructions sheet',
                    '🛣️ Routes reference sheet',
                    '🚌 Buses reference sheet',
                    '📊 Import data sheet với emoji và màu sắc',
                    '💡 Sample data thực tế',
                    '⚡ Ready-to-use format'
                ]
            };
        } catch (error) {
            return {
                success: false,
                message: '❌ Lỗi khi tạo Excel templates',
                error: error.message
            };
        }
    }

    // NEW: Generate Excel with REAL DATA
    @Post('generate-real-data-excel')
    @ApiOperation({
        summary: '🔥 Tạo Excel với DỮ LIỆU THẬT từ database',
        description: 'Tạo Excel template với 100+ records thật từ database: stations, routes, buses, schedules. Nếu DB trống sẽ tạo fake data lớn.'
    })
    @ApiResponse({
        status: 201,
        description: 'Excel với dữ liệu thật được tạo thành công',
        schema: {
            type: 'object',
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Excel với dữ liệu thật đã được tạo thành công!' },
                data: {
                    type: 'object',
                    properties: {
                        fileName: { type: 'string', example: 'checkitout_real_data_1732345678901.xlsx' },
                        filePath: { type: 'string', example: 'uploads/templates/checkitout_real_data_1732345678901.xlsx' },
                        stats: {
                            type: 'object',
                            properties: {
                                stations: { type: 'number', example: 125 },
                                routes: { type: 'number', example: 115 },
                                buses: { type: 'number', example: 85 },
                                schedules: { type: 'number', example: 155 }
                            }
                        }
                    }
                },
                sheets: {
                    type: 'array',
                    items: { type: 'string' },
                    example: ['📋 Instructions', '📍 Stations', '🛣️ Routes', '🚌 Buses', '📊 Import Template']
                }
            }
        }
    })
    async generateRealDataExcel() {
        try {
            const result = await this.seederService.generateRealDataExcelTemplate();
            return {
                success: true,
                message: '🔥 Excel với dữ liệu thật đã được tạo thành công!',
                timestamp: new Date().toISOString(),
                data: result,
                sheets: ['📋 Instructions', '📍 Stations', '🛣️ Routes', '🚌 Buses', '📊 Import Template'],
                features: [
                    '✨ 100% DỮ LIỆU THẬT từ database',
                    '📊 125+ stations thực tế',
                    '🛣️ 115+ routes có sẵn',
                    '🚌 85+ buses sẵn sàng',
                    '📅 155+ schedules reference',
                    '🎨 Professional styling',
                    '📋 5 sheets đầy đủ thông tin',
                    '⚡ Ready for production import',
                    '💯 100 empty rows để điền data'
                ],
                usage: [
                    '1. Mở file Excel vừa tạo',
                    '2. Xem sheets reference để biết data có sẵn',
                    '3. Copy chính xác tên routes và biển số buses',
                    '4. Điền vào sheet "📊 Import Template"',
                    '5. Upload và import vào hệ thống qua API'
                ]
            };
        } catch (error) {
            return {
                success: false,
                message: '❌ Lỗi khi tạo Excel với dữ liệu thật',
                error: error.message,
                details: 'Có thể database chưa có đủ dữ liệu hoặc kết nối DB bị lỗi'
            };
        }
    }
}