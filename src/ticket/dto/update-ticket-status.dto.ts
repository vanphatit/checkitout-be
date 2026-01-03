import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TicketStatus } from '../enums/ticket-status.enum';


export class UpdateTicketStatusDto {
  @ApiProperty({ 
    enum: TicketStatus, 
    description: 'New ticket status' 
  })
  @IsEnum(TicketStatus)
  status: TicketStatus;

  @ApiPropertyOptional({ 
    description: 'Fallback URL (for payment confirmation)' 
  })
  @IsOptional()
  @IsString()
  fallbackURL?: string;
}