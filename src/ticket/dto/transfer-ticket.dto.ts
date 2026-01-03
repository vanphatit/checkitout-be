import { IsNotEmpty, IsMongoId } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class TransferTicketDto {
  @ApiProperty({ 
    description: 'New Scheduling ID (must be same route)',
    example: '507f1f77bcf86cd799439014'
  })
  @IsNotEmpty()
  @IsMongoId()
  newSchedulingId: string;

  @ApiProperty({ 
    description: 'New Seat ID (on the new scheduling)',
    example: '507f1f77bcf86cd799439015'
  })
  @IsNotEmpty()
  @IsMongoId()
  newSeatId: string;
}
