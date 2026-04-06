import { CanActivate, Injectable, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & Record<string, unknown>>();
    const admin = await this.authService.requireAdmin(
      request.cookies?.[this.authService.getCookieName()],
    );

    request.admin = admin;
    request.authKind = 'session';
    return true;
  }
}
