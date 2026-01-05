import { IsOptional, IsEnum, IsInt, Min, Max, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { BusType } from '../enums/bus-type.enum';
import { BusStatus } from '../enums/bus-status.enum';
import { BusSortField } from '../type/bus.type';

export class PaginationDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  // ===== FILTER =====
  @IsOptional()
  @IsEnum(BusType)
  type?: BusType;

  @IsOptional()
  @IsEnum(BusStatus)
  status?: BusStatus;

  // ===== SEARCH =====
  @IsOptional()
  @IsString()
  search?: string;

  // ===== SORT =====
  @IsOptional()
  @IsEnum(BusSortField)
  sortBy: BusSortField = BusSortField.CREATED_AT;

  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase())
  sortOrder: 'asc' | 'desc' = 'desc';
}
