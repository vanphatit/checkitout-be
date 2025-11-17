import { Injectable, BadRequestException } from '@nestjs/common';
import { IUserStrategy } from './user-strategy.interface';
import { UserRole } from '../enums/user-role.enum';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { UserDocument } from '../entities/user.entity';

@Injectable()
export class AdminUserStrategy implements IUserStrategy {
  getRole(): UserRole {
    return UserRole.ADMIN;
  }

  async validateCreationData(userData: CreateUserDto): Promise<void> {
    // Admin-specific validation
    if (!userData.phone) {
      throw new BadRequestException('Phone number is required for Admin users');
    }

    // Validate phone format
    const phoneRegex = /^[+]?[1-9]\d{1,14}$/;
    if (!phoneRegex.test(userData.phone)) {
      throw new BadRequestException('Invalid phone number format');
    }
  }

  async processCreationData(
    userData: CreateUserDto,
  ): Promise<Partial<UserDocument>> {
    return {
      ...userData,
      role: UserRole.ADMIN,
      roleData: {
        department: userData.roleData?.department || 'General',
        accessLevel: 'FULL',
      },
    };
  }

  async validateUpdateData(
    userData: UpdateUserDto,
    currentUser: UserDocument,
  ): Promise<void> {
    // Admin can update most fields but with restrictions
    if (userData.role && userData.role !== UserRole.ADMIN) {
      throw new BadRequestException(
        'Cannot change role from Admin to another role',
      );
    }
  }

  async processUpdateData(
    userData: UpdateUserDto,
    currentUser: UserDocument,
  ): Promise<Partial<UserDocument>> {
    const updateData: Partial<UserDocument> = { ...userData };

    if (userData.roleData) {
      updateData.roleData = {
        ...currentUser.roleData,
        ...userData.roleData,
      };
    }

    return updateData;
  }
}
