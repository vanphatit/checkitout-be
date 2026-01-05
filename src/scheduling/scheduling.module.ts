import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SchedulingService } from './scheduling.service';
import { SchedulingController } from './scheduling.controller';
import { Scheduling, SchedulingSchema } from './entities/scheduling.entity';
import { Route, RouteSchema } from '../route/entities/route.entity';
import { Bus, BusSchema } from '../bus/entities/bus.entity';
import { ExcelProcessingService } from './services/excel-processing.service';
import { ExcelImportService } from './services/excel-import.service';
import { SchedulingSearchService } from './services/scheduling-search.service';
import { SearchModule } from '../modules/search/search.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Scheduling.name, schema: SchedulingSchema },
      { name: Route.name, schema: RouteSchema },
      { name: Bus.name, schema: BusSchema },
    ]),
    SearchModule,
  ],
  controllers: [SchedulingController],
  providers: [
    SchedulingService,
    ExcelProcessingService,
    ExcelImportService,
    SchedulingSearchService,
  ],
  exports: [
    SchedulingService,
    ExcelProcessingService,
    ExcelImportService,
    SchedulingSearchService,
  ],
})
export class SchedulingModule {}
