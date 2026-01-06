import {
  IsNotEmpty,
  IsEnum,
  IsOptional,
  IsString,
  IsMongoId,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMethod } from '../enums/payment-method.enum';

// Flexible phone regex for international and Vietnamese formats
// Supports: +1234567890, 0901234567, etc.
const FLEXIBLE_PHONE_REGEX = /^[\+]?[0-9]{10,15}$/;
const FLEXIBLE_PHONE_MESSAGE = 'Phone number must be 10-15 digits, optionally starting with +';

export class CreateTicketDto {
  @ApiPropertyOptional({
    description: 'Customer phone number (optional for CUSTOMER role, required for ADMIN/SELLER)',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  @Matches(FLEXIBLE_PHONE_REGEX, { message: FLEXIBLE_PHONE_MESSAGE })
  phone?: string;

  @ApiPropertyOptional({
    description:
      'Customer first name (optional, defaults to "Guest" if user does not exist)',
    example: 'John',
  })
  @IsOptional()
  @IsString()
  firstName?: string;

  @ApiPropertyOptional({
    description:
      'Customer last name (optional, defaults to "Customer" if user does not exist)',
    example: 'Doe',
  })
  @IsOptional()
  @IsString()
  lastName?: string;

  @ApiProperty({ description: 'Seat ID', example: '507f1f77bcf86cd799439012' })
  @IsNotEmpty()
  @IsMongoId()
  seatId: string;

  @ApiProperty({
    description: 'Scheduling ID',
    example: '507f1f77bcf86cd799439013',
  })
  @IsNotEmpty()
  @IsMongoId()
  schedulingId: string;

  @ApiPropertyOptional({
    enum: PaymentMethod,
    description: 'Payment method',
    example: PaymentMethod.BANKING,
    default: PaymentMethod.BANKING,
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({
    description: 'Fallback URL from payment gateway (for Banking method)',
    example: 'https://sandbox.vnpay.vn/return?...',
  })
  @IsOptional()
  @IsString()
  fallbackURL?: string;
}
