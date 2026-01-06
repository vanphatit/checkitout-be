import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BullModule } from '@nestjs/bull';
import { SchedulingService } from './scheduling.service';
import { SchedulingController } from './scheduling.controller';
import { Scheduling, SchedulingSchema } from './entities/scheduling.entity';
import { Route, RouteSchema } from '../route/entities/route.entity';
import { Bus, BusSchema } from '../bus/entities/bus.entity';
import { ExcelProcessingService } from './services/excel-processing.service';
import { ExcelImportService } from './services/excel-import.service';
import { SchedulingSearchService } from './services/scheduling-search.service';
import { SchedulingReindexListener } from './services/scheduling-reindex.listener';
import { SchedulingQueueService } from './scheduling-queue.service';
import { SchedulingProcessor } from './scheduling.processor';
import { SearchModule } from '../modules/search/search.module';

@Module({
    imports: [
        MongooseModule.forFeature([
            { name: Scheduling.name, schema: SchedulingSchema },
            { name: Route.name, schema: RouteSchema },
            { name: Bus.name, schema: BusSchema },
        ]),
        BullModule.registerQueue({
            name: 'scheduling-status',
        }),
        SearchModule,
    ],
    controllers: [SchedulingController],
    providers: [
        SchedulingService,
        ExcelProcessingService,
        ExcelImportService,
        SchedulingSearchService,
        SchedulingReindexListener,
        SchedulingQueueService,
        SchedulingProcessor,
    ],
    exports: [
        SchedulingService,
        ExcelProcessingService,
        ExcelImportService,
        SchedulingSearchService,
        SchedulingQueueService,
    ],
})
export class SchedulingModule { }
