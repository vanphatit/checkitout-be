import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TicketDocument = Ticket & Document;

@Schema({
	timestamps: true
})
export class Ticket {
	@Prop({ type: Types.ObjectId, ref: 'User', required: true })
	userId: Types.ObjectId;

	@Prop({ type: Types.ObjectId, ref: 'Seat', required: true })
	seatId: Types.ObjectId;

	@Prop({ type: Types.ObjectId, ref: 'Scheduling', required: true })
	schedulingId: Types.ObjectId;

	@Prop({ type: Types.ObjectId, ref: 'Promotion', required: false })
	promotionId?: Types.ObjectId;

	@Prop({ type: Types.ObjectId, ref: 'Payment', required: false })
	paymentId?: Types.ObjectId;

}

export const TicketSchema = SchemaFactory.createForClass(Ticket);

