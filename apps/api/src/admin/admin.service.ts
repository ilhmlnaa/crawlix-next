import { Injectable } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';

@Injectable()
export class AdminService {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  listApiKeys() {
    return this.apiKeyService.list();
  }

  createApiKey(label: string) {
    return this.apiKeyService.create(label);
  }

  revokeApiKey(keyId: string) {
    return this.apiKeyService.revoke(keyId);
  }

  deleteApiKey(keyId: string) {
    return this.apiKeyService.delete(keyId);
  }
}
