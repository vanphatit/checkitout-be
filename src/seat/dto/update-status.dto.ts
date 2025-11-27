import { IsArray } from 'class-validator';
export class UpdateSeatStatusDto {
  @IsArray()
  seatNos: string[];
}
