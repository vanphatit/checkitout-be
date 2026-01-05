import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsBoolean } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateStationDto } from './create-station.dto';

export class UpdateStationDto extends PartialType(CreateStationDto) {
    @ApiPropertyOptional({
        description: 'Trạng thái hoạt động của trạm',
        example: true
    })
    @IsOptional()
    @IsBoolean({ message: 'Trạng thái hoạt động phải là boolean' })
    isActive?: boolean;
}