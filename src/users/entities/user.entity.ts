import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { UserStatus } from '../enums/user-status.enum';
import { UserRole } from '../enums/user-role.enum';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: false, unique: true, sparse: true })
  email?: string;

  @Prop({ required: false })
  password?: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: false })
  lastName?: string;

  @Prop({ required: true, unique: true })
  phone: string;

  @Prop({
    type: String,
    enum: UserRole,
    default: UserRole.CUSTOMER,
  })
  role: UserRole;

  @Prop({
    type: String,
    enum: UserStatus,
    default: UserStatus.PENDING,
  })
  status: UserStatus;

  @Prop({ type: Date })
  emailVerifiedAt?: Date;

  @Prop({ type: Date })
  lastLoginAt?: Date;

  @Prop()
  lastLoginIp?: string;

  @Prop({ default: null })
  avatarUrl?: string;

  @Prop({
    type: String,
    enum: ['local', 'google', 'facebook', 'github'],
    default: 'local',
  })
  authProvider?: string;

  @Prop({ type: String, unique: true, sparse: true })
  googleId?: string;

  @Prop({ type: Boolean, default: false })
  isOAuthUser: boolean;

  @Prop({ type: Boolean, default: false })
  isPhoneVerified: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Create indexes for OAuth fields
UserSchema.index({ googleId: 1 }, { sparse: true, unique: true });
UserSchema.index({ authProvider: 1 });
