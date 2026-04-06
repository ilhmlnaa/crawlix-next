import { Module } from '@nestjs/common';
import { RedisService } from '../infrastructure/redis.service';
import { AdminApiKeysController } from './admin-api-keys.controller';
import { ApiKeyService } from './api-key.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { SessionOrApiKeyGuard } from './guards/session-or-api-key.guard';

@Module({
  controllers: [AuthController, AdminApiKeysController],
  providers: [
    RedisService,
    AuthService,
    ApiKeyService,
    SessionAuthGuard,
    ApiKeyGuard,
    SessionOrApiKeyGuard,
  ],
  exports: [
    AuthService,
    ApiKeyService,
    SessionAuthGuard,
    ApiKeyGuard,
    SessionOrApiKeyGuard,
  ],
})
export class AuthModule {}
