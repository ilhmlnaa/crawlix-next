import { Injectable } from '@nestjs/common';
import { getApiRuntimeConfig } from '@repo/config';
import type {
  ScrapeJobStage,
  ScrapeJobRecord,
  ScrapeJobResult,
  ScrapeJobStatus,
} from '@repo/queue-contracts';
import {
  createIdempotencyKeys,
  createJobKeys,
  createJobsIndexKey,
} from '@repo/shared';
import { RedisService } from '../infrastructure/redis.service';

type JobStatusCounts = Record<ScrapeJobStatus, number>;

function createEmptyStatusCounts(): JobStatusCounts {
  return {
    queued: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    cancelled: 0,
    timeout: 0,
  };
}

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

  private getIdempotencyKey(idempotencyKey: string) {
    return createIdempotencyKeys(this.config.redis.jobPrefix, idempotencyKey)
      .request;
  }

  async saveRecord(record: ScrapeJobRecord): Promise<void> {
    const client = this.redisService.getClient();
    const keys = this.getKeys(record.jobId);
    await client.connect().catch(() => undefined);
    await client.set(keys.record, JSON.stringify(record));
    await client.lrem(this.indexKey, 0, record.jobId);
    await client.lpush(this.indexKey, record.jobId);
    await client.ltrim(
      this.indexKey,
      0,
      this.config.redis.jobIndexMaxRecords - 1,
    );
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

  async getIdempotentJob(
    idempotencyKey: string,
  ): Promise<ScrapeJobRecord | null> {
    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);
    const jobId = await client.get(this.getIdempotencyKey(idempotencyKey));
    return jobId ? this.getRecord(jobId) : null;
  }

  async saveIdempotentJob(
    idempotencyKey: string,
    jobId: string,
  ): Promise<void> {
    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);
    await client.set(
      this.getIdempotencyKey(idempotencyKey),
      jobId,
      'EX',
      this.config.redis.resultTtlSeconds,
    );
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

  async updateProgress(
    jobId: string,
    progress: number,
    stage: ScrapeJobStage,
    error?: string,
  ): Promise<ScrapeJobRecord | null> {
    const existing = await this.getRecord(jobId);
    if (!existing) {
      return null;
    }

    const updated: ScrapeJobRecord = {
      ...existing,
      progress,
      stage,
      error,
      updatedAt: new Date().toISOString(),
    };

    await this.saveRecord(updated);
    return updated;
  }

  async listRecords(limit = 20, offset = 0): Promise<ScrapeJobRecord[]> {
    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);
    const safeLimit = Math.max(1, Math.floor(limit));
    const safeOffset = Math.max(0, Math.floor(offset));
    const jobIds = await client.lrange(
      this.indexKey,
      safeOffset,
      safeOffset + safeLimit - 1,
    );
    if (jobIds.length === 0) {
      return [];
    }

    const recordKeys = jobIds.map((jobId) => this.getKeys(jobId).record);
    const rawRecords = await client.mget(recordKeys);

    return rawRecords
      .map((value) => {
        if (!value) {
          return null;
        }

        try {
          return JSON.parse(value) as ScrapeJobRecord;
        } catch {
          return null;
        }
      })
      .filter((record): record is ScrapeJobRecord => Boolean(record));
  }

  async countRecords(): Promise<number> {
    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);
    return client.llen(this.indexKey);
  }

  async getOverviewData(recentLimit = 50): Promise<{
    recentJobs: ScrapeJobRecord[];
    total: number;
    statusCounts: JobStatusCounts;
  }> {
    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);

    const safeRecentLimit = Math.max(1, Math.floor(recentLimit));
    const jobIds = await client.lrange(this.indexKey, 0, -1);
    const total = jobIds.length;

    if (total === 0) {
      return {
        recentJobs: [],
        total: 0,
        statusCounts: createEmptyStatusCounts(),
      };
    }

    const recordKeys = jobIds.map((jobId) => this.getKeys(jobId).record);
    const rawRecords = await client.mget(recordKeys);
    const statusCounts = createEmptyStatusCounts();
    const recentJobs: ScrapeJobRecord[] = [];

    rawRecords.forEach((value) => {
      if (!value) {
        return;
      }

      try {
        const record = JSON.parse(value) as ScrapeJobRecord;
        statusCounts[record.status] += 1;
        if (recentJobs.length < safeRecentLimit) {
          recentJobs.push(record);
        }
      } catch {
        // Ignore malformed records to keep overview endpoint resilient.
      }
    });

    return {
      recentJobs,
      total,
      statusCounts,
    };
  }
}
