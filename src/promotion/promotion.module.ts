import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PromotionService } from './promotion.service';
import { PromotionController } from './promotion.controller';
import { Promotion, PromotionSchema } from './entities/promotion.entity';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Module({
	imports: [MongooseModule.forFeature([{ name: Promotion.name, schema: PromotionSchema }]), AuthModule],
	providers: [PromotionService, JwtAuthGuard],
	controllers: [PromotionController],
	exports: [PromotionService],
})
export class PromotionModule {}

