import { CreateSeatDto } from './create-seat.dto';

export class UpdateSeatStatusDto extends CreateSeatDto {
  seatNos: string[];
}
