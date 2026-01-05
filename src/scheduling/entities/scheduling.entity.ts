import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import {
  IsDate,
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  Matches,
  IsEnum,
  Min,
  Max,
  IsNotEmpty,
  IsPhoneNumber,
} from 'class-validator';
import { Transform } from 'class-transformer';

export type SchedulingDocument = Scheduling & Document;

@Schema({
  timestamps: true,
})
export class Scheduling {
  @Prop({
    type: Types.ObjectId,
    ref: 'Route',
    required: true,
    index: true,
  })
  @IsNotEmpty({ message: 'Route ID không được để trống' })
  routeId: Types.ObjectId;

  @Prop({
    type: Types.ObjectId,
    ref: 'Bus',
    required: true,
    index: true,
  })
  @IsNotEmpty({ message: 'Bus ID không được để trống' })
  busId: Types.ObjectId; // Single busId as per requirement

  @Prop({ type: [{ type: Types.ObjectId, ref: 'Bus' }], required: true })
  busIds: Types.ObjectId[]; // Keep existing array for flexibility

  @Prop({
    required: true,
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
  })
  @IsString({ message: 'ETD phải là chuỗi' })
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'ETD phải có định dạng HH:mm (VD: 08:30, 14:45)',
  })
  etd: string; // Expected Time of Departure - format: "HH:mm"

  @Prop({
    required: true,
    index: true,
  })
  @IsDate({ message: 'Ngày khởi hành phải là ngày hợp lệ' })
  @Transform(({ value }) => new Date(value))
  departureDate: Date; // Ngày khởi hành

  @Prop({
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
  })
  @IsOptional()
  @IsString({ message: 'ETA phải là chuỗi' })
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'ETA phải có định dạng HH:mm (VD: 12:30, 18:45)',
  })
  eta?: string; // Expected Time of Arrival - format: "HH:mm"

  @Prop()
  @IsOptional()
  @IsDate({ message: 'Ngày đến phải là ngày hợp lệ' })
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  arrivalDate?: Date; // Ngày đến dự kiến

  @Prop({ maxlength: 500 })
  @IsOptional()
  @IsString({ message: 'Ghi chú phải là chuỗi' })
  note?: string;

  @Prop({ default: true })
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái hoạt động phải là boolean' })
  isActive: boolean;

  @Prop({
    enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'delayed'],
    default: 'scheduled',
    index: true,
  })
  @IsOptional()
  @IsEnum(['scheduled', 'in-progress', 'completed', 'cancelled', 'delayed'], {
    message:
      'Trạng thái phải là một trong: scheduled, in-progress, completed, cancelled, delayed',
  })
  status: string;

  @Prop({
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
  })
  @IsOptional()
  @IsString({ message: 'Thời gian khởi hành thực tế phải là chuỗi' })
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Thời gian khởi hành thực tế phải có định dạng HH:mm',
  })
  actualDepartureTime?: string; // Thời gian khởi hành thực tế

  @Prop({
    match: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
  })
  @IsOptional()
  @IsString({ message: 'Thời gian đến thực tế phải là chuỗi' })
  @Matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/, {
    message: 'Thời gian đến thực tế phải có định dạng HH:mm',
  })
  actualArrivalTime?: string; // Thời gian đến thực tế

  @Prop({
    default: 0,
    min: 0,
    max: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Số ghế còn trống phải là số' })
  @Min(0, { message: 'Số ghế còn trống không được âm' })
  @Max(100, { message: 'Số ghế còn trống không được vượt quá 100' })
  availableSeats: number; // Số ghế còn trống

  @Prop({
    default: 0,
    min: 0,
    max: 100,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Số ghế đã đặt phải là số' })
  @Min(0, { message: 'Số ghế đã đặt không được âm' })
  @Max(100, { message: 'Số ghế đã đặt không được vượt quá 100' })
  bookedSeats: number; // Số ghế đã đặt

  @Prop({
    min: 0,
    max: 10000000,
  })
  @IsOptional()
  @IsNumber({}, { message: 'Giá vé phải là số' })
  @Min(0, { message: 'Giá vé không được âm' })
  @Max(10000000, { message: 'Giá vé không được vượt quá 10 triệu' })
  price?: number; // Giá vé cho lịch trình này

  @Prop({
    type: {
      name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100,
      },
      phone: {
        type: String,
        required: true,
        match: /^(\+84|84|0)[3|5|7|8|9][0-9]{8}$/,
      },
      licenseNumber: {
        type: String,
        required: true,
        trim: true,
        minlength: 8,
        maxlength: 20,
      },
    },
    required: false,
  })
  driver?: {
    name: string;
    phone: string;
    licenseNumber: string;
  };

  @Prop({
    type: {
      name: {
        type: String,
        required: true,
        trim: true,
        minlength: 2,
        maxlength: 100,
      },
      phone: {
        type: String,
        required: true,
        match: /^(\+84|84|0)[3|5|7|8|9][0-9]{8}$/,
      },
    },
    required: false,
  })
  conductor?: {
    name: string;
    phone: string;
  };

  // Thông tin tự động từ tuyến đường
  @Prop({
    min: 1,
    max: 2880, // 48 hours in minutes
  })
  @IsOptional()
  @IsNumber({}, { message: 'Thời gian dự kiến phải là số' })
  @Min(1, { message: 'Thời gian dự kiến tối thiểu 1 phút' })
  @Max(2880, { message: 'Thời gian dự kiến không được vượt quá 48 giờ' })
  estimatedDuration?: number; // Thời gian di chuyển dự kiến (phút)

  @Prop({
    type: [String],
    default: [],
    enum: [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ],
  })
  @IsOptional()
  recurringDays?: string[]; // Lặp lại theo ngày ['monday', 'tuesday', ...]

  @Prop()
  @IsOptional()
  @IsDate({ message: 'Ngày kết thúc lặp lại phải là ngày hợp lệ' })
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  recurringEndDate?: Date; // Ngày kết thúc lặp lại

  @Prop({ default: false })
  @IsOptional()
  @IsBoolean({ message: 'Lặp lại phải là boolean' })
  isRecurring: boolean; // Có phải lịch trình lặp lại không
}

export const SchedulingSchema = SchemaFactory.createForClass(Scheduling);
