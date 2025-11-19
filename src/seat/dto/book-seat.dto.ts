import { IsString, IsNotEmpty, IsArray } from 'class-validator';

export class BookSeatDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  seatNos: string[];
}
