import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import {
  LoginDto,
  RegisterDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyEmailDto,
} from './dto/auth.dto';
import { RedisService } from '../modules/redis/redis.service';
import { EmailService } from '../modules/email/email.service';
import { UserDocument, UserStatus } from '../users';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
    private emailService: EmailService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (
      user &&
      (await this.usersService.validatePassword(password, user.password))
    ) {
      const { password: _, ...result } = user.toObject();
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check user status
    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException(
        'Account has been deactivated. Please contact support.',
      );
    }

    if (user.status === UserStatus.PENDING) {
      // Resend verification email
      await this.resendVerificationEmail(user);
      throw new UnauthorizedException(
        'Please verify your email before logging in. A new verification email has been sent.',
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    const tokens = await this.generateTokens(user);

    // Store refresh token in Redis
    await this.redisService.setWithExpiry(
      `refresh_token:${user._id}`,
      tokens.refreshToken,
      7 * 24 * 60 * 60, // 7 days
    );

    return {
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
      },
      ...tokens,
    };
  }

  async register(registerDto: RegisterDto) {
    const existingUser = await this.usersService.findByEmail(registerDto.email);
    if (existingUser) {
      throw new ConflictException('User already exists');
    }

    const user = await this.usersService.create(registerDto);

    // Generate verification token and save to Redis
    const verificationToken = await this.jwtService.signAsync(
      { userId: user._id, type: 'email_verification' },
      {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
        expiresIn: '24h',
      },
    );

    await this.redisService.set(
      `email_verification:${verificationToken}`,
      JSON.stringify({
        userId: (user._id as string).toString(),
        email: registerDto.email,
      }),
      24 * 60 * 60, // 24 hours
    );

    // Send verification email
    try {
      await this.emailService.sendEmailVerification(
        user.email,
        `${user.firstName} ${user.lastName}`,
        verificationToken,
      );
    } catch (error) {
      console.error('Failed to send verification email:', error);
    }

    return {
      message:
        'User registered successfully. Please check your email to verify your account.',
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // Check if refresh token exists in Redis
      const storedToken = await this.redisService.get(
        `refresh_token:${payload.sub}`,
      );
      if (!storedToken || storedToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const user = await this.usersService.findById(payload.sub);
      if (!user || user.status !== UserStatus.ACTIVE) {
        throw new UnauthorizedException('User not found or inactive');
      }

      const tokens = await this.generateTokens(user);

      // Update refresh token in Redis
      await this.redisService.setWithExpiry(
        `refresh_token:${user._id}`,
        tokens.refreshToken,
        7 * 24 * 60 * 60, // 7 days
      );

      return tokens;
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string) {
    // Remove refresh token from Redis
    await this.redisService.del(`refresh_token:${userId}`);
    return { message: 'Logged out successfully' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(forgotPasswordDto.email);
    if (!user) {
      // Don't reveal if user exists or not
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Store reset token in Redis with 15 minutes expiry
    await this.redisService.setWithExpiry(
      `reset_token:${resetToken}`,
      (user as any)._id.toString(),
      15 * 60, // 15 minutes
    );

    // Send reset email
    try {
      await this.emailService.sendPasswordResetEmail(user.email, resetToken);
    } catch (error) {
      console.error('Failed to send reset email:', error);
      throw new BadRequestException('Failed to send reset email');
    }

    return { message: 'If the email exists, a reset link has been sent' };
  }

  async resetPassword(resetPasswordDto: ResetPasswordDto) {
    // Get user ID from Redis using reset token
    const userId = await this.redisService.get(
      `reset_token:${resetPasswordDto.token}`,
    );
    if (!userId) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);

    await this.usersService.update((user as any)._id.toString(), {
      password: hashedPassword,
    });

    // Remove reset token from Redis
    await this.redisService.del(`reset_token:${resetPasswordDto.token}`);

    // Invalidate all refresh tokens for this user
    await this.redisService.del(`refresh_token:${(user as any)._id}`);

    return { message: 'Password reset successfully' };
  }

  async verifyEmail(verifyEmailDto: VerifyEmailDto) {
    const { token } = verifyEmailDto;

    try {
      // Verify the token structure
      this.jwtService.verify(token, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
      });
    } catch (error) {
      throw new BadRequestException('Invalid verification token');
    }

    // Get verification data from Redis
    const verificationData = await this.redisService.get(
      `email_verification:${token}`,
    );

    if (!verificationData) {
      throw new BadRequestException('Verification token expired or invalid');
    }

    const { userId, email } = JSON.parse(verificationData);

    // Find and update user
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.email !== email) {
      throw new BadRequestException('Invalid verification token');
    }

    if (user.status === UserStatus.ACTIVE) {
      return {
        statusCode: 200,
        message: 'Email already verified',
        data: { verified: true },
      };
    }

    // Update user status to ACTIVE
    await this.usersService.update(userId, { status: UserStatus.ACTIVE });

    // Delete verification token from Redis
    await this.redisService.del(`email_verification:${token}`);

    // Send welcome email after successful verification
    try {
      await this.emailService.sendWelcomeEmail(
        user.email,
        `${user.firstName} ${user.lastName}`,
      );
    } catch (error) {
      console.error('Failed to send welcome email:', error);
    }

    return {
      statusCode: 200,
      message: 'Email verified successfully',
      data: { verified: true },
    };
  }

  private async resendVerificationEmail(user: any) {
    // Generate new verification token
    const verificationToken = await this.jwtService.signAsync(
      { userId: user._id, type: 'email_verification' },
      {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
        expiresIn: '24h',
      },
    );

    // Store in Redis (overwrite existing if any)
    await this.redisService.set(
      `email_verification:${verificationToken}`,
      JSON.stringify({
        userId: (user._id as string).toString(),
        email: user.email,
      }),
      24 * 60 * 60, // 24 hours
    );

    // Send verification email
    try {
      await this.emailService.sendEmailVerification(
        user.email,
        `${user.firstName} ${user.lastName}`,
        verificationToken,
      );
    } catch (error) {
      console.error('Failed to resend verification email:', error);
    }
  }

  private async generateTokens(user: UserDocument | any) {
    const payload = { email: user.email, sub: user._id };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_ACCESS_SECRET'),
        expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN') || '15m',
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d',
      }),
    ]);

    return {
      accessToken,
      refreshToken,
    };
  }
}
