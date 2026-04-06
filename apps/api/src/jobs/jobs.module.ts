import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobStoreService } from './job-store.service';
import { QueuePublisherService } from '../infrastructure/queue-publisher.service';
import { RedisService } from '../infrastructure/redis.service';
import { WorkerRegistryService } from './worker-registry.service';

@Module({
  imports: [AuthModule],
  controllers: [JobsController],
  providers: [
    JobsService,
    JobStoreService,
    QueuePublisherService,
    RedisService,
    WorkerRegistryService,
  ],
  exports: [
    JobsService,
    JobStoreService,
    QueuePublisherService,
    WorkerRegistryService,
    RedisService,
  ],
})
export class JobsModule {}
