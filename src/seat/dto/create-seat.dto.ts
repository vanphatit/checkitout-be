import { IsString, IsMongoId } from 'class-validator';

export class CreateSeatDto {
  @IsString()
  seatNo: string;

  @IsMongoId()
  busId: string;
}
