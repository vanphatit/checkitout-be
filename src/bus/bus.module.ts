import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BusService } from './bus.service';
import { BusController } from './bus.controller';
import { Bus, BusSchema } from '../bus/entities/bus.entity';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ExcelService } from '../common/excel/excel.service';
import { CloudinaryService } from 'src/common/cloudinary/cloudinary.service';
import { Seat, SeatSchema } from 'src/seat/entities/seat.entity';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Bus.name, schema: BusSchema },
      { name: Seat.name, schema: SeatSchema },
    ]),
    AuthModule,
  ],
  controllers: [BusController],
  providers: [BusService, JwtAuthGuard, ExcelService, CloudinaryService],
  exports: [BusService],
})
export class BusModule { }
