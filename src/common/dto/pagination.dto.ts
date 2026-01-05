import { IsString, IsOptional, Min, Max, IsInt, IsBoolean } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class PaginationDto {
  @ApiPropertyOptional({
    description: 'Số trang (bắt đầu từ 1)',
    minimum: 1,
    default: 1,
    example: 1
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số trang phải là số nguyên' })
  @Min(1, { message: 'Số trang phải lớn hơn 0' })
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Số lượng bản ghi mỗi trang',
    minimum: 1,
    maximum: 1000,
    default: 10,
    example: 10
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Kích thước trang phải là số nguyên' })
  @Min(1, { message: 'Kích thước trang phải lớn hơn 0' })
  @Max(1000, { message: 'Kích thước trang không được vượt quá 1000' })
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Trường sắp xếp',
    example: 'createdAt'
  })
  @IsOptional()
  @IsString({ message: 'Trường sắp xếp phải là chuỗi' })
  sortBy?: string = 'createdAt';

  @ApiPropertyOptional({
    description: 'Thứ tự sắp xếp (asc hoặc desc)',
    enum: ['asc', 'desc'],
    default: 'desc',
    example: 'desc'
  })
  @IsOptional()
  @IsString({ message: 'Thứ tự sắp xếp phải là chuỗi' })
  @Transform(({ value }) => value?.toLowerCase())
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({
    description: 'Từ khóa tìm kiếm',
    example: 'Sài Gòn'
  })
  @IsOptional()
  @IsString({ message: 'Từ khóa tìm kiếm phải là chuỗi' })
  search?: string;

  @ApiPropertyOptional({
    description: 'Bao gồm cả các bản ghi đã xóa (chỉ dành cho admin)',
    default: false,
    example: false,
    type: Boolean
  })
  @IsOptional()
  @Transform(({ value }) => {
    console.log('Transform includeDeleted:', value, typeof value);
    if (value === undefined || value === null) return false;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    return false;
  }, { toClassOnly: true })
  @IsBoolean({ message: 'includeDeleted phải là boolean' })
  includeDeleted?: boolean = false;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  isActive?: boolean;
}
