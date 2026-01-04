import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RouteDocument = Route & Document;

@Schema({
    timestamps: true,
    collection: 'routes'
})
export class Route {
    @Prop({
        required: [true, 'Tên tuyến đường là bắt buộc'],
        trim: true,
        minlength: [3, 'Tên tuyến phải có ít nhất 3 ký tự'],
        maxlength: [100, 'Tên tuyến không được vượt quá 100 ký tự']
    })
    name: string;

    @Prop({
        type: [{ type: Types.ObjectId, ref: 'Station' }],
        required: [true, 'Danh sách trạm là bắt buộc'],
        validate: {
            validator: function (stations: Types.ObjectId[]) {
                return stations && stations.length >= 2;
            },
            message: 'Tuyến đường phải có ít nhất 2 trạm'
        }
    })
    stationIds: Types.ObjectId[];

    @Prop({
        required: [true, 'Khoảng cách là bắt buộc'],
        min: [0.1, 'Khoảng cách phải lớn hơn 0.1 km'],
        max: [5000, 'Khoảng cách không được vượt quá 5000 km']
    })
    distance: number; // km

    @Prop({
        required: [true, 'Thời gian khởi hành dự kiến là bắt buộc'],
        validate: {
            validator: function (etd: string) {
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(etd);
            },
            message: 'ETD phải có định dạng HH:mm (ví dụ: 08:30)'
        }
    })
    etd: string; // Thời gian khởi hành dự kiến - format: "HH:mm"

    @Prop({
        min: [1, 'Thời gian ước tính phải lớn hơn 0 phút'],
        max: [2880, 'Thời gian ước tính không quá 48 giờ']
    })
    estimatedDuration: number; // minutes

    @Prop({ maxlength: [500, 'Mô tả không được vượt quá 500 ký tự'] })
    description?: string;

    @Prop({ default: true })
    isActive: boolean;

    @Prop({
        min: [0, 'Giá cơ bản không thể âm'],
        max: [10000000, 'Giá cơ bản quá cao']
    })
    basePrice?: number;

    @Prop({
        min: [0, 'Giá theo km không thể âm'],
        max: [100000, 'Giá theo km quá cao']
    })
    pricePerKm?: number;

    // Google Maps route information
    @Prop({
        type: Object,
        required: false
    })
    googleRouteData?: {
        polyline?: string;
        bounds?: {
            northeast: { lat: number; lng: number };
            southwest: { lat: number; lng: number };
        };
        legs?: Array<{
            distance: { text: string; value: number };
            duration: { text: string; value: number };
            startLocation: { lat: number; lng: number };
            endLocation: { lat: number; lng: number };
        }>;
    };

    // Thời gian hoạt động
    @Prop({
        type: Object,
        required: false,
        validate: {
            validator: function (hours: any) {
                if (!hours) return true;
                return /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(hours.start) &&
                    /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(hours.end);
            },
            message: 'Giờ hoạt động phải có định dạng HH:mm'
        }
    })
    operatingHours?: {
        start: string; // HH:mm format
        end: string;   // HH:mm format
    };

    @Prop({
        type: [String],
        default: [],
        validate: {
            validator: function (days: string[]) {
                const validDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                return !days || days.every(day => validDays.includes(day.toLowerCase()));
            },
            message: 'Ngày hoạt động không hợp lệ'
        }
    })
    operatingDays?: string[]; // ['monday', 'tuesday', ...]
}

export const RouteSchema = SchemaFactory.createForClass(Route);

// Tạo indexes
RouteSchema.index({ name: 'text', description: 'text' }); // Full-text search
RouteSchema.index({ isActive: 1 });
RouteSchema.index({ stationIds: 1 });
RouteSchema.index({ distance: 1 });
RouteSchema.index({ name: 1 }, { unique: true }); // Unique route names
RouteSchema.index({ 'stationIds.0': 1, 'stationIds.-1': 1 }); // First and last station

// Virtual for route display name
RouteSchema.virtual('displayName').get(function () {
    return `${this.name} (${this.distance}km - ${this.etd})`;
});

// Pre-save middleware
RouteSchema.pre('save', function (next) {
    this.name = this.name.trim().replace(/\s+/g, ' ');
    next();
});