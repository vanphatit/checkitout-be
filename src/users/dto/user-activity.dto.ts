import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserActivityAction } from '../enums/user-activity-action.enum';

export class UserActivityResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  userId: string;

  @ApiProperty({ enum: UserActivityAction })
  action: UserActivityAction;

  @ApiPropertyOptional()
  performedBy?: string;

  @ApiPropertyOptional({ type: Object })
  metadata?: Record<string, any>;

  @ApiPropertyOptional()
  description?: string;

  @ApiPropertyOptional()
  ipAddress?: string;

  @ApiPropertyOptional()
  device?: string;

  @ApiProperty()
  createdAt: Date;
}

export interface LogUserActivityDto {
  userId: string;
  action: UserActivityAction;
  performedBy?: string;
  metadata?: Record<string, any>;
  description?: string;
  ipAddress?: string;
  device?: string;
}
