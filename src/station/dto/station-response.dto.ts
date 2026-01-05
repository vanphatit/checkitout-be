import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

export class LocationResponseDto {
    @ApiProperty({ description: 'Loại geometry', example: 'Point' })
    @Expose()
    type: string;

    @ApiProperty({
        description: 'Tọa độ [longitude, latitude]',
        example: [106.6296638, 10.8230989],
        type: [Number]
    })
    @Expose()
    coordinates: [number, number];
}

export class StationResponseDto {
    @ApiProperty({ description: 'ID trạm', example: '60f7b3b3b3b3b3b3b3b3b3b3' })
    @Expose()
    _id: string;

    @ApiProperty({ description: 'Tên trạm', example: 'Bến xe Miền Tây' })
    @Expose()
    name: string;

    @ApiProperty({ description: 'Địa chỉ trạm', example: '395 Kinh Dương Vương, An Lạc, Bình Tân, TP.HCM' })
    @Expose()
    address: string;

    @ApiProperty({ description: 'Vị trí địa lý', type: LocationResponseDto, required: false })
    @Expose()
    @Type(() => LocationResponseDto)
    location?: LocationResponseDto;

    @ApiProperty({ description: 'Kinh độ', example: 106.6296638, required: false })
    @Expose()
    longitude?: number;

    @ApiProperty({ description: 'Vĩ độ', example: 10.8230989, required: false })
    @Expose()
    latitude?: number;

    @ApiProperty({ description: 'Mô tả trạm', example: 'Bến xe chính thức của TP.HCM' })
    @Expose()
    description?: string;

    @ApiProperty({ description: 'Số điện thoại liên hệ', example: '028-3868-4430' })
    @Expose()
    contactPhone?: string;

    @ApiProperty({ description: 'Giờ hoạt động', example: '05:00 - 22:00' })
    @Expose()
    operatingHours?: string;

    @ApiProperty({
        description: 'Tiện ích tại trạm',
        example: ['Toilet', 'Canteen', 'Parking'],
        type: [String]
    })
    @Expose()
    facilities?: string[];

    @ApiProperty({ description: 'Trạng thái hoạt động', example: true })
    @Expose()
    isActive: boolean;

    @ApiProperty({ description: 'Trạng thái xóa', example: false })
    @Expose()
    isDeleted: boolean;

    @ApiProperty({ description: 'Ngày tạo', example: '2024-12-20T10:30:00.000Z' })
    @Expose()
    createdAt: Date;

    @ApiProperty({ description: 'Ngày cập nhật', example: '2024-12-20T10:30:00.000Z' })
    @Expose()
    updatedAt: Date;
}

export class PaginatedStationResponseDto {
    @ApiProperty({ description: 'Danh sách trạm', type: [StationResponseDto] })
    @Expose()
    @Type(() => StationResponseDto)
    data: StationResponseDto[];

    @ApiProperty({ description: 'Tổng số bản ghi', example: 25 })
    @Expose()
    total: number;

    @ApiProperty({ description: 'Trang hiện tại', example: 1 })
    @Expose()
    page: number;

    @ApiProperty({ description: 'Số bản ghi mỗi trang', example: 10 })
    @Expose()
    limit: number;

    @ApiProperty({ description: 'Tổng số trang', example: 3 })
    @Expose()
    totalPages: number;

    @ApiProperty({ description: 'Có trang tiếp theo không', example: true })
    @Expose()
    hasNextPage: boolean;

    @ApiProperty({ description: 'Có trang trước không', example: false })
    @Expose()
    hasPrevPage: boolean;
}

export class DistanceResponseDto {
    @ApiProperty({ description: 'ID trạm thứ nhất', example: '60f7b3b3b3b3b3b3b3b3b3b3' })
    @Expose()
    station1Id: string;

    @ApiProperty({ description: 'Tên trạm thứ nhất', example: 'Bến xe Miền Tây' })
    @Expose()
    station1Name: string;

    @ApiProperty({ description: 'ID trạm thứ hai', example: '60f7b3b3b3b3b3b3b3b3b3b4' })
    @Expose()
    station2Id: string;

    @ApiProperty({ description: 'Tên trạm thứ hai', example: 'Bến xe Cần Thơ' })
    @Expose()
    station2Name: string;

    @ApiProperty({ description: 'Khoảng cách (km)', example: 169.5 })
    @Expose()
    distance: number;

    @ApiProperty({ description: 'Đơn vị', example: 'km' })
    @Expose()
    unit: string;
}

export class PlaceSearchResponseDto {
    @ApiProperty({ description: 'ID địa điểm', example: '12345' })
    @Expose()
    place_id: string;

    @ApiProperty({ description: 'Tên địa điểm', example: 'Bến xe buýt Nguyễn Du' })
    @Expose()
    name: string;

    @ApiProperty({ description: 'Tên hiển thị', example: 'Bến xe buýt Nguyễn Du, Quận 1, TP.HCM' })
    @Expose()
    display_name: string;

    @ApiProperty({ description: 'Địa chỉ', example: 'Nguyễn Du, Quận 1, TP.HCM' })
    @Expose()
    address: string;

    @ApiProperty({ description: 'Kinh độ', example: 106.6955 })
    @Expose()
    longitude: number;

    @ApiProperty({ description: 'Vĩ độ', example: 10.7698 })
    @Expose()
    latitude: number;

    @ApiProperty({ description: 'Loại địa điểm', example: 'amenity' })
    @Expose()
    type: string;

    @ApiProperty({ description: 'Loại chi tiết', example: 'bus_station' })
    @Expose()
    subtype?: string;

    @ApiProperty({ description: 'Khoảng cách từ vị trí tìm kiếm (m)', example: 150 })
    @Expose()
    distance?: number;
} export class StationDistanceResponseDto {
    @ApiProperty({ description: 'Khoảng cách (mét)', example: 169000 })
    @Expose()
    distance: number;

    @ApiProperty({ description: 'Thời gian di chuyển (phút)', example: 180 })
    @Expose()
    duration: number;
}

export class OpenStreetMapPlaceResponseDto {
    @ApiProperty({ description: 'Tên địa điểm', example: 'Bến xe Cần Thơ' })
    @Expose()
    name: string;

    @ApiProperty({ description: 'Địa chỉ đầy đủ', example: '91 Nguyễn Trãi, An Phú, Ninh Kiều, Cần Thơ' })
    @Expose()
    address: string;

    @ApiProperty({ description: 'Kinh độ', example: 105.7469 })
    @Expose()
    longitude: number;

    @ApiProperty({ description: 'Vĩ độ', example: 10.0452 })
    @Expose()
    latitude: number;

    @ApiProperty({ description: 'Loại địa điểm', example: 'bus_station' })
    @Expose()
    type?: string;
}