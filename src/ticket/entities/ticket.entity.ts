import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { TicketStatus } from '../enums/ticket-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';

export type TicketDocument = Ticket & Document;

// ============================================
// SNAPSHOT INTERFACES (để type-safe)
// ============================================
export interface TicketSnapshot {
  seat: {
    seatId: string;
    seatNo: string;
    busId: string;
  };
  scheduling: {
    schedulingId: string;
    departureDate: Date;
    arrivalDate: Date;
    price: number;
    busId: string;
  };
  route: {
    routeId: string;
    name: string;
    from: {
      stationId: string;
      name: string;
    };
    to: {
      stationId: string;
      name: string;
    };
    distance: number;
    etd: string;
  };
  promotion: {
    promotionId: string;
    name: string;
    value: number;
    type: string;
    description?: string;
  };
  pricing: {
    originalPrice: number;
    promotionValue: number;
    discountAmount: number;
    finalPrice: number;
  };
  snapshotCreatedAt: Date;
}

@Schema({ timestamps: true })
export class Ticket {
  // ============================================
  // USER & REFERENCES
  // ============================================
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Seat', required: true })
  seatId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Scheduling', required: true })
  schedulingId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Promotion', required: true })
  promotionId: Types.ObjectId;

  // ============================================
  // PAYMENT INFO
  // ============================================
  @Prop({
    type: String,
    enum: Object.values(PaymentMethod),
    required: true,
  })
  paymentMethod: PaymentMethod;

  @Prop({ type: String })
  fallbackURL?: string;

  @Prop({ type: Types.ObjectId, ref: 'Payment' })
  paymentId?: Types.ObjectId;

  // ============================================
  // PRICING & TIMING
  // ============================================
  @Prop({ type: Number, required: true })
  totalPrice: number;

  @Prop({ type: Date, required: true })
  expiredTime: Date;

  // ============================================
  // STATUS & TRANSFER
  // ============================================
  @Prop({
    type: String,
    enum: Object.values(TicketStatus),
    default: TicketStatus.PENDING,
  })
  status: TicketStatus;

  @Prop({ type: Types.ObjectId, ref: 'Ticket' })
  transferTicketId?: Types.ObjectId;

  // ============================================
  // 🔒 TRANSACTION SNAPSHOT
  // Lưu thông tin tại thời điểm vé được xác nhận
  // Không bị ảnh hưởng khi Seat/Scheduling/Promotion thay đổi
  // ============================================
  @Prop({ 
    type: Object, 
    required: false,
    default: null 
  })
  snapshot?: TicketSnapshot;
}

export const TicketSchema = SchemaFactory.createForClass(Ticket);

// ============================================
// INDEXES
// ============================================
TicketSchema.index({ userId: 1 });
TicketSchema.index({ seatId: 1 });
TicketSchema.index({ schedulingId: 1 });
TicketSchema.index({ status: 1 });
TicketSchema.index({ expiredTime: 1 });
TicketSchema.index({ createdAt: -1 });
TicketSchema.index({ 'snapshot.scheduling.departureDate': 1 }); // For reporting