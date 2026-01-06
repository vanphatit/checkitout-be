import { Injectable, BadRequestException } from '@nestjs/common';
import { IUserStrategy } from './user-strategy.interface';
import { UserRole } from '../enums/user-role.enum';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { UserDocument } from '../entities/user.entity';
import { PHONE_REGEX } from 'src/auth/constants/validation.constants';

@Injectable()
export class AdminUserStrategy implements IUserStrategy {
  getRole(): UserRole {
    return UserRole.ADMIN;
  }

  validateCreationData(userData: CreateUserDto): Promise<void> {
    // Admin-specific validation
    if (!userData.phone) {
      throw new BadRequestException('Phone number is required for Admin users');
    }

    // Validate phone format
    if (!PHONE_REGEX.test(userData.phone)) {
      throw new BadRequestException('Invalid phone number format');
    }
    return Promise.resolve();
  }

  processCreationData(userData: CreateUserDto): Promise<Partial<UserDocument>> {
    return Promise.resolve({
      ...userData,
      role: UserRole.ADMIN,
    });
  }

  validateUpdateData(userData: UpdateUserDto): Promise<void> {
    // Admin can update most fields but with restrictions
    if (userData.role && userData.role !== UserRole.ADMIN) {
      throw new BadRequestException(
        'Cannot change role from Admin to another role',
      );
    }
    return Promise.resolve();
  }

  processUpdateData(userData: UpdateUserDto): Promise<Partial<UserDocument>> {
    return Promise.resolve({ ...userData });
  }
}
