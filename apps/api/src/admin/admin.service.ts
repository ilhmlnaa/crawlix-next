import { Injectable } from '@nestjs/common';
import { ApiKeyService } from './api-key.service';

@Injectable()
export class AdminService {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  listApiKeys() {
    return this.apiKeyService.list();
  }

  createApiKey(label: string, rateLimit?: number | null) {
    return this.apiKeyService.create(label, rateLimit);
  }

  revokeApiKey(keyId: string) {
    return this.apiKeyService.revoke(keyId);
  }

  deleteApiKey(keyId: string) {
    return this.apiKeyService.delete(keyId);
  }
}
