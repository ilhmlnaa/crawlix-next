import {
  HttpException,
  HttpStatus,
  Injectable,
  type NestMiddleware,
} from '@nestjs/common';
import { getApiRuntimeConfig } from '@repo/config';
import type { NextFunction, Request, Response } from 'express';
import { ApiKeyService } from '../../admin/api-key.service';

interface RateLimitState {
  count: number;
  resetAt: number;
}

@Injectable()
export class PublicApiRateLimitMiddleware implements NestMiddleware {
  private readonly buckets = new Map<string, RateLimitState>();

  constructor(private readonly apiKeyService: ApiKeyService) {}

  async use(request: Request, response: Response, next: NextFunction) {
    const config = getApiRuntimeConfig();
    const globalLimit = config.publicApiRateLimitPerMinute;
    const now = Date.now();
    const apiKeyHeader = this.apiKeyService.extractFromRequest(request);
    const key =
      apiKeyHeader || request.ip || request.socket.remoteAddress || 'anonymous';

    let limit = globalLimit;
    if (apiKeyHeader) {
      const apiKeyRecord = await this.apiKeyService.validate(apiKeyHeader);
      if (apiKeyRecord && apiKeyRecord.rateLimit === null) {
        response.setHeader('X-RateLimit-Limit', 'unlimited');
        response.setHeader('X-RateLimit-Remaining', 'unlimited');
        response.setHeader(
          'X-RateLimit-Reset',
          String(Math.ceil((now + 60_000) / 1000)),
        );
        return next();
      }
      if (apiKeyRecord?.rateLimit) {
        limit = apiKeyRecord.rateLimit;
      }
    }

    const current = this.buckets.get(key);
    const bucket =
      !current || current.resetAt <= now
        ? {
            count: 0,
            resetAt: now + 60_000,
          }
        : current;

    bucket.count += 1;
    this.buckets.set(key, bucket);

    response.setHeader('X-RateLimit-Limit', String(limit));
    response.setHeader(
      'X-RateLimit-Remaining',
      String(Math.max(limit - bucket.count, 0)),
    );
    response.setHeader(
      'X-RateLimit-Reset',
      String(Math.ceil(bucket.resetAt / 1000)),
    );

    if (bucket.count > limit) {
      throw new HttpException(
        'Public API rate limit exceeded',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    next();
  }
}
