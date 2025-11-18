import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { User, UserDocument } from './entities/user.entity';
import { UserActivityDocument } from './entities/user-activity.entity';
import { UserStatus } from './enums/user-status.enum';
import { UserRole } from './enums/user-role.enum';
import { CreateUserDto, UpdateUserDto, UserResponseDto } from './dto/user.dto';
import { GetUsersQueryDto } from './dto/get-users-query.dto';
import { UserStrategyFactory } from './factories/user-strategy.factory';
import { UserActivityService } from './user-activity.service';
import { UserActivityAction } from './enums/user-activity-action.enum';
import * as bcrypt from 'bcryptjs';

interface UserOperationOptions {
  actorId?: string;
  description?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  device?: string;
}

interface PaginatedUsersResult {
  items: UserDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly userStrategyFactory: UserStrategyFactory,
    private readonly userActivityService: UserActivityService,
  ) {}

  toResponseDto(user: UserDocument): UserResponseDto {
    return {
      id: (user._id as any).toString(),
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt,
      lastLoginAt: user.lastLoginAt,
      lastLoginIp: user.lastLoginIp,
      createdAt: user.createdAt!,
      updatedAt: user.updatedAt!,
    };
  }

  private async logActivity(
    userId: string,
    action: UserActivityAction,
    options?: UserOperationOptions,
  ) {
    await this.userActivityService.logActivity({
      userId,
      action,
      performedBy: options?.actorId,
      metadata: options?.metadata,
      description: options?.description,
      ipAddress: options?.ipAddress,
      device: options?.device,
    });
  }

  async create(
    userData: CreateUserDto,
    options?: UserOperationOptions,
  ): Promise<UserDocument> {
    // Check if user already exists
    const existingUser = await this.userModel.findOne({
      email: userData.email,
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    // Check phone uniqueness if provided
    if (userData.phone) {
      const existingPhone = await this.userModel.findOne({
        phone: userData.phone,
      });
      if (existingPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }

    // Use Strategy Pattern for role-specific creation
    const role = userData.role || UserRole.CUSTOMER;
    const strategy = this.userStrategyFactory.createStrategy(role);

    // Validate role-specific data
    await strategy.validateCreationData(userData);

    // Process role-specific data
    const processedData = await strategy.processCreationData(userData);

    if (
      processedData.status === UserStatus.ACTIVE &&
      !processedData.emailVerifiedAt
    ) {
      (processedData as Partial<UserDocument>).emailVerifiedAt = new Date();
    }

    const createdUser = new this.userModel(processedData);
    const savedUser = await createdUser.save();

    const actorId = options?.actorId || (savedUser._id as any).toString();

    await this.logActivity(
      (savedUser._id as any).toString(),
      UserActivityAction.ACCOUNT_CREATED,
      {
        actorId,
        description:
          actorId === (savedUser._id as any).toString()
            ? 'User registered an account'
            : 'Admin created a user account',
        metadata: {
          email: savedUser.email,
          role: savedUser.role,
          status: savedUser.status,
        },
      },
    );

    return savedUser;
  }

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ email }).exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByPhone(phone: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ phone }).exec();
  }

  async updateStatus(
    id: string,
    status: UserStatus,
    options?: UserOperationOptions,
  ): Promise<UserDocument> {
    const existingUser = await this.findById(id);
    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    if (existingUser.status === status) {
      return existingUser;
    }

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .exec();

    if (status === UserStatus.ACTIVE && !existingUser.emailVerifiedAt) {
      await this.setEmailVerifiedTimestamp(id);
    }

    await this.logActivity(id, UserActivityAction.STATUS_CHANGED, {
      actorId: options?.actorId,
      description: `Status updated to ${status}`,
      metadata: {
        previousStatus: existingUser.status,
        newStatus: status,
      },
    });

    return updatedUser!;
  }

  async update(
    id: string,
    updateData: UpdateUserDto,
    options?: UserOperationOptions,
  ): Promise<UserDocument> {
    const currentUser = await this.findById(id);
    if (!currentUser) {
      throw new NotFoundException('User not found');
    }

    // Check phone uniqueness if being updated
    if (updateData.phone && updateData.phone !== currentUser.phone) {
      const existingPhone = await this.userModel.findOne({
        phone: updateData.phone,
        _id: { $ne: id },
      });
      if (existingPhone) {
        throw new ConflictException('Phone number already exists');
      }
    }

    // Use Strategy Pattern for role-specific updates
    const role = updateData.role || currentUser.role;
    const strategy = this.userStrategyFactory.createStrategy(role);

    // Validate role-specific update data
    await strategy.validateUpdateData(updateData, currentUser);

    // Process role-specific update data
    const processedData = await strategy.processUpdateData(
      updateData,
      currentUser,
    );

    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, processedData, { new: true })
      .exec();

    const actorId = options?.actorId;
    const updatedFields = Object.keys(updateData);
    const baseAction =
      actorId && actorId === id
        ? UserActivityAction.PROFILE_UPDATED
        : UserActivityAction.USER_UPDATED;
    const description =
      actorId && actorId === id
        ? 'User updated their profile'
        : 'User updated by administrator';

    await this.logActivity(id, baseAction, {
      actorId,
      description,
      metadata: {
        updatedFields,
      },
    });

    if (updateData.role && updateData.role !== currentUser.role) {
      await this.logActivity(id, UserActivityAction.ROLE_CHANGED, {
        actorId,
        description: `Role updated to ${updateData.role}`,
        metadata: {
          previousRole: currentUser.role,
          newRole: updateData.role,
        },
      });
    }

    if (updateData.status && updateData.status !== currentUser.status) {
      await this.logActivity(id, UserActivityAction.STATUS_CHANGED, {
        actorId,
        description: `Status updated to ${updateData.status}`,
        metadata: {
          previousStatus: currentUser.status,
          newStatus: updateData.status,
        },
      });

      if (updateData.status === UserStatus.ACTIVE && !currentUser.emailVerifiedAt) {
        await this.setEmailVerifiedTimestamp(id);
      }
    }

    return updatedUser!;
  }

  async delete(id: string, options?: UserOperationOptions): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('User not found');
    }

    await this.logActivity(id, UserActivityAction.USER_DELETED, {
      actorId: options?.actorId,
      description: 'User account deleted',
      metadata: {
        email: result.email,
        role: result.role,
      },
    });
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  async findAllPaginated(
    query: GetUsersQueryDto,
  ): Promise<PaginatedUsersResult> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const skip = (page - 1) * limit;

    const filter: FilterQuery<UserDocument> = {};

    if (query.role) {
      filter.role = query.role;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search) {
      const regex = new RegExp(query.search, 'i');
      filter.$or = [
        { email: regex },
        { firstName: regex },
        { lastName: regex },
        { phone: regex },
      ];
    }

    const [items, total] = await Promise.all([
      this.userModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.userModel.countDocuments(filter).exec(),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return {
      items,
      total,
      page,
      limit,
      totalPages,
    };
  }

  async findByRole(role: UserRole): Promise<UserDocument[]> {
    return this.userModel.find({ role }).exec();
  }

  async getUsersByStatus(status: UserStatus): Promise<UserDocument[]> {
    return this.userModel.find({ status }).exec();
  }

  async getUserActivities(
    userId: string,
    limit = 50,
  ): Promise<UserActivityDocument[]> {
    return this.userActivityService.getActivitiesForUser(userId, limit);
  }

  async setEmailVerifiedTimestamp(
    id: string,
    timestamp = new Date(),
  ): Promise<UserDocument> {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(
        id,
        { emailVerifiedAt: timestamp },
        { new: true },
      )
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return updatedUser;
  }

  async recordSuccessfulLogin(
    id: string,
    context?: { ipAddress?: string; device?: string },
  ): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(
        id,
        {
          lastLoginAt: new Date(),
          lastLoginIp: context?.ipAddress,
        },
        { new: true },
      )
      .exec();

    await this.logActivity(id, UserActivityAction.LOGIN_SUCCESS, {
      actorId: id,
      description: 'User logged in successfully',
      ipAddress: context?.ipAddress,
      device: context?.device,
    });
  }

  async validatePassword(
    plainPassword: string,
    hashedPassword: string,
  ): Promise<boolean> {
    return bcrypt.compare(plainPassword, hashedPassword);
  }

  // Internal method for password updates (used by auth service)
  async updateWithPassword(
    id: string,
    data: { password?: string; [key: string]: any },
    options?: UserOperationOptions & { activityAction?: UserActivityAction },
  ): Promise<UserDocument> {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    if (options?.activityAction) {
      await this.logActivity(id, options.activityAction, {
        actorId: options.actorId,
        description: options.description,
        ipAddress: options.ipAddress,
        device: options.device,
        metadata: options.metadata,
      });
    }

    return updatedUser;
  }
}
