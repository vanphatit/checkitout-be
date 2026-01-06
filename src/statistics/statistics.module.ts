import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StatisticsController } from './statistics.controller';
import { StatisticsService } from './statistics.service';
import { Ticket, TicketSchema } from '../ticket/entities/ticket.entity';
import { Scheduling, SchedulingSchema } from '../scheduling/entities/scheduling.entity';
import { Bus, BusSchema } from '../bus/entities/bus.entity';
import { User, UserSchema } from '../users/entities/user.entity';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Ticket.name, schema: TicketSchema },
            { name: Scheduling.name, schema: SchedulingSchema },
            { name: Bus.name, schema: BusSchema },
            { name: User.name, schema: UserSchema },
        ]),
    ],
    controllers: [StatisticsController],
    providers: [StatisticsService],
    exports: [StatisticsService],
})
export class StatisticsModule { }
