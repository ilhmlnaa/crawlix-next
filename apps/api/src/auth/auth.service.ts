import {
  Injectable,
  Logger,
  UnauthorizedException,
  type CanActivate,
} from '@nestjs/common';
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import { getApiRuntimeConfig } from '@repo/config';
import type {
  AuthenticatedAdmin,
  DashboardSession,
} from '@repo/queue-contracts';
import type { Request } from 'express';
import { RedisService } from '../infrastructure/redis.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly redisService: RedisService) {}

  private get config() {
    return getApiRuntimeConfig();
  }

  private get sessionNamespace() {
    return `${this.config.redis.jobPrefix}:auth:sessions`;
  }

  private getSessionKey(sessionId: string) {
    return `${this.sessionNamespace}:${sessionId}`;
  }

  private hashPassword(password: string) {
    return scryptSync(password, this.config.auth.sessionSecret, 32).toString(
      'hex',
    );
  }

  private signSessionId(sessionId: string) {
    return createHmac('sha256', this.config.auth.sessionSecret)
      .update(sessionId)
      .digest('hex');
  }

  private encodeCookie(sessionId: string) {
    return `${sessionId}.${this.signSessionId(sessionId)}`;
  }

  private decodeCookie(rawCookie?: string | null) {
    if (!rawCookie) {
      return null;
    }

    const [sessionId, signature] = rawCookie.split('.');
    if (!sessionId || !signature) {
      return null;
    }

    const expectedSignature = this.signSessionId(sessionId);
    const left = Buffer.from(signature);
    const right = Buffer.from(expectedSignature);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      return null;
    }

    return sessionId;
  }

  private async getRedis() {
    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);
    return client;
  }

  async login(email: string, password: string) {
    const normalizedEmail = email.trim().toLowerCase();
    const expectedEmail = this.config.auth.adminEmail.trim().toLowerCase();
    const passwordHash = this.hashPassword(password);
    const expectedPasswordHash = this.hashPassword(
      this.config.auth.adminPassword,
    );

    const emailMatches =
      Buffer.byteLength(normalizedEmail) === Buffer.byteLength(expectedEmail) &&
      timingSafeEqual(Buffer.from(normalizedEmail), Buffer.from(expectedEmail));
    const passwordMatches =
      Buffer.byteLength(passwordHash) ===
        Buffer.byteLength(expectedPasswordHash) &&
      timingSafeEqual(
        Buffer.from(passwordHash),
        Buffer.from(expectedPasswordHash),
      );

    this.logger.debug(
      `login attempt email=${normalizedEmail} emailMatch=${emailMatches} passwordMatch=${passwordMatches}`,
    );

    if (!emailMatches || !passwordMatches) {
      this.logger.warn(`login rejected email=${normalizedEmail}`);
      throw new UnauthorizedException('Invalid dashboard credentials');
    }

    const sessionId = randomBytes(24).toString('hex');
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(
      Date.now() + this.config.auth.sessionTtlSeconds * 1000,
    ).toISOString();
    const session: DashboardSession = {
      sessionId,
      email: expectedEmail,
      createdAt,
      expiresAt,
    };

    const redis = await this.getRedis();
    await redis.set(
      this.getSessionKey(sessionId),
      JSON.stringify(session),
      'EX',
      this.config.auth.sessionTtlSeconds,
    );

    this.logger.log(
      `login success email=${normalizedEmail} sessionId=${sessionId.slice(0, 8)}... expiresAt=${expiresAt}`,
    );

    return {
      session,
      cookieValue: this.encodeCookie(sessionId),
    };
  }

  async logout(rawCookie?: string | null) {
    const sessionId = this.decodeCookie(rawCookie);
    if (!sessionId) {
      this.logger.debug('logout skipped: invalid or missing session cookie');
      return;
    }

    const redis = await this.getRedis();
    await redis.del(this.getSessionKey(sessionId));

    this.logger.log(`logout success sessionId=${sessionId.slice(0, 8)}...`);
  }

  async getAdminFromCookie(
    rawCookie?: string | null,
  ): Promise<AuthenticatedAdmin | null> {
    const sessionId = this.decodeCookie(rawCookie);
    if (!sessionId) {
      this.logger.debug('session lookup skipped: invalid cookie');
      return null;
    }

    const redis = await this.getRedis();
    const value = await redis.get(this.getSessionKey(sessionId));
    if (!value) {
      this.logger.debug(
        `session not found sessionId=${sessionId.slice(0, 8)}...`,
      );
      return null;
    }

    const session = JSON.parse(value) as DashboardSession;
    return {
      email: session.email,
    };
  }

  async requireAdmin(rawCookie?: string | null) {
    const admin = await this.getAdminFromCookie(rawCookie);
    if (!admin) {
      throw new UnauthorizedException('Dashboard session is required');
    }

    return admin;
  }

  getCookieName() {
    return this.config.auth.sessionCookieName;
  }

  buildCookieOptions() {
    return {
      httpOnly: true,
      sameSite: 'lax' as const,
      secure: this.config.auth.dashboardOrigin.startsWith('https://'),
      path: '/',
      maxAge: this.config.auth.sessionTtlSeconds * 1000,
    };
  }

  async authenticateRequest(request: Request) {
    return this.getAdminFromCookie(request.cookies?.[this.getCookieName()]);
  }
}
