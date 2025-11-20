import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, IsNumber, IsLongitude, IsLatitude } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateStationDto {
    @ApiProperty({ description: 'Tên trạm' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ description: 'Địa chỉ trạm' })
    @IsString()
    @IsNotEmpty()
    address: string;

    @ApiProperty({ description: 'Kinh độ', example: 106.6296638 })
    @IsNumber()
    @IsLongitude()
    longitude: number;

    @ApiProperty({ description: 'Vĩ độ', example: 10.8230989 })
    @IsNumber()
    @IsLatitude()
    latitude: number;

    @ApiProperty({ description: 'Mô tả trạm', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ description: 'Số điện thoại liên hệ', required: false })
    @IsOptional()
    @IsString()
    contactPhone?: string;

    @ApiProperty({ description: 'Giờ hoạt động', required: false })
    @IsOptional()
    @IsString()
    operatingHours?: string;

    @ApiProperty({ description: 'Danh sách tiện ích', required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    facilities?: string[];

    @ApiProperty({ description: 'Google Place ID', required: false })
    @IsOptional()
    @IsString()
    googlePlaceId?: string;
}

export class UpdateStationDto extends PartialType(CreateStationDto) {
    @ApiProperty({ description: 'Trạng thái hoạt động', required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class CreateStationFromAddressDto {
    @ApiProperty({ description: 'Địa chỉ để tìm kiếm' })
    @IsString()
    @IsNotEmpty()
    address: string;

    @ApiProperty({ description: 'Tên trạm (tùy chọn, sẽ tự động tạo nếu không có)', required: false })
    @IsOptional()
    @IsString()
    name?: string;

    @ApiProperty({ description: 'Mô tả trạm', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ description: 'Danh sách tiện ích', required: false, type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    facilities?: string[];
}