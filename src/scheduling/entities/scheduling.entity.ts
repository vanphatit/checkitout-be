import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SchedulingDocument = Scheduling & Document;

@Schema({
    timestamps: true,
})
export class Scheduling {
    @Prop({ type: Types.ObjectId, ref: 'Route', required: true })
    routeId: Types.ObjectId;

    @Prop({ type: [{ type: Types.ObjectId, ref: 'Bus' }], required: true })
    busIds: Types.ObjectId[];

    @Prop({ required: true })
    etd: string; // Expected Time of Departure - format: "HH:mm"

    @Prop({ required: true })
    departureDate: Date; // Ngày khởi hành

    @Prop()
    eta: string; // Expected Time of Arrival - format: "HH:mm"

    @Prop()
    arrivalDate: Date; // Ngày đến dự kiến

    @Prop()
    note?: string;

    @Prop({ default: true })
    isActive: boolean;

    @Prop({
        enum: ['scheduled', 'in-progress', 'completed', 'cancelled', 'delayed'],
        default: 'scheduled'
    })
    status: string;

    @Prop()
    actualDepartureTime?: string; // Thời gian khởi hành thực tế

    @Prop()
    actualArrivalTime?: string; // Thời gian đến thực tế

    @Prop({ default: 0 })
    availableSeats: number; // Số ghế còn trống

    @Prop({ default: 0 })
    bookedSeats: number; // Số ghế đã đặt

    @Prop()
    price?: number; // Giá vé cho lịch trình này

    @Prop({
        type: Object,
        required: false
    })
    driver?: {
        name: string;
        phone: string;
        licenseNumber: string;
    };

    @Prop({
        type: Object,
        required: false
    })
    conductor?: {
        name: string;
        phone: string;
    };

    // Thông tin tự động từ tuyến đường
    @Prop()
    estimatedDuration?: number; // Thời gian di chuyển dự kiến (phút)

    @Prop({ type: [String], default: [] })
    recurringDays?: string[]; // Lặp lại theo ngày ['monday', 'tuesday', ...]

    @Prop()
    recurringEndDate?: Date; // Ngày kết thúc lặp lại

    @Prop({ default: false })
    isRecurring: boolean; // Có phải lịch trình lặp lại không
}

export const SchedulingSchema = SchemaFactory.createForClass(Scheduling);