import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PromotionDocument = Promotion & Document;

@Schema({
    timestamps: true
})
export class Promotion {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  startDate: Date;

  @Prop({ required: true })
  expiryDate: Date;

  @Prop({ required: true })
  value: number; // percent

}

export const PromotionSchema = SchemaFactory.createForClass(Promotion);
