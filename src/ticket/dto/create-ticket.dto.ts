import { 
  IsNotEmpty, 
  IsEnum, 
  IsOptional, 
  IsString,
  IsMongoId 
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../enums/payment-method.enum';

export class CreateTicketDto {
  @ApiProperty({ description: 'User ID', example: '507f1f77bcf86cd799439011' })
  @IsNotEmpty()
  @IsMongoId()
  userId: string;

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
    example: PaymentMethod.BANKING 
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;

  @ApiPropertyOptional({ 
    description: 'Fallback URL from payment gateway (for Banking method)',
    example: 'https://sandbox.vnpay.vn/return?...'
  })
  @IsOptional()
  @IsString()
  fallbackURL?: string;
}