import { Module } from '@nestjs/common';
import { OpenStreetMapService } from './services/openstreetmap.service';

@Module({
  providers: [OpenStreetMapService],
  exports: [OpenStreetMapService],
})
export class CommonModule {}
