import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { PromotionType } from '../enums/promotion-type.enum';

export type PromotionDocument = Promotion & Document & { _id: Types.ObjectId };

@Schema({ timestamps: true })
export class Promotion {
  _id?: Types.ObjectId;

  @Prop({ required: true })
  name: string;

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

// Indexes
PromotionSchema.index({ type: 1, isActive: 1 });
PromotionSchema.index({ startDate: 1, expiryDate: 1 });
PromotionSchema.index({ recurringMonth: 1, recurringDay: 1 });
