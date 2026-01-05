import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule } from '@nestjs/config';
import { TicketService } from './ticket.service';
import { TicketController } from './ticket.controller';
import { TicketCronService } from '../ticket/ticket-cron.service';
import { Ticket, TicketSchema } from './entities/ticket.entity';
import { Seat, SeatSchema } from '../seat/entities/seat.entity';
import {
  Scheduling,
  SchedulingSchema,
} from '../scheduling/entities/scheduling.entity';
import { Route, RouteSchema } from '../route/entities/route.entity';
import { User, UserSchema } from '../users/entities/user.entity';
import { PromotionModule } from '../promotion/promotion.module';
import { AuthModule } from '../auth/auth.module';
import { SeatModule } from '../seat/seat.module';
import { UsersModule } from '../users/users.module';
import { VNPayService } from '../vnpay/vnpay.service';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forFeature([
      { name: Ticket.name, schema: TicketSchema },
      { name: Seat.name, schema: SeatSchema },
      { name: Scheduling.name, schema: SchedulingSchema },
      { name: Route.name, schema: RouteSchema },
      { name: User.name, schema: UserSchema },
    ]),
    PromotionModule,
    AuthModule,
    SeatModule,
    UsersModule,
  ],
  providers: [TicketService, TicketCronService, VNPayService],
  controllers: [TicketController],
  exports: [TicketService],
})
export class TicketModule {}
