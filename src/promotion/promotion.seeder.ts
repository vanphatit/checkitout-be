import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Promotion, PromotionDocument } from '../promotion/entities/promotion.entity';
import { PromotionType } from '../promotion/enums/promotion-type.enum';

interface HolidayConfig {
  name: string;
  month: number;
  day: number;
  value: number; // discount percentage
  description: string;
}

@Injectable()
export class PromotionSeeder implements OnModuleInit {
    async onModuleInit(): Promise<void> {
      await this.seed();
    }
  private readonly logger = new Logger(PromotionSeeder.name);

  constructor(@InjectModel(Promotion.name) private promoModel: Model<PromotionDocument>) {}

  /**
   * Vietnam holidays and special dates with default discount values
   * Admin can later update the discount values via API
   */
  private readonly VIETNAM_HOLIDAYS: HolidayConfig[] = [
    // Monthly double dates (1/1, 2/2, 3/3... 12/12)
    { name: 'Ngày 1/1', month: 1, day: 1, value: 3, description: 'Tết Dương lịch - Discount 3%' },
    { name: 'Ngày 2/2', month: 2, day: 2, value: 2, description: 'Ngày đặc biệt 2/2 - Discount 2%' },
    { name: 'Ngày 3/3', month: 3, day: 3, value: 2, description: 'Ngày đặc biệt 3/3 - Discount 2%' },
    { name: 'Ngày 4/4', month: 4, day: 4, value: 2, description: 'Ngày đặc biệt 4/4 - Discount 2%' },
    { name: 'Ngày 5/5', month: 5, day: 5, value: 2, description: 'Ngày đặc biệt 5/5 - Discount 2%' },
    { name: 'Ngày 6/6', month: 6, day: 6, value: 2, description: 'Ngày đặc biệt 6/6 - Discount 2%' },
    { name: 'Ngày 7/7', month: 7, day: 7, value: 2, description: 'Ngày đặc biệt 7/7 - Discount 2%' },
    { name: 'Ngày 8/8', month: 8, day: 8, value: 2, description: 'Ngày đặc biệt 8/8 - Discount 2%' },
    { name: 'Ngày 9/9', month: 9, day: 9, value: 2, description: 'Ngày đặc biệt 9/9 - Discount 2%' },
    { name: 'Ngày 10/10', month: 10, day: 10, value: 2, description: 'Ngày đặc biệt 10/10 - Discount 2%' },
    { name: 'Ngày 11/11', month: 11, day: 11, value: 2, description: 'Ngày đặc biệt 11/11 - Discount 2%' },
    { name: 'Ngày 12/12', month: 12, day: 12, value: 2, description: 'Ngày đặc biệt 12/12 - Discount 2%' },

    // Vietnam National Holidays
    { name: 'Giỗ Tổ Hùng Vương', month: 4, day: 10, value: 4, description: 'Giỗ Tổ Hùng Vương (10/3 âm lịch) - Discount 4%' },
    { name: 'Ngày Giải phóng miền Nam', month: 4, day: 30, value: 4, description: '30/4 - Ngày Giải phóng miền Nam - Discount 4%' },
    { name: 'Ngày Quốc tế Lao động', month: 5, day: 1, value: 4, description: '1/5 - Ngày Quốc tế Lao động - Discount 4%' },
    { name: 'Ngày Quốc khánh', month: 9, day: 2, value: 4, description: '2/9 - Ngày Quốc khánh - Discount 4%' },

    // International holidays observed in Vietnam
    { name: 'Ngày Quốc tế Phụ nữ', month: 3, day: 8, value: 3, description: '8/3 - Ngày Quốc tế Phụ nữ - Discount 3%' },
    { name: 'Ngày Phụ nữ Việt Nam', month: 10, day: 20, value: 3, description: '20/10 - Ngày Phụ nữ Việt Nam - Discount 3%' },
    { name: 'Ngày Nhà giáo Việt Nam', month: 11, day: 20, value: 3, description: '20/11 - Ngày Nhà giáo Việt Nam - Discount 3%' },

    // Valentine's Day & Special occasions
    { name: 'Valentine', month: 2, day: 14, value: 3, description: 'Valentine Day - Discount 3%' },
    { name: 'Noel', month: 12, day: 24, value: 4, description: 'Christmas Eve - Discount 4%' },
    { name: 'Giáng sinh', month: 12, day: 25, value: 4, description: 'Christmas Day - Discount 4%' },
  ];

  async seed() {
    this.logger.log('🌱 Starting Promotion seeding...');

    try {
      // 1. Create DEFAULT promotion (0% for regular days)
      await this.seedDefaultPromotion();

      // 2. Create RECURRING promotions for holidays
      await this.seedRecurringPromotions();

      this.logger.log('✅ Promotion seeding completed successfully');
    } catch (error) {
      this.logger.error('❌ Error seeding promotions:', error);
      throw error;
    }
  }

  private async seedDefaultPromotion() {
    const existing = await this.promoModel.findOne({ type: PromotionType.DEFAULT });

    if (existing) {
      this.logger.log('⏭️  Default promotion already exists, skipping...');
      return;
    }

    const currentYear = new Date().getFullYear();
    const defaultPromo = new this.promoModel({
      name: 'Ngày thường - Regular Day',
      type: PromotionType.DEFAULT,
      startDate: new Date(`${currentYear}-01-01`),
      expiryDate: new Date(`${currentYear + 100}-12-31`), // Far future
      value: 0,
      isActive: true,
      description: 'Default 0% discount for regular days',
    });

    await defaultPromo.save();
    this.logger.log('✅ Created DEFAULT promotion (0%)');
  }

  private async seedRecurringPromotions() {
    const currentYear = new Date().getFullYear();

    for (const holiday of this.VIETNAM_HOLIDAYS) {
      const existing = await this.promoModel.findOne({
        type: PromotionType.RECURRING,
        recurringMonth: holiday.month,
        recurringDay: holiday.day,
      });

      if (existing) {
        this.logger.log(`⏭️  Recurring promotion for ${holiday.name} already exists, skipping...`);
        continue;
      }

      const recurringPromo = new this.promoModel({
        name: holiday.name,
        type: PromotionType.RECURRING,
        startDate: new Date(`${currentYear}-${String(holiday.month).padStart(2, '0')}-${String(holiday.day).padStart(2, '0')}`),
        expiryDate: new Date(`${currentYear + 100}-${String(holiday.month).padStart(2, '0')}-${String(holiday.day).padStart(2, '0')}`),
        value: holiday.value,
        recurringMonth: holiday.month,
        recurringDay: holiday.day,
        isActive: true,
        description: holiday.description,
      });

      await recurringPromo.save();
      this.logger.log(`✅ Created recurring promotion: ${holiday.name} (${holiday.value}%)`);
    }
  }

  /**
   * Optional: Clean all promotions (use with caution)
   */
  async clean() {
    this.logger.log('🧹 Cleaning all promotions...');
    await this.promoModel.deleteMany({});
    this.logger.log('✅ All promotions cleaned');
  }

  /**
   * Update a specific recurring promotion's value
   */
  async updateRecurringValue(month: number, day: number, newValue: number) {
    const updated = await this.promoModel.findOneAndUpdate(
      {
        type: PromotionType.RECURRING,
        recurringMonth: month,
        recurringDay: day,
      },
      { value: newValue },
      { new: true }
    );

    if (updated) {
      this.logger.log(`✅ Updated promotion ${month}/${day} to ${newValue}%`);
    }

    return updated;
  }
}