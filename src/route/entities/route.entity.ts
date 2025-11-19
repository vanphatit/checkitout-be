import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RouteDocument = Route & Document;

@Schema({
    timestamps: true,
})
export class Route {
    @Prop({ required: true })
    name: string;

    @Prop({ type: [{ type: Types.ObjectId, ref: 'Station' }], required: true })
    stationIds: Types.ObjectId[];

    @Prop({ required: true })
    distance: number; // km

    @Prop()
    estimatedDuration: number; // minutes

    @Prop()
    description?: string;

    @Prop({ default: true })
    isActive: boolean;

    @Prop()
    basePrice?: number;

    @Prop()
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
        required: false
    })
    operatingHours?: {
        start: string; // HH:mm format
        end: string;   // HH:mm format
    };

    @Prop({ type: [String], default: [] })
    operatingDays?: string[]; // ['monday', 'tuesday', ...]
}

export const RouteSchema = SchemaFactory.createForClass(Route);