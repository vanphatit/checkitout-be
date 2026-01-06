import { PartialType } from '@nestjs/swagger';
import { UpdateSchedulingDto } from './create-scheduling.dto';

export class UpdateSchedulingStatusDto extends PartialType(
  UpdateSchedulingDto,
) {}
