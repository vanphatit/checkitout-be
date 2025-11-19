import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  Query,
  UseGuards,
} from '@nestjs/common';
import { BusService } from './bus.service';
import { CreateBusDto } from './dto/create-bus.dto';
import { UpdateBusDto } from './dto/update-bus.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../users/enums/user-role.enum';
import { Roles } from '../common/decorators/roles.decorator';
import { BadRequestException } from '@nestjs/common/exceptions';
import { UseInterceptors, UploadedFile } from '@nestjs/common/decorators';
import { ExcelFileInterceptor } from './interceptor/excel-file.interceptor';
import { UpdateBusStatusDto } from './dto/update-bus-status.dto';
import * as fs from 'fs';

@Controller('buses')
export class BusController {
  constructor(private readonly busService: BusService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() createBusDto: CreateBusDto) {
    return this.busService.create(createBusDto);
  }

  @Post('import')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(ExcelFileInterceptor())
  async importExcel(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File Excel is required');
    }

    try {
      const result = await this.busService.importFromExcel(file.path);
      return result;
    } finally {
      fs.unlink(file.path, () => {});
    }
  }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.busService.findAll(paginationDto);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  findOne(@Param('id') id: string) {
    return this.busService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() updateBusDto: UpdateBusDto) {
    return this.busService.update(id, updateBusDto);
  }

  @Patch(':busId/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SELLER)
  updateStatus(
    @Param('busId') busId: string,
    @Body() updateBusStatusDto: UpdateBusStatusDto,
  ) {
    return this.busService.updateStatus(busId, updateBusStatusDto.status);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.busService.remove(id);
  }
}
