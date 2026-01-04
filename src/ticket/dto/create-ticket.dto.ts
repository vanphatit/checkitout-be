import { 
  IsNotEmpty, 
  IsEnum, 
  IsOptional, 
  IsString,
  IsMongoId,
  IsEmail
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../enums/payment-method.enum';

export class CreateTicketDto {
  @ApiPropertyOptional({ 
    description: 'Customer email (required for admin/seller, auto-filled for customer)',
    example: 'customer@example.com' 
  })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Seat ID', example: '507f1f77bcf86cd799439012' })
  @IsNotEmpty()
  @IsMongoId()
  seatId: string;

  @ApiProperty({ description: 'Scheduling ID', example: '507f1f77bcf86cd799439013' })
  @IsNotEmpty()
  @IsMongoId()
  schedulingId: string;

  @ApiProperty({ 
    enum: PaymentMethod, 
    description: 'Payment method',
    example: PaymentMethod.BANKING, 
    default: PaymentMethod.BANKING
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod = PaymentMethod.BANKING;

  @ApiPropertyOptional({ 
    description: 'Fallback URL from payment gateway (for Banking method)',
    example: 'https://sandbox.vnpay.vn/return?...'
  })
  @IsOptional()
  @IsString()
  fallbackURL?: string;
}