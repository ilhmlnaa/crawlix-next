import { Injectable } from '@nestjs/common';
import { getApiRuntimeConfig } from '@repo/config';
import type { ScrapeJobResult, ScrapeStrategy } from '@repo/queue-contracts';
import { createScrapeCacheKey } from '@repo/shared';
import { RedisService } from '../infrastructure/redis.service';

interface CachedScrapeEntry {
  content: string;
  preview?: string;
  contentType?: string;
  method?: string;
  responseTimeMs?: number;
  retries?: number;
  strategy: ScrapeStrategy;
  completedAt: string;
}

@Injectable()
export class ScrapeCacheService {
  constructor(private readonly redisService: RedisService) {}

  private get config() {
    return getApiRuntimeConfig();
  }

  private getCacheKey(fingerprint: string): string {
    return createScrapeCacheKey(this.config.redis.jobPrefix, fingerprint);
  }

  async lookup(input: {
    jobId: string;
    url: string;
    strategy: ScrapeStrategy;
    fingerprint: string;
    requestedAt: string;
    webhookUrl?: string;
    idempotencyKey?: string;
    targetWorkerId?: string;
    targetWorkerServiceName?: string;
    targetWorkerHostname?: string;
    retriedFromJobId?: string;
  }): Promise<ScrapeJobResult | null> {
    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);
    const raw = await client.get(this.getCacheKey(input.fingerprint));

    if (!raw) {
      return null;
    }

    let cached: CachedScrapeEntry;
    try {
      cached = JSON.parse(raw) as CachedScrapeEntry;
    } catch {
      return null;
    }

    return {
      jobId: input.jobId,
      status: 'completed',
      progress: 100,
      stage: 'completed',
      url: input.url,
      strategy: input.strategy,
      requestedAt: input.requestedAt,
      completedAt: cached.completedAt,
      content: cached.content,
      preview: cached.preview,
      contentType: cached.contentType,
      method: cached.method,
      responseTimeMs: cached.responseTimeMs,
      retries: cached.retries,
      cached: true,
      targetWorkerId: input.targetWorkerId,
      targetWorkerServiceName: input.targetWorkerServiceName,
      targetWorkerHostname: input.targetWorkerHostname,
      retriedFromJobId: input.retriedFromJobId,
      webhookUrl: input.webhookUrl,
      idempotencyKey: input.idempotencyKey,
    };
  }
}
