import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SchedulingService } from './scheduling.service';
import { SchedulingController } from './scheduling.controller';
import { Scheduling, SchedulingSchema } from './entities/scheduling.entity';
import { Route, RouteSchema } from '../route/entities/route.entity';
import { Bus, BusSchema } from '../bus/entities/bus.entity';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Scheduling.name, schema: SchedulingSchema },
            { name: Route.name, schema: RouteSchema },
            { name: Bus.name, schema: BusSchema },
        ]),
    ],
    controllers: [SchedulingController],
    providers: [SchedulingService],
    exports: [SchedulingService],
})
export class SchedulingModule { }