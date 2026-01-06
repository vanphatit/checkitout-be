import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus } from '../enums/ticket-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';

export class UpdateTicketStatusDto {
  @ApiProperty({
    enum: TicketStatus,
    description: 'New ticket status',
  })
  @IsEnum(TicketStatus)
  status: TicketStatus;

  @ApiPropertyOptional({
    description: 'Fallback URL (for payment confirmation)',
  })
  @IsOptional()
  @IsString()
  fallbackURL?: string;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    description: 'Payment method (admin/seller can update to CASH)',
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;
}
