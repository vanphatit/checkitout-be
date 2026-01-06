import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  Max,
  IsMongoId,
  Length,
  ArrayMaxSize,
  IsObject,
  ValidateNested,
  IsEnum,
  IsInt,
  Matches,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

class DriverDto {
  @ApiProperty({
    description: 'Tên tài xế',
    example: 'Nguyễn Văn A',
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: 'Tên tài xế phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên tài xế không được để trống' })
  @Length(2, 100, { message: 'Tên tài xế phải có độ dài từ 2 đến 100 ký tự' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({
    description: 'Số điện thoại tài xế',
    example: '0123456789',
  })
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Số điện thoại không được để trống' })
  @Matches(/^[0-9+\-\s()]+$/, { message: 'Số điện thoại không hợp lệ' })
  @Length(8, 20, { message: 'Số điện thoại phải có độ dài từ 8 đến 20 ký tự' })
  phone: string;

  @ApiPropertyOptional({
    description: 'Số bằng lái xe',
    example: 'B123456789',
  })
  @IsOptional()
  @IsString({ message: 'Số bằng lái xe phải là chuỗi ký tự' })
  @Length(5, 20, { message: 'Số bằng lái xe phải có độ dài từ 5 đến 20 ký tự' })
  licenseNumber?: string;
}

export class CreateSchedulingDto {
  @ApiProperty({
    description: 'ID tuyến đường',
    example: '60f7b3b3b3b3b3b3b3b3b3b3',
  })
  @IsString({ message: 'ID tuyến đường phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'ID tuyến đường không được để trống' })
  @IsMongoId({ message: 'ID tuyến đường không hợp lệ' })
  routeId: string;

  @ApiProperty({
    description: 'ID xe buýt',
    example: '60f7b3b3b3b3b3b3b3b3b3b4',
  })
  @IsString({ message: 'ID xe buýt phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'ID xe buýt không được để trống' })
  @IsMongoId({ message: 'ID xe buýt không hợp lệ' })
  busId: string;

  @ApiProperty({
    description: 'Giờ khởi hành (HH:mm)',
    example: '08:00',
  })
  @IsString({ message: 'Giờ khởi hành phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Giờ khởi hành không được để trống' })
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'Giờ khởi hành phải có định dạng HH:mm (ví dụ: 08:00)',
  })
  departureTime: string;

  @ApiProperty({
    description: 'Ngày khởi hành (YYYY-MM-DD)',
    example: '2024-12-25',
  })
  @IsString({ message: 'Ngày khởi hành phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Ngày khởi hành không được để trống' })
  @IsDateString({}, { message: 'Ngày khởi hành phải có định dạng YYYY-MM-DD' })
  departureDate: string;

  @ApiProperty({
    description: 'Giá vé (VNĐ)',
    example: 150000,
    minimum: 1000,
    maximum: 5000000,
  })
  @IsNumber({}, { message: 'Giá vé phải là số' })
  @Min(1000, { message: 'Giá vé phải >= 1.000 VNĐ' })
  @Max(5000000, { message: 'Giá vé phải <= 5.000.000 VNĐ' })
  price: number;

  @ApiProperty({
    description: 'Thông tin tài xế',
    type: DriverDto,
  })
  @IsObject({ message: 'Thông tin tài xế phải là đối tượng' })
  @ValidateNested({ message: 'Thông tin tài xế không hợp lệ' })
  @Type(() => DriverDto)
  driver: DriverDto;

  @ApiPropertyOptional({
    description: 'Trạng thái lịch trình',
    enum: ['scheduled', 'in-transit', 'completed', 'cancelled'],
    default: 'scheduled',
  })
  @IsOptional()
  @IsEnum(['scheduled', 'in-transit', 'completed', 'cancelled'], {
    message:
      'Trạng thái phải là một trong: scheduled, in-transit, completed, cancelled',
  })
  status?: string;

  @ApiPropertyOptional({
    description: 'Giờ đến dự kiến (HH:mm)',
    example: '11:00',
  })
  @IsOptional()
  @IsString({ message: 'Giờ đến phải là chuỗi ký tự' })
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'Giờ đến phải có định dạng HH:mm (ví dụ: 11:00)',
  })
  arrivalTime?: string;

  @ApiPropertyOptional({
    description: 'Ngày đến (YYYY-MM-DD)',
    example: '2024-12-25',
  })
  @IsOptional()
  @IsString({ message: 'Ngày đến phải là chuỗi ký tự' })
  @IsDateString({}, { message: 'Ngày đến phải có định dạng YYYY-MM-DD' })
  arrivalDate?: string;
}

export class CreateBulkSchedulingDto {
  @ApiProperty({
    description: 'ID tuyến đường',
    example: '60f7b3b3b3b3b3b3b3b3b3b3',
  })
  @IsString({ message: 'ID tuyến đường phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'ID tuyến đường không được để trống' })
  @IsMongoId({ message: 'ID tuyến đường không hợp lệ' })
  routeId: string;

  @ApiProperty({
    description: 'ID xe buýt',
    example: '60f7b3b3b3b3b3b3b3b3b3b4',
  })
  @IsString({ message: 'ID xe buýt phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'ID xe buýt không được để trống' })
  @IsMongoId({ message: 'ID xe buýt không hợp lệ' })
  busId: string;

  @ApiProperty({
    description: 'Giờ khởi hành (HH:mm)',
    example: '08:00',
  })
  @IsString({ message: 'Giờ khởi hành phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Giờ khởi hành không được để trống' })
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'Giờ khởi hành phải có định dạng HH:mm (ví dụ: 08:00)',
  })
  departureTime: string;

  @ApiProperty({
    description: 'Ngày bắt đầu (YYYY-MM-DD)',
    example: '2024-12-01',
  })
  @IsString({ message: 'Ngày bắt đầu phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Ngày bắt đầu không được để trống' })
  @IsDateString({}, { message: 'Ngày bắt đầu phải có định dạng YYYY-MM-DD' })
  startDate: string;

  @ApiProperty({
    description: 'Ngày kết thúc (YYYY-MM-DD)',
    example: '2024-12-31',
  })
  @IsString({ message: 'Ngày kết thúc phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Ngày kết thúc không được để trống' })
  @IsDateString({}, { message: 'Ngày kết thúc phải có định dạng YYYY-MM-DD' })
  endDate: string;

  @ApiProperty({
    description: 'Các ngày trong tuần (1=Thứ 2, 7=Chủ nhật)',
    example: [1, 2, 3, 4, 5],
    maxItems: 7,
  })
  @IsArray({ message: 'Ngày trong tuần phải là mảng' })
  @IsInt({ each: true, message: 'Mỗi ngày phải là số nguyên' })
  @Min(1, { each: true, message: 'Ngày phải >= 1 (Thứ 2)' })
  @Max(7, { each: true, message: 'Ngày phải <= 7 (Chủ nhật)' })
  @ArrayMaxSize(7, { message: 'Không được vượt quá 7 ngày' })
  daysOfWeek: number[];

  @ApiProperty({
    description: 'Giá vé (VNĐ)',
    example: 150000,
    minimum: 1000,
    maximum: 5000000,
  })
  @IsNumber({}, { message: 'Giá vé phải là số' })
  @Min(1000, { message: 'Giá vé phải >= 1.000 VNĐ' })
  @Max(5000000, { message: 'Giá vé phải <= 5.000.000 VNĐ' })
  price: number;

  @ApiProperty({
    description: 'Thông tin tài xế',
    type: DriverDto,
  })
  @IsObject({ message: 'Thông tin tài xế phải là đối tượng' })
  @ValidateNested({ message: 'Thông tin tài xế không hợp lệ' })
  @Type(() => DriverDto)
  driver: DriverDto;
}

export class UpdateSchedulingDto {
  @ApiPropertyOptional({
    description: 'Trạng thái lịch trình',
    enum: ['scheduled', 'in-transit', 'completed', 'cancelled'],
  })
  @IsOptional()
  @IsEnum(['scheduled', 'in-transit', 'completed', 'cancelled'], {
    message:
      'Trạng thái phải là một trong: scheduled, in-transit, completed, cancelled',
  })
  status?: string;

  @ApiPropertyOptional({
    description: 'Giờ khởi hành thực tế (HH:mm)',
    example: '08:05',
  })
  @IsOptional()
  @IsString({ message: 'Giờ khởi hành thực tế phải là chuỗi ký tự' })
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'Giờ khởi hành thực tế phải có định dạng HH:mm',
  })
  actualDepartureTime?: string;

  @ApiPropertyOptional({
    description: 'Giờ đến thực tế (HH:mm)',
    example: '11:30',
  })
  @IsOptional()
  @IsString({ message: 'Giờ đến thực tế phải là chuỗi ký tự' })
  @Matches(/^\d{2}:\d{2}$/, {
    message: 'Giờ đến thực tế phải có định dạng HH:mm',
  })
  actualArrivalTime?: string;

  @ApiPropertyOptional({
    description: 'Số ghế đã đặt',
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Số ghế đã đặt phải là số' })
  @Min(0, { message: 'Số ghế đã đặt phải >= 0' })
  bookedSeats?: number;

  @ApiPropertyOptional({
    description: 'Ghi chú',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi ký tự' })
  @Length(0, 1000, { message: 'Ghi chú không được vượt quá 1000 ký tự' })
  @Transform(({ value }) => value?.trim())
  notes?: string;
}
