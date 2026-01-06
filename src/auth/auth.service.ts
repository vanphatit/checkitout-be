import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
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
  ChangePasswordDto,
  CompleteRegistrationDto,
} from './dto/auth.dto';
import { RedisService } from '../modules/redis/redis.service';
import { EmailService } from '../modules/email/email.service';
import { UserDocument, UserStatus } from '../users';
import { UserResponseDto } from '../users/dto/user.dto';
import { UserActivityAction } from '../users/enums/user-activity-action.enum';
import * as crypto from 'crypto';
import * as bcrypt from 'bcryptjs';
import type { Request } from 'express';
import { normalizeEmail } from '../common/utils/string-normalizer.util';

const BCRYPT_SALT_ROUNDS = 12;

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private redisService: RedisService,
    private emailService: EmailService,
  ) {}

  async validateUser(
    identifier: string,
    password: string,
    isPhone = false,
  ): Promise<Omit<UserDocument, 'password'> | null> {
    // Find user by email or phone
    const normalizedIdentifier = isPhone
      ? identifier
      : normalizeEmail(identifier);
    const user = isPhone
      ? await this.usersService.findByPhone(normalizedIdentifier)
      : await this.usersService.findByEmail(normalizedIdentifier);

    if (!user) {
      return null;
    }

    // PRE_REGISTERED users don't have passwords yet
    if (user.status === UserStatus.PRE_REGISTERED) {
      return null;
    }

    // Validate password
    if (
      user.password &&
      (await this.usersService.validatePassword(password, user.password))
    ) {
      const { password: _, ...result } = user.toObject();
      return result as Omit<UserDocument, 'password'>;
    }

    return null;
  }

  async login(loginDto: LoginDto, request?: Request) {
    // Validate at least one identifier provided
    if (!loginDto.email && !loginDto.phone) {
      throw new UnauthorizedException('Email or phone is required');
    }

    // Determine if login is by phone or email
    const identifier = loginDto.phone || loginDto.email;
    const isPhone = !!loginDto.phone;
    const normalizedIdentifier = isPhone
      ? identifier!
      : normalizeEmail(identifier!);

    // Check for PRE_REGISTERED user first
    let preRegUser;
    if (isPhone) {
      preRegUser = await this.usersService.findByPhone(normalizedIdentifier);
    } else {
      preRegUser = await this.usersService.findByEmail(normalizedIdentifier);
    }

    if (preRegUser && preRegUser.status === UserStatus.PRE_REGISTERED) {
      throw new UnauthorizedException(
        'Please complete your registration by providing email and password. Your account was created automatically when a ticket was booked for you.',
      );
    }

    // Validate user credentials
    const user = await this.validateUser(
      normalizedIdentifier,
      loginDto.password,
      isPhone,
    );
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

    const tokens = await this.generateTokens(user as UserDocument);

    const ipAddress = this.getClientIp(request);
    const userAgent = request?.headers['user-agent'];
    const userId = (user._id as any).toString();

    await this.usersService.recordSuccessfulLogin(userId, {
      ipAddress,
      device: userAgent,
    });

    // Store refresh token in Redis
    await this.redisService.setWithExpiry(
      `refresh_token:${userId}`,
      tokens.refreshToken,
      7 * 24 * 60 * 60, // 7 days
    );

    const freshUser = await this.usersService.findById(userId);

    if (!freshUser) {
      throw new NotFoundException('User not found');
    }

    return {
      user: this.usersService.toResponseDto(freshUser),
      ...tokens,
    };
  }

  async register(registerDto: RegisterDto) {
    const normalizedEmail = normalizeEmail(registerDto.email);

    // Ensure phone is provided for registration
    if (!registerDto.phone) {
      throw new BadRequestException(
        'Phone number is required for registration',
      );
    }

    // Check if user with this phone already exists
    const existingPhoneUser = await this.usersService.findByPhone(
      registerDto.phone,
    );

    // If phone exists with PRE_REGISTERED status, complete their registration
    if (
      existingPhoneUser &&
      existingPhoneUser.status === UserStatus.PRE_REGISTERED
    ) {
      // Check if email is already in use by another user
      const existingEmailUser =
        await this.usersService.findByEmail(normalizedEmail);
      if (existingEmailUser) {
        throw new ConflictException(
          'Email is already in use by another account',
        );
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(
        registerDto.password,
        BCRYPT_SALT_ROUNDS,
      );

      // Update PRE_REGISTERED user with email, password, and change status to ACTIVE
      const userId = this.getUserId(existingPhoneUser);
      await this.usersService.updateWithPassword(
        userId,
        {
          email: normalizedEmail,
          password: hashedPassword,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          status: UserStatus.ACTIVE,
          emailVerifiedAt: new Date(), // Auto-verify email for completed pre-registrations
        },
        {
          actorId: userId,
          activityAction: UserActivityAction.PROFILE_UPDATED,
          description: 'User completed pre-registration via register endpoint',
        },
      );

      return {
        message:
          'Registration completed successfully. You can now login with your email and password.',
        data: {
          phone: existingPhoneUser.phone,
          email: normalizedEmail,
          firstName: registerDto.firstName,
          lastName: registerDto.lastName,
          role: existingPhoneUser.role,
          status: 'ACTIVE',
        },
      };
    }

    // If phone exists but NOT PRE_REGISTERED, reject
    if (existingPhoneUser) {
      throw new ConflictException('Phone number is already registered');
    }

    // Check if email is already in use
    const existingEmailUser =
      await this.usersService.findByEmail(normalizedEmail);
    if (existingEmailUser) {
      throw new ConflictException('Email already exists');
    }

    // Create new user (normal registration flow)
    // Hash password before creating user
    const hashedPassword = await bcrypt.hash(
      registerDto.password,
      BCRYPT_SALT_ROUNDS,
    );
    const userData: any = {
      email: normalizedEmail,
      password: hashedPassword,
      firstName: registerDto.firstName,
      lastName: registerDto.lastName,
      phone: registerDto.phone,
      role: registerDto.role,
    };

    const user = await this.usersService.create(userData);

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
        email: normalizedEmail,
      }),
      24 * 60 * 60, // 24 hours
    );

    // Send verification email
    if (user.email) {
      try {
        await this.emailService.sendEmailVerification(
          user.email,
          `${user.firstName} ${user.lastName}`,
          verificationToken,
        );
      } catch (error) {
        console.error('Failed to send verification email:', error);
      }
    }

    return {
      message:
        'User registered successfully. Please check your email to verify your account.',
      data: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
    };
  }

  async completeRegistration(completeRegistrationDto: CompleteRegistrationDto) {
    // Find user by phone with PRE_REGISTERED status
    const user = await this.usersService.findByPhone(
      completeRegistrationDto.phone,
    );

    if (!user) {
      throw new NotFoundException('User not found with this phone number');
    }

    if (user.status !== UserStatus.PRE_REGISTERED) {
      throw new BadRequestException(
        'This account has already been registered. Please login with your credentials.',
      );
    }

    // Normalize and check if email is already in use by another user
    const normalizedEmail = normalizeEmail(completeRegistrationDto.email);
    const existingEmailUser =
      await this.usersService.findByEmail(normalizedEmail);
    if (existingEmailUser) {
      throw new ConflictException('Email is already in use by another account');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(
      completeRegistrationDto.password,
      BCRYPT_SALT_ROUNDS,
    );

    // Update user with email, password, and change status to ACTIVE
    const userId = this.getUserId(user);
    await this.usersService.updateWithPassword(
      userId,
      {
        email: normalizedEmail,
        password: hashedPassword,
        status: UserStatus.ACTIVE,
        emailVerifiedAt: new Date(), // Auto-verify email for completed pre-registrations
      },
      {
        actorId: userId,
        activityAction: UserActivityAction.PROFILE_UPDATED,
        description: 'User completed pre-registration',
      },
    );

    return {
      message:
        'Registration completed successfully. You can now login with your email and password.',
      data: {
        phone: user.phone,
        email: normalizedEmail,
        firstName: user.firstName,
        lastName: user.lastName,
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

  async changePassword(userId: string, changePasswordDto: ChangePasswordDto) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException(
        'User does not have a password set. Please complete registration first.',
      );
    }

    const isCurrentValid = await this.usersService.validatePassword(
      changePasswordDto.currentPassword,
      user.password,
    );

    if (!isCurrentValid) {
      throw new BadRequestException('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(
      changePasswordDto.newPassword,
      BCRYPT_SALT_ROUNDS,
    );

    await this.usersService.updateWithPassword(
      userId,
      { password: hashedPassword },
      {
        actorId: userId,
        activityAction: UserActivityAction.PASSWORD_CHANGED,
        description: 'User changed their password',
      },
    );

    // Invalidate refresh token to force re-login
    await this.redisService.del(`refresh_token:${userId}`);

    return { message: 'Password updated successfully' };
  }

  async forgotPassword(forgotPasswordDto: ForgotPasswordDto) {
    const normalizedEmail = normalizeEmail(forgotPasswordDto.email);
    const user = await this.usersService.findByEmail(normalizedEmail);
    if (!user || !user.email) {
      // Don't reveal if user exists or not
      return { message: 'If the email exists, a reset link has been sent' };
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');

    // Store reset token in Redis with 15 minutes expiry
    await this.redisService.setWithExpiry(
      `reset_token:${resetToken}`,
      this.getUserId(user),
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
    const hashedPassword = await bcrypt.hash(
      resetPasswordDto.newPassword,
      BCRYPT_SALT_ROUNDS,
    );

    // Update password using internal method that accepts password field
    await this.usersService.updateWithPassword(
      userId,
      {
        password: hashedPassword,
      },
      {
        actorId: userId,
        activityAction: UserActivityAction.PASSWORD_RESET,
        description: 'Password reset via recovery flow',
      },
    );

    // Remove reset token from Redis
    await this.redisService.del(`reset_token:${resetPasswordDto.token}`);

    // Invalidate all refresh tokens for this user
    await this.redisService.del(`refresh_token:${userId}`);

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
    await this.usersService.update(
      userId,
      { status: UserStatus.ACTIVE },
      { actorId: userId },
    );
    await this.usersService.setEmailVerifiedTimestamp(userId);

    // Delete verification token from Redis
    await this.redisService.del(`email_verification:${token}`);

    // Send welcome email after successful verification
    if (user.email) {
      try {
        await this.emailService.sendWelcomeEmail(
          user.email,
          `${user.firstName} ${user.lastName}`,
        );
      } catch (error) {
        console.error('Failed to send welcome email:', error);
      }
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

  private async generateTokens(user: UserDocument) {
    const payload = {
      email: user.email,
      phone: user.phone,
      sub: user._id,
      role: user.role,
    };

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

  async getCurrentUser(userId: string): Promise<UserResponseDto> {
    const user = await this.usersService.findById(userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('User not found or inactive');
    }

    return this.usersService.toResponseDto(user);
  }

  async validateOAuthUser(oauthProfile: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string;
    accessToken?: string;
  }): Promise<UserDocument | { needsCompletion: true; token: string }> {
    const normalizedEmail = normalizeEmail(oauthProfile.email);

    // Step 1: Check if user exists by googleId
    let user = await this.usersService.findByGoogleId(oauthProfile.googleId);

    if (user) {
      // Existing OAuth user - return user
      return user;
    }

    // Step 2: Check if user exists by email
    user = await this.usersService.findByEmail(normalizedEmail);

    if (user) {
      // Account linking scenario
      if (user.status === UserStatus.PRE_REGISTERED) {
        // Upgrade PRE_REGISTERED user to OAuth user
        return await this.usersService.linkOAuthProvider(this.getUserId(user), {
          googleId: oauthProfile.googleId,
          authProvider: 'google',
          isOAuthUser: true,
          status: UserStatus.ACTIVE,
          email: normalizedEmail,
          emailVerifiedAt: new Date(), // Google verifies emails
          avatarUrl: oauthProfile.avatarUrl,
        });
      } else if (user.password) {
        // User has password-based account - link OAuth
        // Only link if email is verified on existing account
        if (!user.emailVerifiedAt) {
          throw new UnauthorizedException(
            'Please verify your email before linking OAuth providers',
          );
        }

        return await this.usersService.linkOAuthProvider(this.getUserId(user), {
          googleId: oauthProfile.googleId,
          authProvider: 'google',
          isOAuthUser: true,
          avatarUrl: oauthProfile.avatarUrl || user.avatarUrl,
        });
      } else {
        // User exists but no password - likely another OAuth provider
        return await this.usersService.linkOAuthProvider(this.getUserId(user), {
          googleId: oauthProfile.googleId,
          authProvider: 'google',
          isOAuthUser: true,
          avatarUrl: oauthProfile.avatarUrl || user.avatarUrl,
        });
      }
    }

    // Step 3: New user - needs to complete registration with phone
    // Store OAuth data in Redis for 15 minutes
    const completionToken = crypto.randomBytes(32).toString('hex');
    const oauthDataKey = `oauth_completion:${completionToken}`;

    await this.redisService.set(
      oauthDataKey,
      JSON.stringify({
        googleId: oauthProfile.googleId,
        email: normalizedEmail,
        firstName: oauthProfile.firstName,
        lastName: oauthProfile.lastName,
        avatarUrl: oauthProfile.avatarUrl,
        provider: 'google',
      }),
      900, // 15 minutes TTL
    );

    // Return special response indicating completion needed
    return {
      needsCompletion: true,
      token: completionToken,
    };
  }

  async completeOAuthRegistration(
    completionToken: string,
    phone: string,
    password?: string,
  ) {
    // Retrieve OAuth data from Redis
    const oauthDataKey = `oauth_completion:${completionToken}`;
    const oauthDataStr = await this.redisService.get(oauthDataKey);

    if (!oauthDataStr) {
      throw new BadRequestException(
        'Invalid or expired OAuth completion token. Please sign in with Google again.',
      );
    }

    const oauthData = JSON.parse(oauthDataStr);

    // Check if phone is already in use
    const existingUserWithPhone = await this.usersService.findByPhone(phone);
    if (existingUserWithPhone) {
      throw new ConflictException('Phone number is already registered');
    }

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (password) {
      hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    }

    // Create user with OAuth data + phone
    const newUser = await this.usersService.create({
      email: oauthData.email,
      firstName: oauthData.firstName,
      lastName: oauthData.lastName,
      phone: phone,
      password: hashedPassword, // Optional password
      googleId: oauthData.googleId,
      authProvider: oauthData.provider,
      isOAuthUser: true,
      isPhoneVerified: false,
      status: UserStatus.ACTIVE, // OAuth users are auto-active (email verified by Google)
      emailVerifiedAt: new Date(), // Google verifies emails
      avatarUrl: oauthData.avatarUrl,
      role: 'CUSTOMER' as any,
    } as any);

    // Delete the completion token
    await this.redisService.del(oauthDataKey);

    return newUser;
  }

  async oauthLogin(user: UserDocument, request?: Request) {
    // Check user status (same as regular login)
    if (user.status === UserStatus.INACTIVE) {
      throw new UnauthorizedException(
        'Account has been deactivated. Please contact support.',
      );
    }

    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Account is not active');
    }

    // Generate same tokens as regular login
    const tokens = await this.generateTokens(user);

    // Record login (same as regular login)
    const ipAddress = this.getClientIp(request);
    const userAgent = request?.headers['user-agent'];
    const userId = this.getUserId(user);

    await this.usersService.recordSuccessfulLogin(userId, {
      ipAddress,
      device: userAgent,
    });

    // Store refresh token in Redis (same as regular login)
    await this.redisService.setWithExpiry(
      `refresh_token:${userId}`,
      tokens.refreshToken,
      7 * 24 * 60 * 60, // 7 days
    );

    // Fetch fresh user data (same as regular login)
    const freshUser = await this.usersService.findById(userId);

    if (!freshUser) {
      throw new NotFoundException('User not found');
    }

    // Return IDENTICAL response structure to regular login
    return {
      user: this.usersService.toResponseDto(freshUser),
      ...tokens,
    };
  }

  private getClientIp(request?: Request): string | undefined {
    if (!request) {
      return undefined;
    }

    const forwardedFor = request.headers['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.length > 0) {
      return forwardedFor.split(',')[0].trim();
    }

    if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
      return forwardedFor[0];
    }

    return request.ip;
  }

  private getUserId(user: UserDocument): string {
    return (user._id as any).toString();
  }
}
