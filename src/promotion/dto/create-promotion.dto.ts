import {
  IsString,
  IsNotEmpty,
  IsNumber,
  Min,
  Max,
  IsDateString,
  IsEnum,
  IsOptional,
  IsBoolean,
  ValidateIf,
  IsInt,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PromotionType } from '../enums/promotion-type.enum';

export class CreatePromotionDto {
  @ApiProperty({ example: 'Lunar New Year Discount' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ enum: PromotionType, default: PromotionType.SPECIAL })
  @IsEnum(PromotionType)
  type: PromotionType;

  @ApiProperty({ type: String, format: 'date-time', example: '2025-01-01T00:00:00Z' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2025-01-01T23:59:59Z' })
  @IsDateString()
  expiryDate: string;

  @ApiProperty({ description: 'Discount percentage (0-100)', example: 10, minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  value: number;

  @ApiPropertyOptional({ description: 'Month for recurring promotion (1-12)', example: 1 })
  @ValidateIf((o) => o.type === PromotionType.RECURRING)
  @IsInt()
  @Min(1)
  @Max(12)
  recurringMonth?: number;

  @ApiPropertyOptional({ description: 'Day for recurring promotion (1-31)', example: 1 })
  @ValidateIf((o) => o.type === PromotionType.RECURRING)
  @IsInt()
  @Min(1)
  @Max(31)
  recurringDay?: number;

  @ApiPropertyOptional({ description: 'Is promotion active', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 'Special discount for Lunar New Year' })
  @IsOptional()
  @IsString()
  description?: string;
}