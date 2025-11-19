import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { StationResponseDto } from '../../station/dto/station-response.dto';

export class OperatingHoursResponseDto {
    @ApiProperty({ description: 'Giờ bắt đầu', example: '05:00' })
    @Expose()
    start: string;

    @ApiProperty({ description: 'Giờ kết thúc', example: '22:00' })
    @Expose()
    end: string;
}

export class RouteResponseDto {
    @ApiProperty({ description: 'ID tuyến đường', example: '60f7b3b3b3b3b3b3b3b3b3b3' })
    @Expose()
    _id: string;

    @ApiProperty({ description: 'Tên tuyến đường', example: 'TP.HCM - Cần Thơ' })
    @Expose()
    name: string;

    @ApiProperty({ description: 'Mô tả tuyến đường', example: 'Tuyến xe cao tốc' })
    @Expose()
    description?: string;

    @ApiProperty({ description: 'Thông tin trạm khởi hành', type: StationResponseDto })
    @Expose()
    @Type(() => StationResponseDto)
    departureStation?: StationResponseDto;

    @ApiProperty({ description: 'ID trạm khởi hành', example: '60f7b3b3b3b3b3b3b3b3b3b3' })
    @Expose()
    departureStationId: string;

    @ApiProperty({ description: 'Thông tin trạm đến', type: StationResponseDto })
    @Expose()
    @Type(() => StationResponseDto)
    arrivalStation?: StationResponseDto;

    @ApiProperty({ description: 'ID trạm đến', example: '60f7b3b3b3b3b3b3b3b3b3b4' })
    @Expose()
    arrivalStationId: string;

    @ApiProperty({
        description: 'Danh sách trạm trung gian',
        example: ['60f7b3b3b3b3b3b3b3b3b3b5'],
        type: [String]
    })
    @Expose()
    intermediateStations?: string[];

    @ApiProperty({
        description: 'Thông tin các trạm trung gian',
        type: [StationResponseDto]
    })
    @Expose()
    @Type(() => StationResponseDto)
    intermediateStationDetails?: StationResponseDto[];

    @ApiProperty({ description: 'Khoảng cách (mét)', example: 169000 })
    @Expose()
    distance: number;

    @ApiProperty({ description: 'Thời gian di chuyển (phút)', example: 180 })
    @Expose()
    duration: number;

    @ApiProperty({ description: 'Giá cơ bản (VNĐ)', example: 120000 })
    @Expose()
    basePrice?: number;

    @ApiProperty({ description: 'Giá mỗi km (VNĐ)', example: 1000 })
    @Expose()
    pricePerKm?: number;

    @ApiProperty({ description: 'Giờ hoạt động', type: OperatingHoursResponseDto })
    @Expose()
    @Type(() => OperatingHoursResponseDto)
    operatingHours?: OperatingHoursResponseDto;

    @ApiProperty({
        description: 'Ngày hoạt động trong tuần',
        example: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
        type: [String]
    })
    @Expose()
    operatingDays?: string[];

    @ApiProperty({ description: 'Trạng thái hoạt động', example: true })
    @Expose()
    isActive: boolean;

    @ApiProperty({ description: 'Ngày tạo', example: '2024-12-20T10:30:00.000Z' })
    @Expose()
    createdAt: Date;

    @ApiProperty({ description: 'Ngày cập nhật', example: '2024-12-20T10:30:00.000Z' })
    @Expose()
    updatedAt: Date;
}

export class PaginatedRouteResponseDto {
    @ApiProperty({ description: 'Danh sách tuyến đường', type: [RouteResponseDto] })
    @Expose()
    @Type(() => RouteResponseDto)
    data: RouteResponseDto[];

    @ApiProperty({ description: 'Tổng số bản ghi', example: 15 })
    @Expose()
    total: number;

    @ApiProperty({ description: 'Trang hiện tại', example: 1 })
    @Expose()
    page: number;

    @ApiProperty({ description: 'Số bản ghi mỗi trang', example: 10 })
    @Expose()
    limit: number;

    @ApiProperty({ description: 'Tổng số trang', example: 2 })
    @Expose()
    totalPages: number;

    @ApiProperty({ description: 'Có trang tiếp theo không', example: true })
    @Expose()
    hasNextPage: boolean;

    @ApiProperty({ description: 'Có trang trước không', example: false })
    @Expose()
    hasPrevPage: boolean;
}