import { ApiProperty } from '@nestjs/swagger';
import { TicketStatus } from '../enums/ticket-status.enum';
import { PaymentMethod } from '../enums/payment-method.enum';

export class TicketResponseDto {
  @ApiProperty()
  _id: string;

  @ApiProperty()
  userId: any; // Can be populated

  @ApiProperty()
  seatId: any; // Can be populated

  @ApiProperty()
  schedulingId: any; // Can be populated

  @ApiProperty()
  promotionId: any; // Can be populated

  @ApiProperty({ enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  @ApiProperty({ required: false })
  fallbackURL?: string;

  @ApiProperty()
  totalPrice: number;

  @ApiProperty()
  expiredTime: Date;

  @ApiProperty({ enum: TicketStatus })
  status: TicketStatus;

  @ApiProperty({ required: false })
  transferTicketId?: string;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
