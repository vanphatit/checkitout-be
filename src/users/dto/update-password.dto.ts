import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdatePasswordDto {
  @ApiProperty({ example: 'Password123!' })
  @IsString()
  @MinLength(8)
  password: string;
}

export interface UserUpdateWithPassword {
  password?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: string;
  status?: string;
}
