import { Injectable } from '@nestjs/common';
import { UserRole } from '../enums/user-role.enum';
import { IUserStrategy } from '../strategies/user-strategy.interface';
import { AdminUserStrategy } from '../strategies/admin-user.strategy';
import { SellerUserStrategy } from '../strategies/seller-user.strategy';
import { CustomerUserStrategy } from '../strategies/customer-user.strategy';

@Injectable()
export class UserStrategyFactory {
  constructor(
    private readonly adminStrategy: AdminUserStrategy,
    private readonly sellerStrategy: SellerUserStrategy,
    private readonly customerStrategy: CustomerUserStrategy,
  ) {}

  createStrategy(role: UserRole): IUserStrategy {
    switch (role) {
      case UserRole.ADMIN:
        return this.adminStrategy;
      case UserRole.SELLER:
        return this.sellerStrategy;
      case UserRole.CUSTOMER:
        return this.customerStrategy;
      default:
        throw new Error(`Unsupported user role: ${role}`);
    }
  }

  getAllStrategies(): IUserStrategy[] {
    return [this.adminStrategy, this.sellerStrategy, this.customerStrategy];
  }
}
