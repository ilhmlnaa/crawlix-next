import { Module } from '@nestjs/common';
import { RedisService } from '../infrastructure/redis.service';
import { JobStoreService } from './job-store.service';
import { JobProcessorService } from './job-processor.service';
import { QueueConsumerService } from './queue-consumer.service';
import { ScrapeCacheService } from './scrape-cache.service';
import { WorkerHeartbeatService } from './worker-heartbeat.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

@Module({
  providers: [
    RedisService,
    JobStoreService,
    ScrapeCacheService,
    WorkerHeartbeatService,
    WebhookDispatcherService,
    JobProcessorService,
    QueueConsumerService,
  ],
  exports: [
    RedisService,
    JobProcessorService,
    QueueConsumerService,
    WebhookDispatcherService,
  ],
})
export class JobsModule {}
