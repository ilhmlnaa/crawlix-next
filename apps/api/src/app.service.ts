import { Injectable } from '@nestjs/common';
import { getApiRuntimeConfig } from '@repo/config';
import { createServiceMetadata } from '@repo/shared';

@Injectable()
export class AppService {
  getHello(): string {
    const service = createServiceMetadata('api');
    return `${service.displayName} bootstrap ready`;
  }

  getHealth() {
    const config = getApiRuntimeConfig();

    return {
      service: createServiceMetadata('api'),
      status: 'ok',
      queueName: config.queue.queueName,
      redisPrefix: config.redis.jobPrefix,
    };
  }
}
