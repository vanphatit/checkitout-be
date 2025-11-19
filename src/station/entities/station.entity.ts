import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type StationDocument = Station & Document;

@Schema({
    timestamps: true,
})
export class Station {
    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    address: string;

    @Prop({
        type: {
            type: String,
            default: 'Point',
            enum: ['Point']
        },
        coordinates: {
            type: [Number],
            required: true
        }
    })
    location: {
        type: string;
        coordinates: [number, number]; // [longitude, latitude]
    };

    @Prop()
    description?: string;

    @Prop({ default: true })
    isActive: boolean;

    @Prop()
    contactPhone?: string;

    @Prop()
    operatingHours?: string;

    @Prop()
    facilities?: string[];

    // Thông tin bổ sung từ OpenStreetMap
    @Prop({
        type: Object,
        required: false
    })
    osmData?: {
        placeId?: string;
        type?: string;
        displayName?: string;
    };
}

export const StationSchema = SchemaFactory.createForClass(Station);

// Tạo index cho location để hỗ trợ geospatial queries
StationSchema.index({ location: '2dsphere' });