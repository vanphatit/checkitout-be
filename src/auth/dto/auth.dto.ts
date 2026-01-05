import {
  IsEmail,
  IsString,
  MinLength,
  MaxLength,
  Matches,
  IsOptional,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '../../users/enums/user-role.enum';
import {
  PASSWORD_REGEX,
  PASSWORD_VALIDATION_MESSAGE,
  PASSWORD_MIN_LENGTH,
  PHONE_REGEX,
  PHONE_VALIDATION_MESSAGE,
} from '../constants/validation.constants';

export class LoginDto {
  @ApiPropertyOptional({
    example: 'user@example.com',
    description: 'Email (use email OR phone, at least one required)',
  })
  @ValidateIf((o) => !o.phone || o.email)
  @IsEmail({}, { message: 'Please provide a valid email' })
  email?: string;

  @ApiPropertyOptional({
    example: '+1234567890',
    description: 'Phone number (use email OR phone, at least one required)',
  })
  @ValidateIf((o) => !o.email || o.phone)
  @IsString({ message: 'Please provide a valid phone number' })
  @Matches(PHONE_REGEX, { message: PHONE_VALIDATION_MESSAGE })
  phone?: string;

  @ApiProperty({ example: 'Password123!' })
  @IsString()
  password: string;
}

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Password123!',
    description: `Password must contain at least ${PASSWORD_MIN_LENGTH} characters, 1 uppercase, 1 lowercase, 1 number and 1 special character`,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_VALIDATION_MESSAGE })
  password: string;

  @ApiProperty({ example: 'John' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  lastName: string;

  @ApiProperty({
    example: '+1234567890',
    description:
      'Phone number (required). If phone exists with PRE_REGISTERED status, this will complete their registration instead of creating new user.',
  })
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_VALIDATION_MESSAGE })
  phone: string;

  @ApiPropertyOptional({
    enum: UserRole,
    example: UserRole.CUSTOMER,
    description: 'User role - defaults to CUSTOMER',
  })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;
}

export class ForgotPasswordDto {
  @ApiProperty({ example: 'john@example.com' })
  @IsEmail()
  email: string;
}

export class ResetPasswordDto {
  @ApiProperty({ example: 'reset-token-here' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'newStrongPassword123' })
  @IsString()
  @MinLength(6)
  newPassword: string;
}

export class RefreshTokenDto {
  @ApiProperty({ example: 'refresh-token-here' })
  @IsString()
  refreshToken: string;
}

export class VerifyEmailDto {
  @ApiProperty({ example: 'email-verification-token-here' })
  @IsString()
  token: string;
}

export class ChangePasswordDto {
  @ApiProperty({ example: 'CurrentPassword123!' })
  @IsString()
  currentPassword: string;

  @ApiProperty({ example: 'NewPassword456!' })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_VALIDATION_MESSAGE })
  newPassword: string;
}

export class CompleteRegistrationDto {
  @ApiProperty({
    example: '+1234567890',
    description: 'Phone number of the pre-registered user',
  })
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_VALIDATION_MESSAGE })
  phone: string;

  @ApiProperty({
    example: 'user@example.com',
    description: 'Email address for the account',
  })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Password123!',
    description: `Password must contain at least ${PASSWORD_MIN_LENGTH} characters, 1 uppercase, 1 lowercase, 1 number and 1 special character`,
  })
  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH)
  @Matches(PASSWORD_REGEX, { message: PASSWORD_VALIDATION_MESSAGE })
  password: string;
}
