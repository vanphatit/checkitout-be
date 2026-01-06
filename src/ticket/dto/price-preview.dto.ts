import { ApiProperty } from '@nestjs/swagger';
export class PricePreviewDto {
  @ApiProperty({ description: 'Original price before discount' })
  originalPrice: number;

  @ApiProperty({ description: 'Promotion name' })
  promotionName: string;

  @ApiProperty({ description: 'Promotion discount percentage' })
  promotionValue: number;

  @ApiProperty({ description: 'Discount amount' })
  discount: number;

  @ApiProperty({ description: 'Final price after discount' })
  totalPrice: number;

  @ApiProperty({ description: 'Ticket expiration time' })
  expiredTime: Date;
}
