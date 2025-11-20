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
}