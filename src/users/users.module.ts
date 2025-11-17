import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './entities/user.entity';
import { UserStrategyFactory } from './factories/user-strategy.factory';
import { AdminUserStrategy } from './strategies/admin-user.strategy';
import { SellerUserStrategy } from './strategies/seller-user.strategy';
import { CustomerUserStrategy } from './strategies/customer-user.strategy';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UserStrategyFactory,
    AdminUserStrategy,
    SellerUserStrategy,
    CustomerUserStrategy,
  ],
  exports: [UsersService, UserStrategyFactory],
})
export class UsersModule {}
