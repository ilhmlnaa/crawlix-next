import { Injectable } from '@nestjs/common';
import { getWorkerRuntimeConfig } from '@repo/config';
import { RedisService } from '../infrastructure/redis.service';
import { JobProcessorService } from '../jobs/job-processor.service';
import { QueueConsumerService } from '../jobs/queue-consumer.service';
import { WebhookDispatcherService } from '../jobs/webhook-dispatcher.service';

@Injectable()
export class WorkerHealthService {
  constructor(
    private readonly redisService: RedisService,
    private readonly queueConsumer: QueueConsumerService,
    private readonly jobProcessor: JobProcessorService,
    private readonly webhookDispatcher: WebhookDispatcherService,
  ) {}

  live() {
    const config = getWorkerRuntimeConfig();

    return {
      status: 'ok',
      service: config.serviceName,
      timestamp: new Date().toISOString(),
    };
  }

  async ready() {
    const config = getWorkerRuntimeConfig();
    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);
    const redisPing = await client.ping();
    const queueStatus = this.queueConsumer.getStatus();

    return {
      status:
        redisPing === 'PONG' && queueStatus.connected ? 'ready' : 'degraded',
      service: config.serviceName,
      timestamp: new Date().toISOString(),
      checks: {
        redis: redisPing === 'PONG' ? 'ok' : 'failed',
        queue: queueStatus,
        webhook: this.webhookDispatcher.getStatus(),
        browserPool: this.jobProcessor.getRuntimeStats(),
      },
    };
  }
}
