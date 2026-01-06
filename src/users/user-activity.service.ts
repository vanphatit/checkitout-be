import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  UserActivity,
  UserActivityDocument,
} from './entities/user-activity.entity';
import { LogUserActivityDto } from './dto/user-activity.dto';
import { UserActivityAction } from './enums/user-activity-action.enum';

export interface ActivityLogOptions {
  performedBy?: string;
  metadata?: Record<string, any>;
  description?: string;
  ipAddress?: string;
  device?: string;
}

@Injectable()
export class UserActivityService {
  constructor(
    @InjectModel(UserActivity.name)
    private readonly userActivityModel: Model<UserActivityDocument>,
  ) {}

  async logActivity(log: LogUserActivityDto): Promise<UserActivityDocument> {
    const activity = new this.userActivityModel({
      user: log.userId,
      action: log.action,
      performedBy: log.performedBy,
      metadata: log.metadata || {},
      description: log.description,
      ipAddress: log.ipAddress,
      device: log.device,
    });

    return activity.save();
  }

  async logUserActivity(
    userId: string,
    action: UserActivityAction,
    options: ActivityLogOptions = {},
  ): Promise<UserActivityDocument> {
    return this.logActivity({
      userId,
      action,
      performedBy: options.performedBy,
      metadata: options.metadata,
      description: options.description,
      ipAddress: options.ipAddress,
      device: options.device,
    });
  }

  async getActivitiesForUser(
    userId: string,
    limit = 50,
  ): Promise<UserActivityDocument[]> {
    return this.userActivityModel
      .find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }

  async getRecentActivities(limit = 100): Promise<UserActivityDocument[]> {
    return this.userActivityModel
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
  }
}
