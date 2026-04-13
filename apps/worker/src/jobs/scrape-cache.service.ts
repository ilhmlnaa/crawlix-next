import { Injectable } from '@nestjs/common';
import type { ScrapeJobMessage, ScrapeJobResult } from '@repo/queue-contracts';
import { getWorkerRuntimeConfig } from '@repo/config';
import { createScrapeCacheKey } from '@repo/shared';
import { RedisService } from '../infrastructure/redis.service';

interface CachedScrapeEntry {
  content: string;
  preview?: string;
  contentType?: string;
  method?: string;
  responseTimeMs?: number;
  retries?: number;
  strategy: ScrapeJobMessage['strategy'];
  completedAt: string;
}

@Injectable()
export class ScrapeCacheService {
  constructor(private readonly redisService: RedisService) {}

  private get config() {
    return getWorkerRuntimeConfig();
  }

  private getCacheKey(fingerprint: string): string {
    return createScrapeCacheKey(this.config.redis.jobPrefix, fingerprint);
  }

  async get(job: ScrapeJobMessage): Promise<ScrapeJobResult | null> {
    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);
    const raw = await client.get(this.getCacheKey(job.fingerprint));

    if (!raw) {
      return null;
    }

    const cached = JSON.parse(raw) as CachedScrapeEntry;

    return {
      jobId: job.jobId,
      status: 'completed',
      progress: 100,
      stage: 'completed',
      url: job.url,
      strategy: job.strategy,
      requestedAt: job.requestedAt,
      completedAt: cached.completedAt,
      content: cached.content,
      preview: cached.preview,
      contentType: cached.contentType,
      method: cached.method,
      responseTimeMs: cached.responseTimeMs,
      retries: cached.retries,
      cached: true,
      webhookUrl: job.webhookUrl,
      idempotencyKey: job.idempotencyKey,
    };
  }

  async set(job: ScrapeJobMessage, result: ScrapeJobResult): Promise<void> {
    if (!result.content) {
      return;
    }

    const ttl =
      job.options.cacheTtlSeconds ?? this.config.scraper.defaultCacheTtlSeconds;

    const cacheEntry: CachedScrapeEntry = {
      content: result.content,
      preview: result.preview,
      contentType: result.contentType,
      method: result.method,
      responseTimeMs: result.responseTimeMs,
      retries: result.retries,
      strategy: result.strategy,
      completedAt: result.completedAt ?? new Date().toISOString(),
    };

    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);
    await client.set(
      this.getCacheKey(job.fingerprint),
      JSON.stringify(cacheEntry),
      'EX',
      ttl,
    );
  }
}
