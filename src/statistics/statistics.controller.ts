import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { StatisticsService } from './statistics.service';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { RolesGuard } from '../auth/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Statistics')
@Controller('statistics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class StatisticsController {
    constructor(private readonly statisticsService: StatisticsService) { }

    @Get('overview')
    @ApiOperation({ summary: 'Get dashboard overview statistics' })
    async getOverview() {
        return this.statisticsService.getOverview();
    }

    @Get('revenue')
    @ApiOperation({ summary: 'Get revenue trend by period' })
    @ApiQuery({ name: 'period', enum: ['7d', '30d', '12m'], required: false })
    async getRevenueTrend(@Query('period') period: string = '7d') {
        return this.statisticsService.getRevenueTrend(period);
    }

    @Get('routes/top')
    @ApiOperation({ summary: 'Get top routes by revenue' })
    @ApiQuery({ name: 'limit', type: Number, required: false })
    async getTopRoutes(@Query('limit') limit: number = 10) {
        return this.statisticsService.getTopRoutes(limit);
    }

    @Get('tickets/status')
    @ApiOperation({ summary: 'Get ticket status distribution' })
    async getTicketStatusDistribution() {
        return this.statisticsService.getTicketStatusDistribution();
    }

    @Get('schedulings/status')
    @ApiOperation({ summary: 'Get scheduling status for today' })
    async getSchedulingStatusToday() {
        return this.statisticsService.getSchedulingStatusToday();
    }

    @Get('schedulings/summary')
    @ApiOperation({ summary: 'Get summary statistics for today schedulings' })
    async getTodaySchedulingSummary() {
        return this.statisticsService.getTodaySchedulingSummary();
    }

    @Get('buses/today')
    @ApiOperation({ summary: 'Get buses operating today' })
    async getBusesToday() {
        return this.statisticsService.getBusesToday();
    }

    @Get('occupancy')
    @ApiOperation({ summary: 'Get average seat occupancy trend' })
    @ApiQuery({ name: 'days', type: Number, required: false })
    async getOccupancyTrend(@Query('days') days: number = 7) {
        return this.statisticsService.getOccupancyTrend(days);
    }

    @Get('schedulings/today-details')
    @ApiOperation({ summary: 'Get detailed schedulings for today with buses and routes' })
    async getSchedulingDetailsToday() {
        return this.statisticsService.getSchedulingDetailsToday();
    }
}
