import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Promotion, PromotionDocument } from './entities/promotion.entity';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { BadRequestException } from '@nestjs/common';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';

@Injectable()
export class PromotionService {
  constructor(@InjectModel(Promotion.name) private promoModel: Model<PromotionDocument>) {}

  async create(dto: CreatePromotionDto) {
    const start = new Date(dto.startDate);
    const expiry = new Date(dto.expiryDate);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(expiry.getTime())) {
      throw new BadRequestException('Invalid startDate or expiryDate');
    }

    if (start.getTime() > expiry.getTime()) {
      throw new BadRequestException('startDate must be before expiryDate');
    }

    if (start.getTime() < now.getTime() || expiry.getTime() < now.getTime()) {
      throw new BadRequestException('startDate and expiryDate cannot be in the past');
    }

    const created = new this.promoModel({
      ...dto,
      startDate: start,
      expiryDate: expiry,
    });
    return created.save();
  }

  async findAll(paginationDto: PaginationDto): Promise<PaginatedResult<Promotion>> {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', search, startDate, expiryDate } = paginationDto as any;

    // Build query
    const query: any = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
      ];
    }

    // Date range filters: startDate => promotions that start on/after this date
    // expiryDate => promotions that end on/before this date
    if (startDate) {
      const sd = new Date(startDate);
      if (!isNaN(sd.getTime())) {
        query.startDate = query.startDate || {};
        query.startDate.$gte = sd;
      }
    }

    if (expiryDate) {
      const ed = new Date(expiryDate);
      if (!isNaN(ed.getTime())) {
        // treat expiryDate filter as inclusive to end of day
        const edInclusive = new Date(ed);
        edInclusive.setHours(23, 59, 59, 999);
        query.expiryDate = query.expiryDate || {};
        query.expiryDate.$lte = edInclusive;
      }
    }

    // Build sort
    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.promoModel.find(query).sort(sort).skip(skip).limit(limit).lean().exec(),
      this.promoModel.countDocuments(query).exec(),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      data,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  }

  async findOne(id: string) {
    const item = await this.promoModel.findById(id).exec();
    if (!item) throw new NotFoundException('Promotion not found');
    return item;
  }

  async update(id: string, dto: UpdatePromotionDto) {
    const existing = await this.promoModel.findById(id).exec();
    if (!existing) throw new NotFoundException('Promotion not found');

    const now = new Date();

    const newStart = dto.startDate ? new Date(dto.startDate as any) : existing.startDate;
    const newExpiry = dto.expiryDate ? new Date(dto.expiryDate as any) : existing.expiryDate;

    if (isNaN(newStart.getTime()) || isNaN(newExpiry.getTime())) {
      throw new BadRequestException('Invalid startDate or expiryDate');
    }

    if (newStart.getTime() > newExpiry.getTime()) {
      throw new BadRequestException('startDate must be before expiryDate');
    }

    if (newStart.getTime() < now.getTime() || newExpiry.getTime() < now.getTime()) {
      throw new BadRequestException('startDate and expiryDate cannot be in the past');
    }

    const item = await this.promoModel.findByIdAndUpdate(id, { ...dto, startDate: newStart, expiryDate: newExpiry }, { new: true });
    if (!item) throw new NotFoundException('Promotion not found');
    return item;
  }

    async remove(id: string) {
        // Kiểm tra xem Price đã được sử dụng bởi Ticket nào chưa
        // chưa validate
        const used = await this.promoModel.exists({ promotionId: id });
        if (used) {
          throw new BadRequestException('Cannot delete Promotion: it is used by existing tickets');
        }
    const item = await this.promoModel.findByIdAndDelete(id);
    if (!item) throw new NotFoundException('Promotion not found');
    return { message: 'Promotion deleted' };
  }
}
