import {
  IsString,
  IsOptional,
  IsEnum,
  IsArray,
  IsInt,
  ValidateNested,
} from 'class-validator';
import { BusStatus } from '../enums/bus-status.enum';
import { BusType } from '../enums/bus-type.enum';
import { Type } from 'class-transformer';

export class BusImageDto {
  @IsString()
  url: string;

  @IsString()
  publicId: string;
}

export class CreateBusDto {
  @IsString()
  busNo: string;

  @IsString()
  plateNo: string;

  @IsEnum(BusType)
  type: BusType;

  @IsString()
  driverName: string;

  @IsEnum(BusStatus)
  @IsOptional()
  status?: BusStatus;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BusImageDto)
  @IsOptional()
  images?: BusImageDto[];
}
