import { Injectable, BadRequestException } from '@nestjs/common';
import { IUserStrategy } from './user-strategy.interface';
import { UserRole } from '../enums/user-role.enum';
import { CreateUserDto, UpdateUserDto } from '../dto/user.dto';
import { UserDocument } from '../entities/user.entity';
import { PHONE_REGEX } from 'src/auth/constants/validation.constants';

@Injectable()
export class CustomerUserStrategy implements IUserStrategy {
  getRole(): UserRole {
    return UserRole.CUSTOMER;
  }

  validateCreationData(userData: CreateUserDto): Promise<void> {
    // Customer-specific validation (minimal requirements)
    // Phone is optional for customers
    if (userData.phone) {
      if (!PHONE_REGEX.test(userData.phone)) {
        throw new BadRequestException('Invalid phone number format');
      }
    }
    return Promise.resolve();
  }

  processCreationData(userData: CreateUserDto): Promise<Partial<UserDocument>> {
    return Promise.resolve({
      ...userData,
      role: UserRole.CUSTOMER,
    });
  }

  validateUpdateData(userData: UpdateUserDto): Promise<void> {
    // Customers can upgrade to seller but need approval
    if (userData.role && userData.role === UserRole.SELLER) {
      // This would trigger a seller application process
      // For now, we'll allow it but mark as pending verification
    } else if (userData.role && userData.role === UserRole.ADMIN) {
      throw new BadRequestException('Cannot upgrade to Admin role');
    }
    return Promise.resolve();
  }

  processUpdateData(userData: UpdateUserDto): Promise<Partial<UserDocument>> {
    return Promise.resolve({ ...userData });
  }
}
