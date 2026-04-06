import { CanActivate, Injectable, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { ApiKeyService } from '../api-key.service';
import { AuthService } from '../auth.service';

@Injectable()
export class SessionOrApiKeyGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly apiKeyService: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & Record<string, unknown>>();
    const admin = await this.authService.authenticateRequest(request);
    if (admin) {
      request.admin = admin;
      request.authKind = 'session';
      return true;
    }

    const apiKey = await this.apiKeyService.requireApiKey(request);
    request.apiKey = apiKey;
    request.authKind = 'apiKey';
    return true;
  }
}
