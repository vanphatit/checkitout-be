import {
    Controller,
    Post,
    Body,
    Get, 
    Param,
    Patch,
    Delete,
    UseGuards,
    Query
} from '@nestjs/common';
import { PromotionService } from './promotion.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery, ApiOkResponse } from '@nestjs/swagger';
import { PaginatedResult } from 'src/common/dto/pagination.dto';
import { Promotion } from './entities/promotion.entity';
import { PaginationDto } from 'src/common/dto/pagination.dto';

@ApiTags('Promotion')
@Controller('promotion')
export class PromotionController {
  constructor(private readonly promoService: PromotionService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create promotion' })
  create(@Body() dto: CreatePromotionDto) {
    return this.promoService.create(dto);
  }
    @Get()
    @ApiOperation({ summary: 'List promotions (with pagination & filters)' })
    @ApiQuery({ name: 'search', required: false, type: String })
    @ApiQuery({ name: 'startDate', required: false, type: String, description: 'ISO date, filters promotions with startDate >= this date' })
    @ApiQuery({ name: 'expiryDate', required: false, type: String, description: 'ISO date, filters promotions with expiryDate <= this date (inclusive end of day)' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'sortBy', required: false, type: String })
    @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
    @ApiOkResponse({ description: 'Paginated promotions result' })
    findAll(@Query() paginationDto: PaginationDto): Promise<PaginatedResult<Promotion>> {
      return this.promoService.findAll(paginationDto);
    }

  @Get(':id')
  @ApiOperation({ summary: 'Get promotion' })
  findOne(@Param('id') id: string) {
    return this.promoService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update promotion' })
  update(@Param('id') id: string, @Body() dto: UpdatePromotionDto) {
    return this.promoService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete promotion' })
  remove(@Param('id') id: string) {
    return this.promoService.remove(id);
  }
}
