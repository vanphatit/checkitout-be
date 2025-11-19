import { IsString, IsEnum } from 'class-validator';
import { SeatStatus } from '../enums/seat-status.enum';

export class CreateSeatDto {
  @IsString()
  seatNo: string;

  @IsString()
  busId: string;

  @IsEnum(SeatStatus)
  status: SeatStatus;
}
