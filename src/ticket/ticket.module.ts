import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { TicketCronService } from '../ticket/ticket-cron.service';
import { Ticket, TicketSchema } from './entities/ticket.entity';
import { Seat, SeatSchema } from '../seat/entities/seat.entity';
import { Scheduling, SchedulingSchema } from '../scheduling/entities/scheduling.entity';
import { Route, RouteSchema } from '../route/entities/route.entity';
import { PromotionModule } from '../promotion/promotion.module';
import { AuthModule } from '../auth/auth.module';
import { SeatModule } from '../seat/seat.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Ticket.name, schema: TicketSchema },
      { name: Seat.name, schema: SeatSchema },
      { name: Scheduling.name, schema: SchedulingSchema },
      { name: Route.name, schema: RouteSchema },
    ]),
    PromotionModule,
    AuthModule,
    SeatModule,
  ],
  providers: [TicketService, TicketCronService],
  controllers: [TicketController],
  exports: [TicketService],
})
export class TicketModule {}

// ============================================
// seat.entity.ts - Add SeatStatus enum if not exists
// ============================================
/*
export enum SeatStatus {
  EMPTY = 'Empty',
  PENDING = 'Pending',
  SOLD = 'Sold',
}

export class Seat {
  @Prop({ required: true })
  seatNo: string;

  @Prop({ 
    type: String, 
    enum: Object.values(SeatStatus), 
    default: SeatStatus.EMPTY 
  })
  status: SeatStatus;

  @Prop({ type: Types.ObjectId, ref: 'Bus', required: true })
  busId: Types.ObjectId;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}
*/

// ============================================
// scheduling.entity.ts - ADD PRICE FIELD (REQUIRED)
// ============================================
/*
IMPORTANT: You MUST add the price field to Scheduling entity!

export class Scheduling {
  @Prop({ type: Types.ObjectId, ref: 'Route', required: true })
  routeId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Bus', required: true })
  busId: Types.ObjectId;

  @Prop({ type: [Types.ObjectId], ref: 'Bus', default: [] })
  busIds: Types.ObjectId[];

  @Prop({ type: String, required: true })
  etd: string;

  @Prop({ type: Date, required: true })
  departureDate: Date;

  @Prop({ type: String, required: false })
  eta?: string;

  // ✅ ADD THIS FIELD - REQUIRED FOR TICKET PRICING
  @Prop({ type: Number, required: true })
  price: number;

  @Prop({ type: Boolean, default: true })
  isActive?: boolean;

  @Prop({ type: Date })
  createdAt?: Date;

  @Prop({ type: Date })
  updatedAt?: Date;
}
*/