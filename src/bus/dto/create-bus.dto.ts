import { IsString, IsOptional, IsEnum, IsArray, IsInt } from 'class-validator';
import { BusStatus } from '../enums/bus-status.enum';
import { BusType } from '../enums/bus-type.enum';

export class CreateBusDto {
  @IsString()
  busNo: string;

  @IsString()
  plateNo: string;

  @IsEnum(BusType)
  type: BusType;

  @IsInt()
  vacancy: number;

  @IsString()
  driverName: string;

  @IsEnum(BusStatus)
  @IsOptional()
  status?: BusStatus;

  @IsArray()
  @IsOptional()
  images?: string[];
}
