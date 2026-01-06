import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  private readonly logger = new Logger(GoogleStrategy.name);

  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const clientID = configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET');
    const callbackURL = configService.get<string>('GOOGLE_CALLBACK_URL');

    // Log configuration status (without sensitive data)
    const isConfigured = !!(clientID && clientSecret && callbackURL);
    Logger.log(`Google OAuth configured: ${isConfigured}`, 'GoogleStrategy');

    if (!clientID) {
      throw new Error(
        'GOOGLE_CLIENT_ID is not configured in environment variables',
      );
    }
    if (!clientSecret) {
      throw new Error(
        'GOOGLE_CLIENT_SECRET is not configured in environment variables',
      );
    }
    if (!callbackURL) {
      throw new Error(
        'GOOGLE_CALLBACK_URL is not configured in environment variables',
      );
    }

    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<any> {
    try {
      this.logger.log(
        `Validating Google profile for user: ${profile.emails?.[0]?.value}`,
      );

      const { id, name, emails, photos } = profile;

      // Validate that we received an email from Google
      if (!emails || !emails[0]?.value) {
        this.logger.error('Email not provided by Google');
        throw new UnauthorizedException('Email not provided by Google');
      }

      // Extract Google profile data
      const googleProfile = {
        googleId: id,
        email: emails[0].value,
        firstName: name?.givenName || '',
        lastName: name?.familyName || '',
        avatarUrl: photos && photos[0]?.value,
        accessToken, // Google access token (store if needed for API calls)
      };

      // Delegate to auth service for user creation/retrieval
      const user = await this.authService.validateOAuthUser(googleProfile);

      this.logger.log(
        `Google OAuth validation successful for: ${googleProfile.email}`,
      );
      done(null, user);
    } catch (error) {
      this.logger.error(
        `Google OAuth validation failed: ${error.message}`,
        error.stack,
      );
      done(error, false);
    }
  }
}
