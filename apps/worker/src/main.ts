import { NestFactory } from '@nestjs/core';
import { getWorkerRuntimeConfig, validateWorkerRuntimeConfig } from '@repo/config';
import { AppModule } from './app.module';
import { createWorkerBootstrapMessage } from '@repo/observability';

async function bootstrap() {
  const config = validateWorkerRuntimeConfig(getWorkerRuntimeConfig());
  const app = await NestFactory.createApplicationContext(AppModule);

  console.log(createWorkerBootstrapMessage(config.serviceName, String(config.port)));

  process.on('SIGTERM', async () => {
    await app.close();
    process.exit(0);
  });

  process.on('SIGINT', async () => {
    await app.close();
    process.exit(0);
  });
}

void bootstrap().catch((error) => {
  console.error('worker bootstrap failed', error);
  process.exit(1);
});
