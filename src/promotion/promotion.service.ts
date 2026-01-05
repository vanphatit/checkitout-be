/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Promotion, PromotionDocument } from './entities/promotion.entity';
import { PromotionType } from '../promotion/enums/promotion-type.enum';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from '../promotion/dto/update-promotion.dto';
import { UpdatePromotionValueDto } from './dto/update-promotion-value.dto';
import { PaginationDto, PaginatedResult } from '../common/dto/pagination.dto';
import { UserRole } from '../users/enums/user-role.enum';

@Injectable()
export class PromotionService {
  constructor(
    @InjectModel(Promotion.name) private promoModel: Model<PromotionDocument>,
  ) {}

  async create(dto: CreatePromotionDto) {
    const start = new Date(dto.startDate);
    const expiry = new Date(dto.expiryDate);
    const now = new Date();

    // Validation
    if (isNaN(start.getTime()) || isNaN(expiry.getTime())) {
      throw new BadRequestException('Invalid startDate or expiryDate');
    }

    if (start.getTime() > expiry.getTime()) {
      throw new BadRequestException('startDate must be before expiryDate');
    }

    // Check duplicate name
    const existingByName = await this.promoModel.findOne({
      name: { $regex: `^${dto.name}$`, $options: 'i' },
    });

    if (existingByName) {
      throw new BadRequestException(
        `Promotion name "${dto.name}" already exists`,
      );
    }

    // Only check for past dates on non-recurring promotions
    if (
      dto.type !== PromotionType.RECURRING &&
      start.getTime() < now.getTime()
    ) {
      throw new BadRequestException(
        'startDate cannot be in the past for non-recurring promotions',
      );
    }

    // Validate recurring fields
    if (dto.type === PromotionType.RECURRING) {
      if (!dto.recurringMonth || !dto.recurringDay) {
        throw new BadRequestException(
          'recurringMonth and recurringDay are required for recurring promotions',
        );
      }

      // Check if recurring promotion already exists for this date
      const existing = await this.promoModel.findOne({
        type: PromotionType.RECURRING,
        recurringMonth: dto.recurringMonth,
        recurringDay: dto.recurringDay,
      });

      if (existing) {
        throw new BadRequestException(
          `A recurring promotion already exists for ${dto.recurringMonth}/${dto.recurringDay}`,
        );
      }
    }

    const created = new this.promoModel({
      ...dto,
      startDate: start,
      expiryDate: expiry,
    });

    return created.save();
  }

  async getStats(userRole?: UserRole) {
    const query: any = {};

    // Role-based visibility
    if (!userRole || userRole === UserRole.CUSTOMER) {
      // GUEST & CUSTOMER - only active promotions
      query.isActive = true;
    }
    // ADMIN & SELLER - see all promotions

    const [total, active, inactive, typeStats] = await Promise.all([
      this.promoModel.countDocuments(query).exec(),
      this.promoModel.countDocuments({ ...query, isActive: true }).exec(),
      this.promoModel.countDocuments({ ...query, isActive: false }).exec(),
      this.promoModel
        .aggregate([
          { $match: query },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ])
        .exec(),
    ]);

    // Transform type stats into a more readable format
    const typeCount = {
      [PromotionType.DEFAULT]: 0,
      [PromotionType.RECURRING]: 0,
      [PromotionType.SPECIAL]: 0,
    };

    typeStats.forEach((stat) => {
      if (stat._id in typeCount) {
        typeCount[stat._id] = stat.count;
      }
    });

    return {
      total,
      active,
      inactive,
      byType: typeCount,
    };
  }

  async findAll(
    paginationDto: PaginationDto,
    userRole?: UserRole,
  ): Promise<PaginatedResult<Promotion>> {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      search,
      isActive,
    } = paginationDto as any;

    const query: any = {};

    // Search by name / description
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
      ];
    }

    // Role-based visibility
    if (!userRole || userRole === UserRole.CUSTOMER) {
      // GUEST (no role) & CUSTOMER - always active only
      query.isActive = true;
    } else if (userRole === UserRole.ADMIN || userRole === UserRole.SELLER) {
      // ADMIN & SELLER
      if (isActive !== undefined) {
        // If isActive is explicitly set, filter by it
        query.isActive = isActive;
      }
      // If isActive is not set, return all (both active and inactive)
    }

    const sort: any = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.promoModel
        .find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
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

    // Cannot change type or recurring dates
    if (
      existing.type === PromotionType.RECURRING ||
      existing.type === PromotionType.DEFAULT
    ) {
      // Only allow updating value, name, description, isActive for recurring/default
      const allowedUpdates: any = {};
      if (dto.value !== undefined) allowedUpdates.value = dto.value;
      if (dto.name !== undefined) allowedUpdates.name = dto.name;
      if (dto.description !== undefined)
        allowedUpdates.description = dto.description;
      if (dto.isActive !== undefined) allowedUpdates.isActive = dto.isActive;

      const updated = await this.promoModel.findByIdAndUpdate(
        id,
        allowedUpdates,
        { new: true },
      );
      return updated;
    }

    // For special promotions, allow full update
    const now = new Date();
    const newStart = dto.startDate
      ? new Date(dto.startDate)
      : existing.startDate;
    const newExpiry = dto.expiryDate
      ? new Date(dto.expiryDate)
      : existing.expiryDate;

    if (isNaN(newStart.getTime()) || isNaN(newExpiry.getTime())) {
      throw new BadRequestException('Invalid startDate or expiryDate');
    }

    if (newStart.getTime() > newExpiry.getTime()) {
      throw new BadRequestException('startDate must be before expiryDate');
    }

    const item = await this.promoModel.findByIdAndUpdate(
      id,
      { ...dto, startDate: newStart, expiryDate: newExpiry },
      { new: true },
    );

    return item;
  }

  async updateValue(id: string, dto: UpdatePromotionValueDto) {
    const existing = await this.promoModel.findById(id).exec();
    if (!existing) throw new NotFoundException('Promotion not found');

    const updated = await this.promoModel.findByIdAndUpdate(
      id,
      { value: dto.value, description: dto.description },
      { new: true },
    );

    return updated;
  }

  async remove(id: string) {
    const existing = await this.promoModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException('Promotion not found');
    }

    // DEFAULT promotion không được disable
    if (existing.type === PromotionType.DEFAULT) {
      throw new BadRequestException('Cannot disable DEFAULT promotion');
    }

    // Nếu đã inactive rồi
    if (!existing.isActive) {
      throw new BadRequestException('Promotion is already disabled');
    }

    existing.isActive = false;
    await existing.save();

    return {
      message: 'Promotion disabled successfully',
    };
  }

  async enable(id: string) {
    const existing = await this.promoModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException('Promotion not found');
    }

    // Nếu đã active rồi
    if (existing.isActive) {
      throw new BadRequestException('Promotion is already enabled');
    }

    existing.isActive = true;
    await existing.save();

    return {
      message: 'Promotion enabled successfully',
    };
  }

  // ============================================
  // BUSINESS LOGIC METHODS
  // ============================================

  /**
   * Find applicable promotion for a specific scheduling date
   * Returns the best matching promotion (recurring holiday > special > default)
   */
  async findApplicablePromotion(schedulingDate: Date): Promise<Promotion> {
    const year = schedulingDate.getFullYear();
    const month = schedulingDate.getMonth() + 1; // 1-12
    const day = schedulingDate.getDate(); // 1-31

    // 1. Check for recurring promotion (holidays)
    const recurringPromo = await this.promoModel.findOne({
      type: PromotionType.RECURRING,
      recurringMonth: month,
      recurringDay: day,
      isActive: true,
    });

    if (recurringPromo) {
      return recurringPromo;
    }

    // 2. Check for special promotion that covers this date
    const specialPromo = await this.promoModel.findOne({
      type: PromotionType.SPECIAL,
      startDate: { $lte: schedulingDate },
      expiryDate: { $gte: schedulingDate },
      isActive: true,
    });

    if (specialPromo) {
      return specialPromo;
    }

    // 3. Return default promotion (0%)
    const defaultPromo = await this.promoModel.findOne({
      type: PromotionType.DEFAULT,
      isActive: true,
    });

    if (!defaultPromo) {
      throw new NotFoundException(
        'Default promotion not found. Please run seeder.',
      );
    }

    return defaultPromo;
  }

  /**
   * Get default promotion (0% for regular days)
   */
  async getDefaultPromotion(): Promise<Promotion> {
    const defaultPromo = await this.promoModel.findOne({
      type: PromotionType.DEFAULT,
      isActive: true,
    });

    if (!defaultPromo) {
      throw new NotFoundException(
        'Default promotion not found. Please run seeder.',
      );
    }

    return defaultPromo;
  }

  /**
   * Get all recurring promotions (holidays)
   */
  async getRecurringPromotions(): Promise<Promotion[]> {
    return this.promoModel
      .find({
        type: PromotionType.RECURRING,
        isActive: true,
      })
      .sort({ recurringMonth: 1, recurringDay: 1 })
      .exec();
  }

  /**
   * Validate if promotion can be applied to a ticket's scheduling date
   */
  async validatePromotionForDate(
    promotionId: string,
    schedulingDate: Date,
  ): Promise<boolean> {
    const promotion = await this.findOne(promotionId);

    if (!promotion.isActive) {
      throw new BadRequestException('Promotion is not active');
    }

    const month = schedulingDate.getMonth() + 1;
    const day = schedulingDate.getDate();

    if (promotion.type === PromotionType.RECURRING) {
      // Check if scheduling date matches recurring date
      if (
        promotion.recurringMonth !== month ||
        promotion.recurringDay !== day
      ) {
        throw new BadRequestException(
          'Promotion does not match the scheduling date',
        );
      }
    } else if (promotion.type === PromotionType.SPECIAL) {
      // Check if scheduling date is within promotion period
      if (
        schedulingDate < promotion.startDate ||
        schedulingDate > promotion.expiryDate
      ) {
        throw new BadRequestException(
          'Scheduling date is outside promotion period',
        );
      }
    }

    return true;
  }

  /**
   * Calculate discount amount
   */
  calculateDiscount(originalPrice: number, promotionValue: number): number {
    const discount = (originalPrice * promotionValue) / 100;
    return Math.round(discount * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate final price after discount
   */
  calculateFinalPrice(originalPrice: number, promotionValue: number): number {
    const discount = this.calculateDiscount(originalPrice, promotionValue);
    return originalPrice - discount;
  }
}
