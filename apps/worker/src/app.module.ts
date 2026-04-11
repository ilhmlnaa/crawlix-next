import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppService } from './app.service';
import { WorkerHealthModule } from './health/worker-health.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    JobsModule,
    WorkerHealthModule,
  ],
  providers: [AppService],
})
export class AppModule {}
