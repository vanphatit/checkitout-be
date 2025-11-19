import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { BusStatus } from '../enums/bus-status.enum';
import { BusType } from '../enums/bus-type.enum';
import { Seat } from '../../seat/entities/seat.entity';
import * as mongoose from 'mongoose';

export type BusDocument = Bus & Document;

@Schema({ timestamps: true })
export class Bus {
  @Prop({ required: true })
  busNo: string;

  @Prop({ required: true })
  plateNo: string;

  @Prop({ enum: BusType, default: BusType.SLEEPER })
  type: BusType;

  @Prop()
  vacancy: number;

  @Prop({
    type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Seat' }],
    default: [],
  })
  seats: Seat[];

  @Prop()
  driverName: string;

  @Prop({ enum: BusStatus, default: BusStatus.AVAILABLE })
  status: BusStatus;

  @Prop({ type: [String], default: [] })
  images: string[];

  readonly createdAt?: Date;

  readonly updatedAt?: Date;

  createdBy: string;

  @Prop({ required: false })
  updatedBy: string;
}

export const BusSchema = SchemaFactory.createForClass(Bus);
