import { forwardRef, Module } from '@nestjs/common';
import { AdminModule } from '../admin/admin.module';
import { RedisService } from '../infrastructure/redis.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { ApiKeyGuard } from './guards/api-key.guard';
import { SessionAuthGuard } from './guards/session-auth.guard';
import { SessionOrApiKeyGuard } from './guards/session-or-api-key.guard';

@Module({
  imports: [forwardRef(() => AdminModule)],
  controllers: [AuthController],
  providers: [
    RedisService,
    AuthService,
    SessionAuthGuard,
    ApiKeyGuard,
    SessionOrApiKeyGuard,
  ],
  exports: [
    AuthService,
    SessionAuthGuard,
    ApiKeyGuard,
    SessionOrApiKeyGuard,
  ],
})
export class AuthModule {}
