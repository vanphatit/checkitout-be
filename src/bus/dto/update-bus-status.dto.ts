import { IsEnum } from 'class-validator';
import { BusStatus } from '../enums/bus-status.enum';
export class UpdateBusStatusDto {
  @IsEnum(BusStatus)
  status: BusStatus;
}
