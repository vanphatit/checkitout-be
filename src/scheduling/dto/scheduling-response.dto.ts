import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';
import { RouteResponseDto } from '../../route/dto/route-response.dto';

export class DriverResponseDto {
    @ApiProperty({ description: 'Tên tài xế', example: 'Nguyễn Văn A' })
    @Expose()
    name: string;

    @ApiProperty({ description: 'Số điện thoại', example: '0901234567' })
    @Expose()
    phone: string;

    @ApiProperty({ description: 'Số bằng lái', example: 'B2-123456789' })
    @Expose()
    licenseNumber: string;
}

export class ConductorResponseDto {
    @ApiProperty({ description: 'Tên phụ xe', example: 'Trần Thị B' })
    @Expose()
    name: string;

    @ApiProperty({ description: 'Số điện thoại', example: '0907654321' })
    @Expose()
    phone: string;
}

export class BusResponseDto {
    @ApiProperty({ description: 'ID xe', example: '60f7b3b3b3b3b3b3b3b3b3b3' })
    @Expose()
    _id: string;

    @ApiProperty({ description: 'Biển số xe', example: '51B-12345' })
    @Expose()
    licensePlate: string;

    @ApiProperty({ description: 'Loại xe', example: 'Giường nằm' })
    @Expose()
    busType: string;

    @ApiProperty({ description: 'Số ghế', example: 45 })
    @Expose()
    totalSeats: number;

    @ApiProperty({ description: 'Trạng thái', example: 'available' })
    @Expose()
    status: string;
}

export class SchedulingResponseDto {
    @ApiProperty({ description: 'ID lịch trình', example: '60f7b3b3b3b3b3b3b3b3b3b3' })
    @Expose()
    _id: string;

    @ApiProperty({ description: 'ID tuyến đường', example: '60f7b3b3b3b3b3b3b3b3b3b4' })
    @Expose()
    routeId: string;

    @ApiProperty({ description: 'Thông tin tuyến đường', type: RouteResponseDto })
    @Expose()
    @Type(() => RouteResponseDto)
    route?: RouteResponseDto;

    @ApiProperty({
        description: 'Danh sách ID xe',
        example: ['60f7b3b3b3b3b3b3b3b3b3b5'],
        type: [String]
    })
    @Expose()
    busIds: string[];

    @ApiProperty({ description: 'Thông tin các xe', type: [BusResponseDto] })
    @Expose()
    @Type(() => BusResponseDto)
    buses?: BusResponseDto[];

    @ApiProperty({ description: 'Giờ khởi hành dự kiến', example: '08:00' })
    @Expose()
    etd: string;

    @ApiProperty({ description: 'Ngày khởi hành', example: '2024-12-25T00:00:00.000Z' })
    @Expose()
    departureDate: Date;

    @ApiProperty({ description: 'Giờ đến dự kiến', example: '11:00' })
    @Expose()
    eta?: string;

    @ApiProperty({ description: 'Ngày đến dự kiến', example: '2024-12-25T00:00:00.000Z' })
    @Expose()
    arrivalDate?: Date;

    @ApiProperty({ description: 'Ghi chú', example: 'Chuyến xe cao tốc' })
    @Expose()
    note?: string;

    @ApiProperty({ description: 'Trạng thái hoạt động', example: true })
    @Expose()
    isActive: boolean;

    @ApiProperty({
        description: 'Trạng thái lịch trình',
        example: 'scheduled',
        enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'delayed']
    })
    @Expose()
    status: string;

    @ApiProperty({ description: 'Thời gian khởi hành thực tế', example: '08:05' })
    @Expose()
    actualDepartureTime?: string;

    @ApiProperty({ description: 'Thời gian đến thực tế', example: '11:10' })
    @Expose()
    actualArrivalTime?: string;

    @ApiProperty({ description: 'Số ghế còn trống', example: 25 })
    @Expose()
    availableSeats: number;

    @ApiProperty({ description: 'Số ghế đã đặt', example: 20 })
    @Expose()
    bookedSeats: number;

    @ApiProperty({ description: 'Giá vé (VNĐ)', example: 120000 })
    @Expose()
    price?: number;

    @ApiProperty({ description: 'Thông tin tài xế', type: DriverResponseDto })
    @Expose()
    @Type(() => DriverResponseDto)
    driver?: DriverResponseDto;

    @ApiProperty({ description: 'Thông tin phụ xe', type: ConductorResponseDto })
    @Expose()
    @Type(() => ConductorResponseDto)
    conductor?: ConductorResponseDto;

    @ApiProperty({ description: 'Thời gian di chuyển dự kiến (phút)', example: 180 })
    @Expose()
    estimatedDuration?: number;

    @ApiProperty({
        description: 'Các ngày lặp lại',
        example: ['monday', 'tuesday', 'wednesday'],
        type: [String]
    })
    @Expose()
    recurringDays?: string[];

    @ApiProperty({ description: 'Ngày kết thúc lặp lại', example: '2024-12-31T00:00:00.000Z' })
    @Expose()
    recurringEndDate?: Date;

    @ApiProperty({ description: 'Có phải lịch trình lặp lại', example: false })
    @Expose()
    isRecurring: boolean;

    @ApiProperty({ description: 'Ngày tạo', example: '2024-12-20T10:30:00.000Z' })
    @Expose()
    createdAt: Date;

    @ApiProperty({ description: 'Ngày cập nhật', example: '2024-12-20T10:30:00.000Z' })
    @Expose()
    updatedAt: Date;
}

export class PaginatedSchedulingResponseDto {
    @ApiProperty({ description: 'Danh sách lịch trình', type: [SchedulingResponseDto] })
    @Expose()
    @Type(() => SchedulingResponseDto)
    data: SchedulingResponseDto[];

    @ApiProperty({ description: 'Tổng số bản ghi', example: 240 })
    @Expose()
    total: number;

    @ApiProperty({ description: 'Trang hiện tại', example: 1 })
    @Expose()
    page: number;

    @ApiProperty({ description: 'Số bản ghi mỗi trang', example: 10 })
    @Expose()
    limit: number;

    @ApiProperty({ description: 'Tổng số trang', example: 24 })
    @Expose()
    totalPages: number;

    @ApiProperty({ description: 'Có trang tiếp theo không', example: true })
    @Expose()
    hasNextPage: boolean;

    @ApiProperty({ description: 'Có trang trước không', example: false })
    @Expose()
    hasPrevPage: boolean;
}

export class SchedulingSearchResponseDto extends SchedulingResponseDto {
    @ApiProperty({ description: 'Khoảng cách từ vị trí hiện tại (km)', example: 2.5 })
    @Expose()
    distance?: number;

    @ApiProperty({ description: 'Điểm phù hợp (0-100)', example: 85 })
    @Expose()
    relevanceScore?: number;
}