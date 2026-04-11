import { CanActivate, Injectable, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeyService } from '../../admin/api-key.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly apiKeyService: ApiKeyService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & Record<string, unknown>>();
    const apiKey = await this.apiKeyService.requireApiKey(request);

    request.apiKey = apiKey;
    request.authKind = 'apiKey';
    return true;
  }
}
