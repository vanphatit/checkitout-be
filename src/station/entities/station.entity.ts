import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StationDocument = Station & Document;

@Schema({
  timestamps: true,
  collection: 'stations',
})
export class Station {
  @Prop({
    required: [true, 'Tên trạm là bắt buộc'],
    trim: true,
    minlength: [2, 'Tên trạm phải có ít nhất 2 ký tự'],
    maxlength: [100, 'Tên trạm không được vượt quá 100 ký tự'],
  })
  name: string;

  @Prop({
    required: [true, 'Địa chỉ là bắt buộc'],
    trim: true,
    minlength: [5, 'Địa chỉ phải có ít nhất 5 ký tự'],
  })
  address: string;

  @Prop({
    type: {
      type: String,
      default: 'Point',
      enum: {
        values: ['Point'],
        message: 'Location type phải là Point',
      },
    },
    coordinates: {
      type: [Number],
      required: [true, 'Tọa độ là bắt buộc'],
      validate: {
        validator: function (coords: number[]) {
          return (
            coords.length === 2 &&
            coords[0] >= -180 &&
            coords[0] <= 180 && // longitude
            coords[1] >= -90 &&
            coords[1] <= 90
          ); // latitude
        },
        message:
          'Tọa độ không hợp lệ. Longitude: [-180,180], Latitude: [-90,90]',
      },
    },
  })
  location: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };

  @Prop({ maxlength: [500, 'Mô tả không được vượt quá 500 ký tự'] })
  description?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop({
    validate: {
      validator: function (phone: string) {
        return !phone || /^[0-9+\-\s()]{10,15}$/.test(phone);
      },
      message: 'Số điện thoại không hợp lệ',
    },
  })
  contactPhone?: string;

  @Prop({ maxlength: [200, 'Giờ hoạt động không được vượt quá 200 ký tự'] })
  operatingHours?: string;

  @Prop({
    type: [String],
    validate: {
      validator: function (facilities: string[]) {
        return !facilities || facilities.every((f) => f.length <= 50);
      },
      message: 'Mỗi tiện ích không được vượt quá 50 ký tự',
    },
  })
  facilities?: string[];

  // Thông tin bổ sung từ OpenStreetMap
  @Prop({
    type: Object,
    required: false,
  })
  osmData?: {
    placeId?: string;
    type?: string;
    displayName?: string;
  };
}

export const StationSchema = SchemaFactory.createForClass(Station);

// Tạo indexes
StationSchema.index({ location: '2dsphere' });
StationSchema.index({ name: 'text', address: 'text' }); // Full-text search
StationSchema.index({ isActive: 1 });
StationSchema.index({ name: 1 }, { unique: true }); // Unique station names

// Pre-save middleware
StationSchema.pre('save', function (next) {
  // Normalize name
  this.name = this.name.trim().replace(/\s+/g, ' ');
  next();
});
