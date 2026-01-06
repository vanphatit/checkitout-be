import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePromotionDto } from './create-promotion.dto';

export class UpdatePromotionDto extends PartialType(
  OmitType(CreatePromotionDto, [
    'type',
    'recurringMonth',
    'recurringDay',
  ] as const),
) {
  // Cannot change type or recurring date - only value, name, description, isActive
}
