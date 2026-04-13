import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getApiRuntimeConfig, validateApiRuntimeConfig } from '@repo/config';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import {
  HttpExceptionFilter,
  RequestLoggingInterceptor,
  logBootstrapSummary,
} from './common/logging';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = validateApiRuntimeConfig(getApiRuntimeConfig());
  const allowedOrigins = Array.from(
    new Set(
      [config.corsOrigin, config.auth.dashboardOrigin].filter(
        (value) => value !== '*',
      ),
    ),
  );

  app.enableShutdownHooks();
  app.useGlobalInterceptors(new RequestLoggingInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({
    origin:
      config.corsOrigin === '*'
        ? true
        : (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) {
              callback(null, true);
              return;
            }

            callback(new Error(`Origin ${origin} is not allowed by CORS`));
          },
    credentials: true,
  });
  app.setGlobalPrefix('api');
  app.use(cookieParser());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      transform: true,
    }),
  );

  logBootstrapSummary(config);

  await app.listen(config.port);
}

void bootstrap().catch((error) => {
  console.error('api bootstrap failed', error);
  process.exit(1);
});
