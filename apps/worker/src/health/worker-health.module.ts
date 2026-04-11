import { Module } from '@nestjs/common';
import { JobsModule } from '../jobs/jobs.module';
import { WorkerHealthController } from './worker-health.controller';
import { WorkerHealthService } from './worker-health.service';

@Module({
  imports: [JobsModule],
  controllers: [WorkerHealthController],
  providers: [WorkerHealthService],
})
export class WorkerHealthModule {}
