import { Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { AuthModule } from '../auth/auth.module';
import { JobsController } from './jobs.controller';
import { WorkersController } from './workers.controller';
import { JobsService } from './jobs.service';
import { JobStoreService } from './job-store.service';
import { QueuePublisherService } from '../infrastructure/queue-publisher.service';
import { RedisService } from '../infrastructure/redis.service';
import { WorkerRegistryService } from './worker-registry.service';
import { WebhookEventService } from './webhook-event.service';

@Module({
  imports: [AuthModule, AdminModule],
  controllers: [JobsController, WorkersController],
  providers: [
    JobsService,
    JobStoreService,
    QueuePublisherService,
    RedisService,
    WorkerRegistryService,
    WebhookEventService,
  ],
  exports: [
    JobsService,
    JobStoreService,
    QueuePublisherService,
    WorkerRegistryService,
    RedisService,
    WebhookEventService,
  ],
})
export class JobsModule {}
