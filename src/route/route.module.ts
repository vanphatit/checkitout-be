import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RouteService } from './route.service';
import { RouteController } from './route.controller';
import { Route, RouteSchema } from './entities/route.entity';
import { Station, StationSchema } from '../station/entities/station.entity';
import { Scheduling, SchedulingSchema } from '../scheduling/entities/scheduling.entity';
import { CommonModule } from '../common/common.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Route.name, schema: RouteSchema },
            { name: Station.name, schema: StationSchema },
            { name: Scheduling.name, schema: SchedulingSchema },
        ]),
        CommonModule,
    ],
    controllers: [RouteController],
    providers: [RouteService],
    exports: [RouteService],
})
export class RouteModule { }