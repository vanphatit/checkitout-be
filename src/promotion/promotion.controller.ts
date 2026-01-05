import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  UseGuards,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { GetUser } from '../common/decorators/get-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiQuery,
  ApiOkResponse,
} from '@nestjs/swagger';
import { PaginatedResult } from 'src/common/dto/pagination.dto';
import { Promotion } from './entities/promotion.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';

interface JwtUser {
  userId: string;
  role: UserRole;
  email?: string;
  phone: string;
}

@ApiTags('Promotion')
@Controller('promotion')
export class PromotionController {
  constructor(private readonly promoService: PromotionService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Create promotion' })
  @ApiResponse({ status: 201, description: 'Promotion created successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  create(@Body() dto: CreatePromotionDto) {
    return this.promoService.create(dto);
  }

  @Get('stats')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get promotion statistics' })
  @ApiResponse({
    status: 200,
    description: 'Promotion statistics retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        total: { type: 'number', example: 15 },
        active: { type: 'number', example: 12 },
        inactive: { type: 'number', example: 3 },
        byType: {
          type: 'object',
          properties: {
            DEFAULT: { type: 'number', example: 1 },
            RECURRING: { type: 'number', example: 8 },
            SPECIAL: { type: 'number', example: 6 },
          },
        },
      },
    },
  })
  getStats(@GetUser() user?: JwtUser) {
    const role = user?.role; // undefined = GUEST
    return this.promoService.getStats(role);
  }

  @Get()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List promotions (with pagination & filters)' })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'sortBy', required: false, type: String })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description:
      'Filter by active status. ADMIN/SELLER can use this to see all promotions.',
  })
  @ApiOkResponse({ description: 'Paginated promotions result' })
  findAll(
    @Query() paginationDto: PaginationDto,
    @GetUser() user?: JwtUser,
  ): Promise<PaginatedResult<Promotion>> {
    const role = user?.role; // undefined = GUEST
    return this.promoService.findAll(paginationDto, role);
  }

  @Get(':id')
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'Get promotion by ID' })
  @ApiResponse({ status: 200, description: 'Promotion found' })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  findOne(@Param('id') id: string, @GetUser() user?: JwtUser) {
    return this.promoService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Update promotion' })
  @ApiResponse({ status: 200, description: 'Promotion updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - validation error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  update(
    @Param('id') id: string,
    @Body(new ValidationPipe({ whitelist: true })) dto: UpdatePromotionDto,
  ) {
    return this.promoService.update(id, dto);
  }

  @Patch(':id/disable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Disable promotion' })
  @ApiResponse({ status: 200, description: 'Promotion disabled successfully' })
  @ApiResponse({
    status: 400,
    description: 'Cannot disable DEFAULT promotion or already disabled',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  remove(@Param('id') id: string) {
    return this.promoService.remove(id);
  }

  @Patch(':id/enable')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ summary: 'Enable promotion' })
  @ApiResponse({ status: 200, description: 'Promotion enabled successfully' })
  @ApiResponse({
    status: 400,
    description: 'Promotion is already enabled',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - insufficient permissions',
  })
  @ApiResponse({ status: 404, description: 'Promotion not found' })
  enable(@Param('id') id: string) {
    return this.promoService.enable(id);
  }
}
