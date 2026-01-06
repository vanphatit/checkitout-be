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
import { BusImageDto, CreateBusDto } from './dto/create-bus.dto';
import { UpdateBusDto } from './dto/update-bus.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { FilesInterceptor } from '@nestjs/platform-express';
import { UserRole } from '../users/enums/user-role.enum';
import { Roles } from '../common/decorators/roles.decorator';
import { BadRequestException } from '@nestjs/common/exceptions';
import {
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
} from '@nestjs/common/decorators';
import { ExcelFileInterceptor } from './interceptor/excel-file.interceptor';
import { UpdateBusStatusDto } from './dto/update-bus-status.dto';
import * as fs from 'fs';
import { PaginationDto } from './dto/bus-pagination.dto';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';

@Controller('buses')
export class BusController {
  constructor(
    private readonly busService: BusService,
    private readonly cloudinaryService: CloudinaryService,
  ) { }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @UseInterceptors(FilesInterceptor('images', 5))
  async createBus(
    @Body() createBusDto: CreateBusDto,
    @UploadedFiles() images: Express.Multer.File[],
  ) {
    let uploadedImages: BusImageDto[] = [];

    if (images?.length) {
      uploadedImages = await this.cloudinaryService.uploadFiles(
        images,
        'buses',
      );
    }

    // Tạo bus + sinh ghế + gán images
    return this.busService.createWithSeats({
      ...createBusDto,
      images: uploadedImages,
    });
  }

  // @Post('import')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  // @UseInterceptors(ExcelFileInterceptor())
  // async importExcel(@UploadedFile() file: Express.Multer.File) {
  //   if (!file) {
  //     throw new BadRequestException('File Excel is required');
  //   }

  //   try {
  //     const result = await this.busService.importFromExcel(file.path);
  //     return result;
  //   } finally {
  //     fs.unlink(file.path, () => { });
  //   }
  // }

  @Get()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.busService.findAll(paginationDto);
  }

  @Get('statistics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  getStatistics() {
    return this.busService.getBusStatistics();
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  findOne(@Param('id') id: string) {
    return this.busService.findOne(id);
  }

  // @Patch(':id')
  // @UseGuards(JwtAuthGuard, RolesGuard)
  // @Roles(UserRole.ADMIN)
  // update(@Param('id') id: string, @Body() updateBusDto: UpdateBusDto) {
  //   return this.busService.update(id, updateBusDto);
  // }

  @Patch(':id')
  @UseInterceptors(FilesInterceptor('images', 5))
  async updateBus(
    @Param('id') id: string,
    @Body() updateBusDto: UpdateBusDto,
    @UploadedFiles() images: Express.Multer.File[],
  ) {
    try {
      return await this.busService.update(id, updateBusDto, images);
    } catch (error) {
      console.error('Update Bus error:', error);
      throw new BadRequestException(error.message || 'Update failed');
    }
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

  @Delete(':busId/images')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async deleteBusImage(
    @Param('busId') busId: string,
    @Query('publicId') publicId: string,
  ) {
    try {
      return await this.busService.removeImage(busId, publicId);
    } catch (error) {
      console.error('Delete bus image error:', error);
      throw new BadRequestException(error.message || 'Xóa ảnh thất bại');
    }
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@Param('id') id: string) {
    return this.busService.remove(id);
  }
}
