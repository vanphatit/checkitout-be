import { Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../users/enums/user-role.enum';
import { SearchService } from './search.service';

@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SearchController {
    constructor(
        private readonly searchService: SearchService,
    ) { }

    @Post('health-check')
    @Roles(UserRole.ADMIN)
    @ApiOperation({
        summary: 'Kiểm tra trạng thái Elasticsearch',
        description: 'Kiểm tra xem Elasticsearch có hoạt động bình thường không'
    })
    @ApiResponse({ status: 201, description: 'Elasticsearch health check' })
    async healthCheck() {
        const isHealthy = await this.searchService.checkHealth();
        return {
            success: isHealthy,
            message: isHealthy ? 'Elasticsearch is healthy' : 'Elasticsearch is not responding',
        };
    }
}
