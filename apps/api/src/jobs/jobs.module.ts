import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { AdminProxyController } from './admin-proxy.controller';
import { JobsController } from './jobs.controller';
import { WorkersController } from './workers.controller';
import { JobsService } from './jobs.service';
import { JobStoreService } from './job-store.service';
import { ScrapeCacheService } from './scrape-cache.service';
import { QueuePublisherService } from '../infrastructure/queue-publisher.service';
import { RedisService } from '../infrastructure/redis.service';
import { WorkerRegistryService } from './worker-registry.service';
import { WebhookEventService } from './webhook-event.service';

@Module({
  imports: [AuthModule, AdminModule],
  controllers: [JobsController, WorkersController, AdminProxyController],
  providers: [
    JobsService,
    JobStoreService,
    ScrapeCacheService,
    QueuePublisherService,
    RedisService,
    WorkerRegistryService,
    WebhookEventService,
  ],
  exports: [
    JobsService,
    JobStoreService,
    ScrapeCacheService,
    QueuePublisherService,
    WorkerRegistryService,
    RedisService,
    WebhookEventService,
  ],
})
export class JobsModule {}
