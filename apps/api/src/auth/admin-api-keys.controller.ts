import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { SessionAuthGuard } from './guards/session-auth.guard';

@Controller('admin/api-keys')
@UseGuards(SessionAuthGuard)
export class AdminApiKeysController {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  @Get()
  list() {
    return this.apiKeyService.list();
  }

  @Post()
  create(@Body() body: CreateApiKeyDto) {
    return this.apiKeyService.create(body.label);
  }

  @Post(':keyId/revoke')
  revoke(@Param('keyId') keyId: string) {
    return this.apiKeyService.revoke(keyId);
  }
}
