import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User, UserSchema } from './entities/user.entity';
import {
  UserActivity,
  UserActivitySchema,
} from './entities/user-activity.entity';
import { UserStrategyFactory } from './factories/user-strategy.factory';
import { AdminUserStrategy } from './strategies/admin-user.strategy';
import { SellerUserStrategy } from './strategies/seller-user.strategy';
import { CustomerUserStrategy } from './strategies/customer-user.strategy';
import { UserActivityService } from './user-activity.service';
import { UserSeedService } from './user-seed.service';
import { CloudinaryService } from '../common/cloudinary/cloudinary.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserActivity.name, schema: UserActivitySchema },
    ]),
  ],
  controllers: [UsersController],
  providers: [
    UsersService,
    UserStrategyFactory,
    AdminUserStrategy,
    SellerUserStrategy,
    CustomerUserStrategy,
    UserActivityService,
    UserSeedService,
    CloudinaryService,
  ],
  exports: [UsersService, UserStrategyFactory, UserActivityService],
})
export class UsersModule {}
