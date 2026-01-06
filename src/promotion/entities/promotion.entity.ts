import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PromotionType } from '../enums/promotion-type.enum';
import { slugifyVietnamese } from '../../common/utils/slugify.util';

export type PromotionDocument = Promotion & Document & { _id: Types.ObjectId };

@Schema({ timestamps: true })
export class Promotion {
  _id?: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ unique: true, uppercase: true })
  code: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  expiryDate: Date;

  @Prop({ required: true, min: 0, max: 100 })
  value: number;

  @Prop({
    type: String,
    enum: Object.values(PromotionType),
    default: PromotionType.SPECIAL,
  })
  type: PromotionType;

  @Prop({ type: Number })
  recurringMonth?: number;

  @Prop({ type: Number })
  recurringDay?: number;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: String })
  description?: string;
}

export const PromotionSchema = SchemaFactory.createForClass(Promotion);

// Pre-save hook to auto-generate code from name
PromotionSchema.pre('save', function (next) {
  // Always generate code if name exists and code doesn't
  if (this.name && (!this.code || this.isModified('name'))) {
    this.code = slugifyVietnamese(this.name);
  }
  next();
});

// Pre-update hook to auto-generate code when name is updated
PromotionSchema.pre('findOneAndUpdate', function (next) {
  const update = this.getUpdate() as any;
  if (update && update.name) {
    update.code = slugifyVietnamese(update.name);
  } else if (update && update.$set && update.$set.name) {
    update.$set.code = slugifyVietnamese(update.$set.name);
  }
  next();
});

// Indexes
PromotionSchema.index({ code: 1 }, { unique: true });
PromotionSchema.index({ type: 1, isActive: 1 });
PromotionSchema.index({ startDate: 1, expiryDate: 1 });
PromotionSchema.index({ recurringMonth: 1, recurringDay: 1 });
