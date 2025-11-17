import { Injectable, BadRequestException } from '@nestjs/common';
import { IUserStrategy } from './user-strategy.interface';
import { UserRole } from '../enums/user-role.enum';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { UserDocument } from '../entities/user.entity';

@Injectable()
export class CustomerUserStrategy implements IUserStrategy {
  getRole(): UserRole {
    return UserRole.CUSTOMER;
  }

  async validateCreationData(userData: CreateUserDto): Promise<void> {
    // Customer-specific validation (minimal requirements)
    // Phone is optional for customers
    if (userData.phone) {
      const phoneRegex = /^[+]?[1-9]\d{1,14}$/;
      if (!phoneRegex.test(userData.phone)) {
        throw new BadRequestException('Invalid phone number format');
      }
    }
  }

  async processCreationData(
    userData: CreateUserDto,
  ): Promise<Partial<UserDocument>> {
    return {
      ...userData,
      role: UserRole.CUSTOMER,
      roleData: {
        preferences: userData.roleData?.preferences || {},
        shippingAddresses: [],
        wishlist: [],
      },
    };
  }

  async validateUpdateData(
    userData: UpdateUserDto,
    currentUser: UserDocument,
  ): Promise<void> {
    // Customers can upgrade to seller but need approval
    if (userData.role && userData.role === UserRole.SELLER) {
      // This would trigger a seller application process
      // For now, we'll allow it but mark as pending verification
    } else if (userData.role && userData.role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot upgrade to Admin role');
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
