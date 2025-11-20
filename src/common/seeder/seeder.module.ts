import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeederService } from './seeder.service';
import { SeederController } from './seeder.controller';
import { Station, StationSchema } from '../../station/entities/station.entity';
import { Route, RouteSchema } from '../../route/entities/route.entity';
import { Scheduling, SchedulingSchema } from '../../scheduling/entities/scheduling.entity';
import { Bus, BusSchema } from '../../bus/entities/bus.entity';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Station.name, schema: StationSchema },
            { name: Route.name, schema: RouteSchema },
            { name: Scheduling.name, schema: SchedulingSchema },
            { name: Bus.name, schema: BusSchema },
        ]),
    ],
    providers: [SeederService],
    controllers: [SeederController],
    exports: [SeederService],
})
export class SeederModule { }