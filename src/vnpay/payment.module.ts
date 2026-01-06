import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentController } from './payment.controller';
import { VNPayService } from './vnpay.service';
import { TicketModule } from '../ticket/ticket.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [ConfigModule, TicketModule, AuthModule],
  providers: [VNPayService],
  controllers: [PaymentController],
  exports: [VNPayService],
})
export class PaymentModule {}
