import { IsOptional, IsEnum, IsMongoId, IsDateString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus } from '../enums/ticket-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class TicketQueryDto extends PaginationDto {
  @ApiPropertyOptional({ description: 'Filter by user ID' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({ description: 'Filter by scheduling ID' })
  @IsOptional()
  @IsMongoId()
  schedulingId?: string;

  @ApiPropertyOptional({ 
    enum: TicketStatus, 
    description: 'Filter by status' 
  })
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @ApiPropertyOptional({ 
    enum: PaymentMethod, 
    description: 'Filter by payment method' 
  })
  @IsOptional()
  @IsEnum(PaymentMethod)
  paymentMethod?: PaymentMethod;

  @ApiPropertyOptional({ 
    description: 'Filter from date (ISO string)',
    example: '2025-01-01T00:00:00Z'
  })
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional({ 
    description: 'Filter to date (ISO string)',
    example: '2025-12-31T23:59:59Z'
  })
  @IsOptional()
  @IsDateString()
  toDate?: string;
}