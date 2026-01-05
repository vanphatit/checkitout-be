import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class RouteStatsResponseDto {
    @ApiProperty({ description: 'Tổng số tuyến đường', example: 20 })
    @Expose()
    total: number;

    @ApiProperty({ description: 'Số tuyến đường hoạt động', example: 15 })
    @Expose()
    active: number;

    @ApiProperty({ description: 'Số tuyến đường ngừng hoạt động', example: 3 })
    @Expose()
    inactive: number;

    @ApiProperty({ description: 'Số tuyến đường đã xóa', example: 2 })
    @Expose()
    deleted: number;
}
