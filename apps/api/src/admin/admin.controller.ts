import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { AdminService } from './admin.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Controller('admin/api-keys')
@UseGuards(SessionAuthGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get()
  list() {
    return this.adminService.listApiKeys();
  }

  @Post()
  create(@Body() body: CreateApiKeyDto) {
    return this.adminService.createApiKey(body.label);
  }

  @Post(':keyId/revoke')
  revoke(@Param('keyId') keyId: string) {
    return this.adminService.revokeApiKey(keyId);
  }

  @Delete(':keyId')
  remove(@Param('keyId') keyId: string) {
    return this.adminService.deleteApiKey(keyId);
  }
}
