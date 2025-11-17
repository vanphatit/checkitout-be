import { Injectable, BadRequestException } from '@nestjs/common';
import { IUserStrategy } from './user-strategy.interface';
import { UserRole } from '../enums/user-role.enum';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { UserDocument } from '../entities/user.entity';

@Injectable()
export class SellerUserStrategy implements IUserStrategy {
  getRole(): UserRole {
    return UserRole.SELLER;
  }

  async validateCreationData(userData: CreateUserDto): Promise<void> {
    // Seller-specific validation
    if (!userData.phone) {
      throw new BadRequestException(
        'Phone number is required for Seller accounts',
      );
    }

    // Validate business information if provided
    if (
      userData.roleData?.businessName &&
      userData.roleData.businessName.length < 3
    ) {
      throw new BadRequestException(
        'Business name must be at least 3 characters',
      );
    }
  }

  async processCreationData(
    userData: CreateUserDto,
  ): Promise<Partial<UserDocument>> {
    return {
      ...userData,
      role: UserRole.SELLER,
      roleData: {
        businessName: userData.roleData?.businessName || '',
        businessType: userData.roleData?.businessType || 'Individual',
        verificationStatus: 'PENDING',
        storeSetup: false,
      },
    };
  }

  async validateUpdateData(
    userData: UpdateUserDto,
    currentUser: UserDocument,
  ): Promise<void> {
    // Sellers can update their business info but not change to other roles without admin approval
    if (userData.role && userData.role !== UserRole.SELLER) {
      throw new BadRequestException(
        'Cannot change role without admin approval',
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
