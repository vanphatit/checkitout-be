import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsArray,
  Min,
  Max,
  Matches,
  Length,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';

export class CreateStationDto {
  @ApiProperty({
    description: 'Tên trạm',
    example: 'Bến xe Miền Tây',
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: 'Tên trạm phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên trạm không được để trống' })
  @Length(2, 100, { message: 'Tên trạm phải có độ dài từ 2 đến 100 ký tự' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiProperty({
    description: 'Địa chỉ trạm',
    example: '395 Kinh Dương Vương, An Lạc, Bình Tân, TP.HCM',
    minLength: 10,
    maxLength: 500,
  })
  @IsString({ message: 'Địa chỉ trạm phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Địa chỉ trạm không được để trống' })
  @Length(10, 500, {
    message: 'Địa chỉ trạm phải có độ dài từ 10 đến 500 ký tự',
  })
  @Transform(({ value }) => value?.trim())
  address: string;

  @ApiProperty({
    description: 'Kinh độ',
    example: 106.6296638,
    minimum: -180,
    maximum: 180,
  })
  @IsNumber({}, { message: 'Kinh độ phải là số' })
  @Min(-180, { message: 'Kinh độ phải >= -180' })
  @Max(180, { message: 'Kinh độ phải <= 180' })
  longitude: number;

  @ApiProperty({
    description: 'Vĩ độ',
    example: 10.8230989,
    minimum: -90,
    maximum: 90,
  })
  @IsNumber({}, { message: 'Vĩ độ phải là số' })
  @Min(-90, { message: 'Vĩ độ phải >= -90' })
  @Max(90, { message: 'Vĩ độ phải <= 90' })
  latitude: number;

  @ApiPropertyOptional({
    description: 'Mô tả trạm',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
  @Length(0, 1000, { message: 'Mô tả không được vượt quá 1000 ký tự' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiPropertyOptional({
    description: 'Số điện thoại liên hệ',
    example: '028-3868-4430',
  })
  @IsOptional()
  @IsString({ message: 'Số điện thoại phải là chuỗi ký tự' })
  @Matches(/^[0-9+\-\s()]+$/, { message: 'Số điện thoại không hợp lệ' })
  @Length(8, 20, { message: 'Số điện thoại phải có độ dài từ 8 đến 20 ký tự' })
  contactPhone?: string;

  @ApiPropertyOptional({
    description: 'Giờ hoạt động',
    example: '05:00 - 22:00',
  })
  @IsOptional()
  @IsString({ message: 'Giờ hoạt động phải là chuỗi ký tự' })
  @Matches(/^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$/, {
    message:
      'Giờ hoạt động phải có định dạng HH:mm - HH:mm (ví dụ: 05:00 - 22:00)',
  })
  operatingHours?: string;

  @ApiPropertyOptional({
    description: 'Tiện ích tại trạm',
    example: ['Toilet', 'Canteen', 'Parking'],
    maxItems: 20,
  })
  @IsOptional()
  @IsArray({ message: 'Tiện ích phải là mảng' })
  @IsString({ each: true, message: 'Mỗi tiện ích phải là chuỗi ký tự' })
  @ArrayMaxSize(20, { message: 'Không được vượt quá 20 tiện ích' })
  @Transform(({ value }) =>
    value?.map((item: string) => item?.trim()).filter(Boolean),
  )
  facilities?: string[];
}

export class CreateStationFromAddressDto {
  @ApiProperty({
    description: 'Địa chỉ để tìm tọa độ tự động',
    example: 'Bến xe Miền Tây, An Lạc, Bình Tân, TP.HCM',
    minLength: 10,
    maxLength: 500,
  })
  @IsString({ message: 'Địa chỉ phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Địa chỉ không được để trống' })
  @Length(10, 500, { message: 'Địa chỉ phải có độ dài từ 10 đến 500 ký tự' })
  @Transform(({ value }) => value?.trim())
  address: string;

  @ApiProperty({
    description: 'Tên trạm',
    example: 'Bến xe Miền Tây',
    minLength: 2,
    maxLength: 100,
  })
  @IsString({ message: 'Tên trạm phải là chuỗi ký tự' })
  @IsNotEmpty({ message: 'Tên trạm không được để trống' })
  @Length(2, 100, { message: 'Tên trạm phải có độ dài từ 2 đến 100 ký tự' })
  @Transform(({ value }) => value?.trim())
  name: string;

  @ApiPropertyOptional({
    description: 'Mô tả trạm',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
  @Length(0, 1000, { message: 'Mô tả không được vượt quá 1000 ký tự' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiPropertyOptional({
    description: 'Tiện ích tại trạm',
    example: ['Toilet', 'Canteen'],
    maxItems: 20,
  })
  @IsOptional()
  @IsArray({ message: 'Tiện ích phải là mảng' })
  @IsString({ each: true, message: 'Mỗi tiện ích phải là chuỗi ký tự' })
  @ArrayMaxSize(20, { message: 'Không được vượt quá 20 tiện ích' })
  @Transform(({ value }) =>
    value?.map((item: string) => item?.trim()).filter(Boolean),
  )
  facilities?: string[];
}
