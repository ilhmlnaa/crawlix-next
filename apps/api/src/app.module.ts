import {
  MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PublicApiRateLimitMiddleware } from './common/middleware/public-api-rate-limit.middleware';
import { HealthModule } from './health/health.module';
import { JobsModule } from './jobs/jobs.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    JobsModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(PublicApiRateLimitMiddleware).forRoutes(
      {
        path: 'jobs',
        method: RequestMethod.POST,
      },
      {
        path: 'jobs/:jobId',
        method: RequestMethod.GET,
      },
      {
        path: 'jobs/:jobId/result',
        method: RequestMethod.GET,
      },
    );
  }
}
