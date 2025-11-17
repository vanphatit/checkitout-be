import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from './entities/user.entity';
import { UserStatus } from './enums/user-status.enum';
import { UserRole } from './enums/user-role.enum';
import { CreateUserDto, UpdateUserDto } from './dto/user.dto';
import { UserStrategyFactory } from './factories/user-strategy.factory';
import * as bcrypt from 'bcryptjs';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly userStrategyFactory: UserStrategyFactory,
  ) {}

  async create(userData: CreateUserDto): Promise<UserDocument> {
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

    const createdUser = new this.userModel(processedData);
    return createdUser.save();
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

  async updateStatus(id: string, status: UserStatus): Promise<UserDocument> {
    const user = await this.userModel
      .findByIdAndUpdate(id, { status }, { new: true })
      .exec();

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  async update(id: string, updateData: UpdateUserDto): Promise<UserDocument> {
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

    return updatedUser!;
  }

  async delete(id: string): Promise<void> {
    const result = await this.userModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException('User not found');
    }
  }

  async findAll(): Promise<UserDocument[]> {
    return this.userModel.find().exec();
  }

  async findByRole(role: UserRole): Promise<UserDocument[]> {
    return this.userModel.find({ role }).exec();
  }

  async getUsersByStatus(status: UserStatus): Promise<UserDocument[]> {
    return this.userModel.find({ status }).exec();
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
  ): Promise<UserDocument> {
    const updatedUser = await this.userModel
      .findByIdAndUpdate(id, data, { new: true })
      .exec();

    if (!updatedUser) {
      throw new NotFoundException('User not found');
    }

    return updatedUser;
  }
}
