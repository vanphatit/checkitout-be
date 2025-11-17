import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;

  constructor(private configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get('REDIS_HOST') || 'localhost',
      port: parseInt(this.configService.get('REDIS_PORT') || '6379'),
      password: this.configService.get('REDIS_PASSWORD') || undefined,
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });

    this.client.on('connect', () => {
      console.log('Redis connected successfully');
    });

    this.client.on('error', (err) => {
      console.error('Redis connection error:', err);
    });
  }

  async set(
    key: string,
    value: string,
    expireInSeconds?: number,
  ): Promise<void> {
    if (expireInSeconds) {
      await this.client.setex(key, expireInSeconds, value);
    } else {
      await this.client.set(key, value);
    }
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    const result = await this.client.exists(key);
    return result === 1;
  }

  async setWithExpiry(
    key: string,
    value: string,
    expireInSeconds: number,
  ): Promise<void> {
    await this.client.setex(key, expireInSeconds, value);
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
