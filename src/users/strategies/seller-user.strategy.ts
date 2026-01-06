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

  validateCreationData(userData: CreateUserDto): Promise<void> {
    // Seller-specific validation
    if (!userData.phone) {
      throw new BadRequestException(
        'Phone number is required for Seller accounts',
      );
    }
    return Promise.resolve();
  }

  processCreationData(userData: CreateUserDto): Promise<Partial<UserDocument>> {
    return Promise.resolve({
      ...userData,
      role: UserRole.SELLER,
    });
  }

  validateUpdateData(userData: UpdateUserDto): Promise<void> {
    // Sellers can update their business info but not change to other roles without admin approval
    if (userData.role && userData.role !== UserRole.SELLER) {
      throw new BadRequestException(
        'Cannot change role without admin approval',
      );
    }
    return Promise.resolve();
  }

  processUpdateData(userData: UpdateUserDto): Promise<Partial<UserDocument>> {
    return Promise.resolve({ ...userData });
  }
}
