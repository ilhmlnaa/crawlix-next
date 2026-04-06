import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import {
  getWorkerRuntimeConfig,
  validateWorkerRuntimeConfig,
} from '@repo/config';
import { createWorkerBootstrapMessage } from '@repo/observability';
import { AppModule } from './app.module';
import { logWorkerBootstrapSummary } from './common/logging/bootstrap-logger';

const bootstrapLogger = new Logger('WorkerBootstrap');

async function bootstrap() {
  const config = validateWorkerRuntimeConfig(getWorkerRuntimeConfig());
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn', 'debug', 'verbose'],
  });

  logWorkerBootstrapSummary(config);
  bootstrapLogger.log(
    createWorkerBootstrapMessage(config.serviceName, String(config.port)),
  );

  process.on('SIGTERM', () => {
    void (async () => {
      bootstrapLogger.log('SIGTERM received, shutting down worker');
      await app.close();
      process.exit(0);
    })();
  });

  process.on('SIGINT', () => {
    void (async () => {
      bootstrapLogger.log('SIGINT received, shutting down worker');
      await app.close();
      process.exit(0);
    })();
  });
}

void bootstrap().catch((error) => {
  bootstrapLogger.error(
    `worker bootstrap failed: ${
      error instanceof Error ? error.message : 'Unknown error'
    }`,
    error instanceof Error ? error.stack : undefined,
  );
  process.exit(1);
});
