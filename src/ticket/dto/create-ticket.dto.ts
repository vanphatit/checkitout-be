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
import {
  PHONE_REGEX,
  PHONE_VALIDATION_MESSAGE,
} from '../../auth/constants/validation.constants';

export class CreateTicketDto {
  @ApiPropertyOptional({
    description: 'Customer phone number (optional for CUSTOMER role, required for ADMIN/SELLER)',
    example: '+1234567890',
  })
  @IsOptional()
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_VALIDATION_MESSAGE })
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

  @ApiProperty({
    enum: PaymentMethod,
    description: 'Payment method',
    example: PaymentMethod.BANKING,
    default: PaymentMethod.BANKING,
  })
  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod = PaymentMethod.BANKING;

  @ApiPropertyOptional({
    description: 'Fallback URL from payment gateway (for Banking method)',
    example: 'https://sandbox.vnpay.vn/return?...',
  })
  @IsOptional()
  @IsString()
  fallbackURL?: string;
}
