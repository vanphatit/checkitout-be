import {
  IsString,
  IsDateString,
  IsNumber,
  IsOptional,
  Matches,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class SchedulingExcelRowDto {
  @ApiProperty({
    description: 'Tên tuyến đường',
    example: 'Sai Gon - Hong Ngu',
  })
  @IsString({ message: 'Tên tuyến đường phải là chuỗi' })
  routeName: string;

  @ApiProperty({ description: 'Biển số xe', example: '51B-12345' })
  @IsString({ message: 'Biển số xe phải là chuỗi' })
  plateNo: string;

  @ApiProperty({ description: 'Ngày khởi hành', example: '2025-12-25' })
  @IsDateString(
    {},
    { message: 'Ngày khởi hành không hợp lệ. Format: YYYY-MM-DD' },
  )
  @Transform(({ value }) => {
    // Handle Excel date formats
    if (typeof value === 'number') {
      // Excel serial date to JS Date
      const date = new Date((value - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    return value;
  })
  departureDate: string;

  @ApiProperty({ description: 'Giờ khởi hành', example: '08:30' })
  @IsString({ message: 'Giờ khởi hành phải là chuỗi' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Giờ khởi hành phải có định dạng HH:mm (ví dụ: 08:30)',
  })
  @Transform(({ value }) => {
    // Handle Excel time formats
    if (typeof value === 'number') {
      // Excel decimal time to HH:mm
      const hours = Math.floor(value * 24);
      const minutes = Math.floor((value * 24 * 60) % 60);
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    return value;
  })
  etd: string;

  @ApiProperty({
    description: 'Giờ đến dự kiến',
    example: '12:30',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Giờ đến phải là chuỗi' })
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Giờ đến phải có định dạng HH:mm',
  })
  @Transform(({ value }) => {
    if (!value) return undefined;
    if (typeof value === 'number') {
      const hours = Math.floor(value * 24);
      const minutes = Math.floor((value * 24 * 60) % 60);
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    }
    return value;
  })
  eta?: string;

  @ApiProperty({ description: 'Giá vé', example: 150000 })
  @IsNumber({}, { message: 'Giá vé phải là số' })
  @Transform(({ value }) => {
    // Handle Excel number formats
    if (typeof value === 'string') {
      // Remove currency symbols and commas
      const cleaned = value.replace(/[₫$,]/g, '');
      return parseFloat(cleaned) || 0;
    }
    return Number(value) || 0;
  })
  price: number;

  @ApiProperty({
    description: 'Tên tài xế',
    example: 'Nguyễn Văn A',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'Tên tài xế phải là chuỗi' })
  driverName?: string;

  @ApiProperty({
    description: 'SĐT tài xế',
    example: '0987654321',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'SĐT tài xế phải là chuỗi' })
  @Matches(/^[0-9+\-\s()]{10,15}$/, {
    message: 'Số điện thoại tài xế không hợp lệ',
  })
  driverPhone?: string;

  @ApiProperty({
    description: 'GPLX tài xế',
    example: 'B1234567',
    required: false,
  })
  @IsOptional()
  @IsString({ message: 'GPLX phải là chuỗi' })
  driverLicense?: string;

  @ApiProperty({ description: 'Ghi chú', required: false })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  note?: string;

  @ApiProperty({
    description: 'Số hàng trong Excel (để báo lỗi)',
    required: false,
  })
  @IsOptional()
  @IsNumber()
  rowIndex?: number;
}

export class ImportSchedulingExcelDto {
  @ApiProperty({
    description: 'Danh sách lịch trình từ Excel',
    type: [SchedulingExcelRowDto],
  })
  @IsArray({ message: 'Dữ liệu phải là mảng' })
  @ValidateNested({ each: true })
  @Type(() => SchedulingExcelRowDto)
  schedules: SchedulingExcelRowDto[];

  @ApiProperty({
    description: 'Có ghi đè lịch trình đã tồn tại không',
    default: false,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  overwrite?: boolean;

  @ApiProperty({
    description: 'Có validate trước khi import không',
    default: true,
    required: false,
  })
  @IsOptional()
  @Transform(({ value }) => value !== false && value !== 'false')
  validateFirst?: boolean;
}

export class ExcelImportResultDto {
  @ApiProperty({ description: 'Tổng số dòng xử lý' })
  totalRows: number;

  @ApiProperty({ description: 'Số dòng thành công' })
  successCount: number;

  @ApiProperty({ description: 'Số dòng lỗi' })
  errorCount: number;

  @ApiProperty({ description: 'Danh sách lịch trình đã tạo' })
  createdSchedules: any[];

  @ApiProperty({ description: 'Danh sách lỗi' })
  errors: Array<{
    row: number;
    field?: string;
    message: string;
    data?: any;
  }>;

  @ApiProperty({ description: 'Cảnh báo' })
  warnings: Array<{
    row: number;
    message: string;
    data?: any;
  }>;
}
