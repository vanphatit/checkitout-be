import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { StationService } from './station.service';
import { StationController } from './station.controller';
import { Station, StationSchema } from './entities/station.entity';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Station.name, schema: StationSchema }]),
    CommonModule,
  ],
  controllers: [StationController],
  providers: [StationService],
  exports: [StationService],
})
export class StationModule {}
