import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeederService } from './seeder.service';
import { SeederDashboardService } from './seeder-dashboard.service';
import { SeederSchedulingDashboardService } from './seeder-scheduling-dashboard.service';
import { SeederController } from './seeder.controller';
import { Station, StationSchema } from '../../station/entities/station.entity';
import { Route, RouteSchema } from '../../route/entities/route.entity';
import {
  Scheduling,
  SchedulingSchema,
} from '../../scheduling/entities/scheduling.entity';
import { Bus, BusSchema } from '../../bus/entities/bus.entity';
import {
  Promotion,
  PromotionSchema,
} from 'src/promotion/entities/promotion.entity';
import { Seat, SeatSchema } from '../../seat/entities/seat.entity';
import { Ticket, TicketSchema } from '../../ticket/entities/ticket.entity';
import { User, UserSchema } from '../../users/entities/user.entity';
import { SchedulingModule } from '../../scheduling/scheduling.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Station.name, schema: StationSchema },
      { name: Route.name, schema: RouteSchema },
      { name: Scheduling.name, schema: SchedulingSchema },
      { name: Bus.name, schema: BusSchema },
      { name: Promotion.name, schema: PromotionSchema },
      { name: Seat.name, schema: SeatSchema },
      { name: Ticket.name, schema: TicketSchema },
      { name: User.name, schema: UserSchema },
    ]),
    SchedulingModule,
  ],
  providers: [SeederService, SeederDashboardService, SeederSchedulingDashboardService],
  controllers: [SeederController],
  exports: [SeederService],
})
export class SeederModule { }
