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
    IsInt
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';

class OperatingHoursDto {
    @ApiProperty({ description: 'Giờ bắt đầu', example: '05:00' })
    @IsString({ message: 'Giờ bắt đầu phải là chuỗi ký tự' })
    @IsNotEmpty({ message: 'Giờ bắt đầu không được để trống' })
    start: string;

    @ApiProperty({ description: 'Giờ kết thúc', example: '22:00' })
    @IsString({ message: 'Giờ kết thúc phải là chuỗi ký tự' })
    @IsNotEmpty({ message: 'Giờ kết thúc không được để trống' })
    end: string;
}

export class CreateRouteManualDto {
    @ApiProperty({
        description: 'Tên tuyến đường',
        example: 'TP.HCM - Cần Thơ',
        minLength: 5,
        maxLength: 200
    })
    @IsString({ message: 'Tên tuyến đường phải là chuỗi ký tự' })
    @IsNotEmpty({ message: 'Tên tuyến đường không được để trống' })
    @Length(5, 200, { message: 'Tên tuyến đường phải có độ dài từ 5 đến 200 ký tự' })
    @Transform(({ value }) => value?.trim())
    name: string;

    @ApiPropertyOptional({
        description: 'Mô tả tuyến đường',
        maxLength: 1000
    })
    @IsOptional()
    @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
    @Length(0, 1000, { message: 'Mô tả không được vượt quá 1000 ký tự' })
    @Transform(({ value }) => value?.trim())
    description?: string;

    @ApiProperty({
        description: 'ID trạm khởi hành',
        example: '60f7b3b3b3b3b3b3b3b3b3b3'
    })
    @IsString({ message: 'ID trạm khởi hành phải là chuỗi ký tự' })
    @IsNotEmpty({ message: 'ID trạm khởi hành không được để trống' })
    @IsMongoId({ message: 'ID trạm khởi hành không hợp lệ' })
    departureStationId: string;

    @ApiProperty({
        description: 'ID trạm đến',
        example: '60f7b3b3b3b3b3b3b3b3b3b4'
    })
    @IsString({ message: 'ID trạm đến phải là chuỗi ký tự' })
    @IsNotEmpty({ message: 'ID trạm đến không được để trống' })
    @IsMongoId({ message: 'ID trạm đến không hợp lệ' })
    arrivalStationId: string;

    @ApiPropertyOptional({
        description: 'Danh sách ID các trạm trung gian',
        example: ['60f7b3b3b3b3b3b3b3b3b3b5'],
        maxItems: 10
    })
    @IsOptional()
    @IsArray({ message: 'Danh sách trạm trung gian phải là mảng' })
    @IsString({ each: true, message: 'Mỗi ID trạm trung gian phải là chuỗi ký tự' })
    @IsMongoId({ each: true, message: 'Mỗi ID trạm trung gian phải hợp lệ' })
    @ArrayMaxSize(10, { message: 'Không được vượt quá 10 trạm trung gian' })
    intermediateStations?: string[];

    @ApiProperty({
        description: 'Khoảng cách (mét)',
        example: 169000,
        minimum: 100,
        maximum: 2000000
    })
    @IsNumber({}, { message: 'Khoảng cách phải là số' })
    @Min(100, { message: 'Khoảng cách phải >= 100 mét' })
    @Max(2000000, { message: 'Khoảng cách phải <= 2.000km' })
    distance: number;

    @ApiProperty({
        description: 'Thời gian di chuyển (phút)',
        example: 180,
        minimum: 5,
        maximum: 1440
    })
    @IsNumber({}, { message: 'Thời gian di chuyển phải là số' })
    @Min(5, { message: 'Thời gian di chuyển phải >= 5 phút' })
    @Max(1440, { message: 'Thời gian di chuyển phải <= 24 giờ' })
    duration: number;

    @ApiPropertyOptional({
        description: 'Giá cơ bản (VNĐ)',
        example: 120000,
        minimum: 1000,
        maximum: 5000000
    })
    @IsOptional()
    @IsNumber({}, { message: 'Giá cơ bản phải là số' })
    @Min(1000, { message: 'Giá cơ bản phải >= 1.000 VNĐ' })
    @Max(5000000, { message: 'Giá cơ bản phải <= 5.000.000 VNĐ' })
    basePrice?: number;

    @ApiPropertyOptional({
        description: 'Giá mỗi km (VNĐ)',
        example: 1000,
        minimum: 100,
        maximum: 10000
    })
    @IsOptional()
    @IsNumber({}, { message: 'Giá mỗi km phải là số' })
    @Min(100, { message: 'Giá mỗi km phải >= 100 VNĐ' })
    @Max(10000, { message: 'Giá mỗi km phải <= 10.000 VNĐ' })
    pricePerKm?: number;

    @ApiPropertyOptional({
        description: 'Giờ hoạt động',
        type: OperatingHoursDto
    })
    @IsOptional()
    @IsObject({ message: 'Giờ hoạt động phải là đối tượng' })
    @ValidateNested({ message: 'Giờ hoạt động không hợp lệ' })
    @Type(() => OperatingHoursDto)
    operatingHours?: OperatingHoursDto;

    @ApiPropertyOptional({
        description: 'Ngày hoạt động trong tuần',
        example: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        maxItems: 7
    })
    @IsOptional()
    @IsArray({ message: 'Ngày hoạt động phải là mảng' })
    @IsEnum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], {
        each: true,
        message: 'Ngày hoạt động phải là một trong các ngày trong tuần hợp lệ'
    })
    @ArrayMaxSize(7, { message: 'Không được vượt quá 7 ngày' })
    operatingDays?: string[];
}

export class CreateRouteAutoDto {
    @ApiProperty({
        description: 'Tên tuyến đường',
        example: 'TP.HCM - Cần Thơ',
        minLength: 5,
        maxLength: 200
    })
    @IsString({ message: 'Tên tuyến đường phải là chuỗi ký tự' })
    @IsNotEmpty({ message: 'Tên tuyến đường không được để trống' })
    @Length(5, 200, { message: 'Tên tuyến đường phải có độ dài từ 5 đến 200 ký tự' })
    @Transform(({ value }) => value?.trim())
    name: string;

    @ApiPropertyOptional({
        description: 'Mô tả tuyến đường',
        maxLength: 1000
    })
    @IsOptional()
    @IsString({ message: 'Mô tả phải là chuỗi ký tự' })
    @Length(0, 1000, { message: 'Mô tả không được vượt quá 1000 ký tự' })
    @Transform(({ value }) => value?.trim())
    description?: string;

    @ApiProperty({
        description: 'ID trạm khởi hành',
        example: '60f7b3b3b3b3b3b3b3b3b3b3'
    })
    @IsString({ message: 'ID trạm khởi hành phải là chuỗi ký tự' })
    @IsNotEmpty({ message: 'ID trạm khởi hành không được để trống' })
    @IsMongoId({ message: 'ID trạm khởi hành không hợp lệ' })
    departureStationId: string;

    @ApiProperty({
        description: 'ID trạm đến',
        example: '60f7b3b3b3b3b3b3b3b3b3b4'
    })
    @IsString({ message: 'ID trạm đến phải là chuỗi ký tự' })
    @IsNotEmpty({ message: 'ID trạm đến không được để trống' })
    @IsMongoId({ message: 'ID trạm đến không hợp lệ' })
    arrivalStationId: string;

    @ApiPropertyOptional({
        description: 'Danh sách ID các trạm trung gian',
        example: ['60f7b3b3b3b3b3b3b3b3b3b5'],
        maxItems: 10
    })
    @IsOptional()
    @IsArray({ message: 'Danh sách trạm trung gian phải là mảng' })
    @IsString({ each: true, message: 'Mỗi ID trạm trung gian phải là chuỗi ký tự' })
    @IsMongoId({ each: true, message: 'Mỗi ID trạm trung gian phải hợp lệ' })
    @ArrayMaxSize(10, { message: 'Không được vượt quá 10 trạm trung gian' })
    intermediateStations?: string[];

    @ApiPropertyOptional({
        description: 'Giá cơ bản (VNĐ)',
        example: 120000,
        minimum: 1000,
        maximum: 5000000
    })
    @IsOptional()
    @IsNumber({}, { message: 'Giá cơ bản phải là số' })
    @Min(1000, { message: 'Giá cơ bản phải >= 1.000 VNĐ' })
    @Max(5000000, { message: 'Giá cơ bản phải <= 5.000.000 VNĐ' })
    basePrice?: number;

    @ApiPropertyOptional({
        description: 'Giá mỗi km (VNĐ)',
        example: 1000,
        minimum: 100,
        maximum: 10000
    })
    @IsOptional()
    @IsNumber({}, { message: 'Giá mỗi km phải là số' })
    @Min(100, { message: 'Giá mỗi km phải >= 100 VNĐ' })
    @Max(10000, { message: 'Giá mỗi km phải <= 10.000 VNĐ' })
    pricePerKm?: number;

    @ApiPropertyOptional({
        description: 'Giờ hoạt động',
        type: OperatingHoursDto
    })
    @IsOptional()
    @IsObject({ message: 'Giờ hoạt động phải là đối tượng' })
    @ValidateNested({ message: 'Giờ hoạt động không hợp lệ' })
    @Type(() => OperatingHoursDto)
    operatingHours?: OperatingHoursDto;

    @ApiPropertyOptional({
        description: 'Ngày hoạt động trong tuần',
        example: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        maxItems: 7
    })
    @IsOptional()
    @IsArray({ message: 'Ngày hoạt động phải là mảng' })
    @IsEnum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], {
        each: true,
        message: 'Ngày hoạt động phải là một trong các ngày trong tuần hợp lệ'
    })
    @ArrayMaxSize(7, { message: 'Không được vượt quá 7 ngày' })
    operatingDays?: string[];
}