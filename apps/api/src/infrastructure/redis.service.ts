import { Injectable, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { getApiRuntimeConfig } from '@repo/config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis | null = null;

  getClient(): Redis {
    if (!this.client) {
      const config = getApiRuntimeConfig();
      this.client = new Redis(config.redis.url, {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });
    }

    return this.client;
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
      this.client = null;
    }
  }
}
