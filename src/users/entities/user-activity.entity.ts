import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { User } from './user.entity';
import { UserActivityAction } from '../enums/user-activity-action.enum';

export type UserActivityDocument = UserActivity & Document;

@Schema({ timestamps: { createdAt: true, updatedAt: false } })
export class UserActivity {
  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  user: Types.ObjectId;

  @Prop({
    type: String,
    enum: UserActivityAction,
    required: true,
  })
  action: UserActivityAction;

  @Prop({ type: Types.ObjectId, ref: User.name })
  performedBy?: Types.ObjectId;

  @Prop({ type: Object, default: {} })
  metadata?: Record<string, any>;

  @Prop()
  description?: string;

  @Prop()
  ipAddress?: string;

  @Prop()
  device?: string;

  createdAt?: Date;
}

export const UserActivitySchema = SchemaFactory.createForClass(UserActivity);
