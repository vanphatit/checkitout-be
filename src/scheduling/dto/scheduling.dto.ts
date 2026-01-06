import {
  IsString,
  IsNotEmpty,
  IsArray,
  IsOptional,
  IsBoolean,
  IsMongoId,
  IsDateString,
  IsNumber,
  Min,
  Max,
  Matches,
  IsEnum,
} from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateSchedulingDto {
  @ApiProperty({ description: 'ID tuyến đường' })
  @IsMongoId()
  @IsNotEmpty()
  routeId: string;

  @ApiProperty({ description: 'Danh sách ID các xe bus', type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  busIds: string[];

  @ApiProperty({
    description: 'Thời gian khởi hành dự kiến (HH:mm)',
    example: '08:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'ETD phải có định dạng HH:mm',
  })
  etd: string;

  @ApiProperty({ description: 'Ngày khởi hành', example: '2024-12-25' })
  @IsDateString()
  departureDate: string;

  @ApiProperty({
    description: 'Thời gian đến dự kiến (HH:mm)',
    required: false,
    example: '12:00',
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'ETA phải có định dạng HH:mm',
  })
  eta?: string;

  @ApiProperty({ description: 'Ngày đến dự kiến', required: false })
  @IsOptional()
  @IsDateString()
  arrivalDate?: string;

  @ApiProperty({ description: 'Ghi chú', required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ description: 'Giá vé', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiProperty({
    description: 'Thông tin tài xế',
    required: false,
    example: {
      name: 'Nguyễn Văn A',
      phone: '0123456789',
      licenseNumber: 'B123456789',
    },
  })
  @IsOptional()
  driver?: {
    name: string;
    phone: string;
    licenseNumber: string;
  };

  @ApiProperty({
    description: 'Thông tin phụ xe',
    required: false,
    example: { name: 'Trần Văn B', phone: '0987654321' },
  })
  @IsOptional()
  conductor?: {
    name: string;
    phone: string;
  };

  @ApiProperty({
    description: 'Có phải lịch trình lặp lại không',
    required: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value === 'true';
    }
    return Boolean(value);
  })
  isRecurring?: boolean;

  @ApiProperty({
    description: 'Ngày lặp lại',
    required: false,
    type: [String],
    example: ['monday', 'wednesday', 'friday'],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recurringDays?: string[];

  @ApiProperty({ description: 'Ngày kết thúc lặp lại', required: false })
  @IsOptional()
  @IsDateString()
  recurringEndDate?: string;
}

export class UpdateSchedulingDto extends PartialType(CreateSchedulingDto) {
  @ApiProperty({
    description: 'Trạng thái lịch trình',
    required: false,
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'delayed'],
  })
  @IsOptional()
  @IsEnum(['scheduled', 'in-progress', 'completed', 'cancelled', 'delayed'])
  status?: string;

  @ApiProperty({ description: 'Trạng thái hoạt động', required: false })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiProperty({
    description: 'Thời gian khởi hành thực tế (HH:mm)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Thời gian thực tế phải có định dạng HH:mm',
  })
  actualDepartureTime?: string;

  @ApiProperty({
    description: 'Thời gian đến thực tế (HH:mm)',
    required: false,
  })
  @IsOptional()
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Thời gian thực tế phải có định dạng HH:mm',
  })
  actualArrivalTime?: string;

  @ApiProperty({ description: 'Số ghế đã đặt', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  bookedSeats?: number;
}

export class CreateBulkSchedulingDto {
  @ApiProperty({ description: 'ID tuyến đường' })
  @IsMongoId()
  @IsNotEmpty()
  routeId: string;

  @ApiProperty({ description: 'Danh sách ID các xe bus', type: [String] })
  @IsArray()
  @IsMongoId({ each: true })
  busIds: string[];

  @ApiProperty({
    description: 'Thời gian khởi hành dự kiến (HH:mm)',
    example: '08:00',
  })
  @IsString()
  @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
  etd: string;

  @ApiProperty({ description: 'Ngày bắt đầu', example: '2024-12-25' })
  @IsDateString()
  startDate: string;

  @ApiProperty({ description: 'Ngày kết thúc', example: '2024-12-31' })
  @IsDateString()
  endDate: string;

  @ApiProperty({
    description: 'Ngày trong tuần lặp lại',
    type: [String],
    example: ['monday', 'wednesday', 'friday'],
  })
  @IsArray()
  @IsString({ each: true })
  recurringDays: string[];

  @ApiProperty({ description: 'Giá vé', required: false })
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @ApiProperty({ description: 'Ghi chú', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
