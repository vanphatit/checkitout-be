import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class StationStatsResponseDto {
    @ApiProperty({ description: 'Tổng số trạm', example: 50 })
    @Expose()
    total: number;

    @ApiProperty({ description: 'Số trạm hoạt động', example: 45 })
    @Expose()
    active: number;

    @ApiProperty({ description: 'Số trạm ngừng hoạt động', example: 3 })
    @Expose()
    inactive: number;

    @ApiProperty({ description: 'Số trạm đã xóa', example: 2 })
    @Expose()
    deleted: number;
}
