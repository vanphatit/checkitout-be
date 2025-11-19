import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { SeatStatus } from '../enums/seat-status.enum';

export type SeatDocument = Seat & Document;

@Schema({ timestamps: true })
export class Seat {
  @Prop({ required: true })
  seatNo: string;

  @Prop({ enum: SeatStatus, default: SeatStatus.EMPTY })
  status: SeatStatus;

  readonly createdAt?: Date;

  readonly updatedAt?: Date;
}

export const SeatSchema = SchemaFactory.createForClass(Seat);
