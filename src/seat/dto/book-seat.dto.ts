import { IsString, IsNotEmpty, IsArray, IsMongoId } from 'class-validator';

export class BookSeatDto {
  @IsArray()
  @IsString({ each: true })
  @IsNotEmpty()
  seatNos: string[];
}
