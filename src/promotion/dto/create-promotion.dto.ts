import { IsString, IsNotEmpty, IsNumber, Min, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreatePromotionDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateString()
  expiryDate: string;

  @ApiProperty({ description: 'Percent value' })
  @IsNumber()
  @Min(0)
  value: number;
}
