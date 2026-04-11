import { forwardRef, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RedisService } from '../infrastructure/redis.service';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ApiKeyService } from './api-key.service';

@Module({
  imports: [forwardRef(() => AuthModule)],
  controllers: [AdminController],
  providers: [RedisService, ApiKeyService, AdminService],
  exports: [ApiKeyService, AdminService],
})
export class AdminModule {}
