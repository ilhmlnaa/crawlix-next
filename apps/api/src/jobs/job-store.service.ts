import { Injectable } from '@nestjs/common';
import { getApiRuntimeConfig } from '@repo/config';
import type {
  ScrapeJobRecord,
  ScrapeJobResult,
  ScrapeJobStatus,
} from '@repo/queue-contracts';
import { createJobKeys, createJobsIndexKey } from '@repo/shared';
import { RedisService } from '../infrastructure/redis.service';

@Injectable()
export class JobStoreService {
  constructor(private readonly redisService: RedisService) {}

  private get config() {
    return getApiRuntimeConfig();
  }

  private getKeys(jobId: string) {
    return createJobKeys(this.config.redis.jobPrefix, jobId);
  }

  private get indexKey() {
    return createJobsIndexKey(this.config.redis.jobPrefix);
  }

  async saveRecord(record: ScrapeJobRecord): Promise<void> {
    const client = this.redisService.getClient();
    const keys = this.getKeys(record.jobId);
    await client.connect().catch(() => undefined);
    await client.set(keys.record, JSON.stringify(record));
    await client.lrem(this.indexKey, 0, record.jobId);
    await client.lpush(this.indexKey, record.jobId);
    await client.ltrim(this.indexKey, 0, 49);
  }

  async saveResult(result: ScrapeJobResult): Promise<void> {
    const client = this.redisService.getClient();
    const keys = this.getKeys(result.jobId);
    await client.connect().catch(() => undefined);
    await client.set(
      keys.result,
      JSON.stringify(result),
      'EX',
      this.config.redis.resultTtlSeconds,
    );
  }

  async getRecord(jobId: string): Promise<ScrapeJobRecord | null> {
    const client = this.redisService.getClient();
    const keys = this.getKeys(jobId);
    await client.connect().catch(() => undefined);
    const value = await client.get(keys.record);
    return value ? (JSON.parse(value) as ScrapeJobRecord) : null;
  }

  async getResult(jobId: string): Promise<ScrapeJobResult | null> {
    const client = this.redisService.getClient();
    const keys = this.getKeys(jobId);
    await client.connect().catch(() => undefined);
    const value = await client.get(keys.result);
    return value ? (JSON.parse(value) as ScrapeJobResult) : null;
  }

  async deleteResult(jobId: string): Promise<void> {
    const client = this.redisService.getClient();
    const keys = this.getKeys(jobId);
    await client.connect().catch(() => undefined);
    await client.del(keys.result);
  }

  async updateStatus(
    jobId: string,
    status: ScrapeJobStatus,
    error?: string,
  ): Promise<ScrapeJobRecord | null> {
    const existing = await this.getRecord(jobId);
    if (!existing) {
      return null;
    }

    const updated: ScrapeJobRecord = {
      ...existing,
      status,
      error,
      updatedAt: new Date().toISOString(),
    };

    await this.saveRecord(updated);
    return updated;
  }

  async listRecords(limit = 20): Promise<ScrapeJobRecord[]> {
    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);
    const jobIds = await client.lrange(this.indexKey, 0, limit - 1);
    const records = await Promise.all(jobIds.map((jobId) => this.getRecord(jobId)));
    return records.filter((record): record is ScrapeJobRecord => Boolean(record));
  }
}
