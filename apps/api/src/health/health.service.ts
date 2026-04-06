import { Injectable } from '@nestjs/common';
import { getApiRuntimeConfig } from '@repo/config';
import { RedisService } from '../infrastructure/redis.service';
import { QueuePublisherService } from '../infrastructure/queue-publisher.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly redisService: RedisService,
    private readonly queuePublisher: QueuePublisherService,
  ) {}

  live() {
    const config = getApiRuntimeConfig();

    return {
      status: 'ok',
      service: config.serviceName,
      timestamp: new Date().toISOString(),
    };
  }

  async ready() {
    const config = getApiRuntimeConfig();
    const client = this.redisService.getClient();

    await client.connect().catch(() => undefined);

    const [redisPing, queueStats] = await Promise.all([
      client.ping(),
      this.queuePublisher.getQueueStats(),
    ]);

    return {
      status: redisPing === 'PONG' ? 'ready' : 'degraded',
      service: config.serviceName,
      timestamp: new Date().toISOString(),
      checks: {
        redis: redisPing === 'PONG' ? 'ok' : 'failed',
        queue: {
          status: 'ok',
          queueName: config.queue.queueName,
          depth: queueStats.messageCount,
          consumers: queueStats.consumerCount,
        },
      },
    };
  }
}
