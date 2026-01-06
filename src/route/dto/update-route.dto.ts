import { PartialType } from '@nestjs/swagger';
import { CreateRouteManualDto } from './create-route.dto';

export class UpdateRouteDto extends PartialType(CreateRouteManualDto) {}
