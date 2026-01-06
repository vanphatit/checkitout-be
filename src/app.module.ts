import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { RedisModule } from './modules/redis/redis.module';
import { EmailModule } from './modules/email/email.module';
import { BusModule } from './bus/bus.module';
import { SeatModule } from './seat/seat.module';
import { PromotionModule } from './promotion/promotion.module';
import { TicketModule } from './ticket/ticket.module';
import { PaymentModule } from './vnpay/payment.module';
import { StationModule } from './station/station.module';
import { RouteModule } from './route/route.module';
import { SchedulingModule } from './scheduling/scheduling.module';
import { CommonModule } from './common/common.module';
import { SeederModule } from './common/seeder/seeder.module';
import { SearchModule } from './modules/search/search.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { StatisticsModule } from './statistics/statistics.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env.local',
      isGlobal: true,
    }),
    MongooseModule.forRoot(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/checkitout_db',
    ),
    ThrottlerModule.forRoot([
      {
        ttl: parseInt(process.env.THROTTLE_TTL || '60') * 1000,
        limit: parseInt(process.env.THROTTLE_LIMIT || '10'),
      },
    ]),
    EventEmitterModule.forRoot(),
    RedisModule,
    EmailModule,
    CommonModule,
    SeederModule,
    SearchModule,
    UsersModule,
    AuthModule,
    BusModule,
    SeatModule,
    StationModule,
    RouteModule,
    SchedulingModule,
    PromotionModule,
    TicketModule,
    PaymentModule,
    StatisticsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_PIPE,
      useFactory: () =>
        new ValidationPipe({
          transform: true,
          whitelist: true,
          forbidNonWhitelisted: true,
          transformOptions: {
            enableImplicitConversion: true,
          },
        }),
    },
  ],
})
export class AppModule { }
