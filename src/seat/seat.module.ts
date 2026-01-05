import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SeatService } from './seat.service';
import { SeatController } from './seat.controller';
import { AuthModule } from 'src/auth/auth.module';
import { Bus, BusSchema } from '../bus/entities/bus.entity';
import { Seat, SeatSchema } from '../seat/entities/seat.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SeatGateway } from './gateways/seat.gateway';
import { SeatLockService } from './services/seat-lock.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Seat.name, schema: SeatSchema }]),
    MongooseModule.forFeature([{ name: Bus.name, schema: BusSchema }]),
    AuthModule,
  ],
  providers: [SeatService, SeatLockService, SeatGateway, JwtAuthGuard],
  controllers: [SeatController],
  exports: [SeatService, SeatLockService, SeatGateway],
})
export class SeatModule { }
