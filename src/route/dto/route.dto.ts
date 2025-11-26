import { IsString, IsNotEmpty, IsArray, IsNumber, IsOptional, IsBoolean, IsMongoId, Min, Matches } from 'class-validator';
import { ApiProperty, PartialType } from '@nestjs/swagger';

export class CreateRouteDto {
    @ApiProperty({ description: 'Tên tuyến đường (VD: Sài Gòn - Hồng Ngự)' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ description: 'Danh sách ID các trạm', type: [String] })
    @IsArray()
    @IsMongoId({ each: true })
    stationIds: string[];

    @ApiProperty({ description: 'Khoảng cách (km)', example: 150 })
    @IsNumber()
    @Min(0)
    distance: number;

    @ApiProperty({ description: 'Giờ khởi hành tham chiếu (HH:mm)', example: '08:00' })
    @IsString()
    @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'ETD phải có định dạng HH:mm' })
    etd: string;

    @ApiProperty({ description: 'Thời gian di chuyển dự kiến (phút)', required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    estimatedDuration?: number;

    @ApiProperty({ description: 'Mô tả tuyến đường', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ description: 'Giá cơ bản', required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    basePrice?: number;

    @ApiProperty({ description: 'Giá theo km', required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    pricePerKm?: number;

    @ApiProperty({
        description: 'Giờ hoạt động',
        required: false,
        example: { start: '05:00', end: '22:00' }
    })
    @IsOptional()
    operatingHours?: {
        start: string;
        end: string;
    };

    @ApiProperty({
        description: 'Ngày hoạt động',
        required: false,
        type: [String],
        example: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    operatingDays?: string[];
}

export class UpdateRouteDto extends PartialType(CreateRouteDto) {
    @ApiProperty({ description: 'Trạng thái hoạt động', required: false })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}

export class CreateRouteFromAutoDto {
    @ApiProperty({ description: 'Tên tuyến đường' })
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiProperty({ description: 'Danh sách ID các trạm', type: [String] })
    @IsArray()
    @IsMongoId({ each: true })
    stationIds: string[];

    @ApiProperty({ description: 'Giờ khởi hành tham chiếu (HH:mm)', example: '08:00' })
    @IsString()
    @Matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, { message: 'ETD phải có định dạng HH:mm' })
    etd: string;

    @ApiProperty({ description: 'Mô tả tuyến đường', required: false })
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ description: 'Giá cơ bản', required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    basePrice?: number;

    @ApiProperty({ description: 'Giá theo km', required: false })
    @IsOptional()
    @IsNumber()
    @Min(0)
    pricePerKm?: number;

    @ApiProperty({
        description: 'Giờ hoạt động',
        required: false,
        example: { start: '05:00', end: '22:00' }
    })
    @IsOptional()
    operatingHours?: {
        start: string;
        end: string;
    };

    @ApiProperty({
        description: 'Ngày hoạt động',
        required: false,
        type: [String]
    })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    operatingDays?: string[];
}
