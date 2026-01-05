import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StationService } from './station.service';
import { StationController } from './station.controller';
import { Station, StationSchema } from './entities/station.entity';
import { Route, RouteSchema } from '../route/entities/route.entity';
import { CommonModule } from '../common/common.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Station.name, schema: StationSchema },
            { name: Route.name, schema: RouteSchema }
        ]),
        CommonModule,
    ],
    controllers: [StationController],
    providers: [StationService],
    exports: [StationService],
})
export class StationModule { }