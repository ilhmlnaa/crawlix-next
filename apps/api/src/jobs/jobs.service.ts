import { Injectable, NotFoundException } from '@nestjs/common';
import { getApiRuntimeConfig } from '@repo/config';
import {
  DEFAULT_JOB_STATUS,
  type CreateScrapeJobInput,
  type EnqueueJobResponse,
  type JobsDashboardSnapshot,
  type JobsPageSnapshot,
  type JobsOverviewSnapshot,
  type JobsOverviewTimeSeriesSnapshot,
  type JobsOverviewTimeSeriesTimeframe,
  type ScrapeJobMessage,
  type ScrapeJobRecord,
  type WorkerHeartbeat,
} from '@repo/queue-contracts';
import { createJobId, createQueueFingerprint, nowIso } from '@repo/shared';
import { JobStoreService } from './job-store.service';
import { QueuePublisherService } from '../infrastructure/queue-publisher.service';
import { WorkerRegistryService } from './worker-registry.service';
import { WebhookEventService } from './webhook-event.service';

const MAX_PAGE_SIZE = 50;
const DEFAULT_PAGE_SIZE = 25;
const OVERVIEW_CACHE_TTL_MS = 5_000;
const DEFAULT_TIME_SERIES_LOOKBACK_BUCKETS = 30;
const MAX_TIME_SERIES_LOOKBACK_BUCKETS = 120;

type TimeSeriesSettings = {
  bucketMs: number;
  defaultLookbackBuckets: number;
};

type CachedValue<T> = {
  value: T;
  expiresAt: number;
};

@Injectable()
export class JobsService {
  private readonly overviewCache = new Map<string, CachedValue<unknown>>();

  constructor(
    private readonly jobStore: JobStoreService,
    private readonly publisher: QueuePublisherService,
    private readonly workerRegistry: WorkerRegistryService,
    private readonly webhookEvents: WebhookEventService,
  ) {}

  private invalidateOverviewCache() {
    this.overviewCache.clear();
  }

  private pruneOverviewCache() {
    const now = Date.now();
    this.overviewCache.forEach((entry, key) => {
      if (entry.expiresAt <= now) {
        this.overviewCache.delete(key);
      }
    });
  }

  private async getOrSetOverviewCache<T>(
    key: string,
    compute: () => Promise<T>,
  ): Promise<T> {
    this.pruneOverviewCache();
    const cached = this.overviewCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }

    const value = await compute();
    this.overviewCache.set(key, {
      value,
      expiresAt: Date.now() + OVERVIEW_CACHE_TTL_MS,
    });
    return value;
  }

  private getTimeSeriesSettings(
    timeframe: JobsOverviewTimeSeriesTimeframe,
  ): TimeSeriesSettings {
    if (timeframe === 'hour') {
      return {
        bucketMs: 3_600_000,
        defaultLookbackBuckets: 24,
      };
    }

    if (timeframe === '12h') {
      return {
        bucketMs: 12 * 3_600_000,
        defaultLookbackBuckets: 14,
      };
    }

    return {
      bucketMs: 86_400_000,
      defaultLookbackBuckets: DEFAULT_TIME_SERIES_LOOKBACK_BUCKETS,
    };
  }

  private getBucketStart(
    date: Date,
    timeframe: JobsOverviewTimeSeriesTimeframe,
  ): Date {
    const bucket = new Date(date);
    if (timeframe === 'hour') {
      bucket.setMinutes(0, 0, 0);
      return bucket;
    }

    if (timeframe === '12h') {
      bucket.setMinutes(0, 0, 0);
      bucket.setHours(bucket.getHours() < 12 ? 0 : 12);
      return bucket;
    }

    bucket.setHours(0, 0, 0, 0);
    return bucket;
  }

  async enqueue(input: CreateScrapeJobInput): Promise<EnqueueJobResponse> {
    return this.enqueueFromInput(input);
  }

  private async enqueueFromInput(
    input: CreateScrapeJobInput,
    retriedFromJobId?: string,
  ): Promise<EnqueueJobResponse> {
    const config = getApiRuntimeConfig();
    const requestedAt = nowIso();
    const strategy = input.strategy ?? config.scraper.defaultStrategy;
    const options = {
      useCache: true,
      maxRetries: config.scraper.maxRetries,
      retryDelayMs: config.scraper.retryDelayMs,
      timeoutMs: config.scraper.defaultTimeoutMs,
      cacheTtlSeconds: config.scraper.defaultCacheTtlSeconds,
      ...input.options,
    };
    const jobId = createJobId();
    const fingerprint = createQueueFingerprint(input.url, strategy, options);
    const targetWorkerId = input.targetWorkerId?.trim() || undefined;
    const webhookUrl = input.webhookUrl?.trim() || undefined;
    const webhookSecret = input.webhookSecret?.trim() || undefined;
    const idempotencyKey = input.idempotencyKey?.trim() || undefined;

    if (idempotencyKey) {
      const existing = await this.jobStore.getIdempotentJob(idempotencyKey);
      if (existing) {
        return {
          jobId: existing.jobId,
          status: existing.status,
          progress: existing.progress,
          stage: existing.stage,
          queuedAt: existing.requestedAt,
          resultTtlSeconds: config.redis.resultTtlSeconds,
          targetWorkerId: existing.targetWorkerId,
          retriedFromJobId: existing.retriedFromJobId,
          webhookUrl: existing.webhookUrl,
          idempotencyKey: existing.idempotencyKey,
        };
      }
    }

    if (targetWorkerId) {
      const worker = await this.workerRegistry.getWorkerById(targetWorkerId);
      if (!worker) {
        throw new NotFoundException(
          `Target worker "${targetWorkerId}" is not active`,
        );
      }
    }

    const record: ScrapeJobRecord = {
      jobId,
      url: input.url,
      strategy,
      options,
      status: DEFAULT_JOB_STATUS,
      progress: 0,
      stage: 'queued',
      requestedAt,
      updatedAt: requestedAt,
      fingerprint,
      targetWorkerId,
      retriedFromJobId,
      webhookUrl,
      webhookSecret,
      idempotencyKey,
    };

    const message: ScrapeJobMessage = {
      jobId,
      url: input.url,
      strategy,
      options,
      requestedAt,
      fingerprint,
      targetWorkerId,
      retriedFromJobId,
      webhookUrl,
      webhookSecret,
      idempotencyKey,
    };

    await this.jobStore.saveRecord(record);
    if (idempotencyKey) {
      await this.jobStore.saveIdempotentJob(idempotencyKey, jobId);
    }
    await this.publisher.publish(message);
    this.invalidateOverviewCache();

    return {
      jobId,
      status: DEFAULT_JOB_STATUS,
      progress: 0,
      stage: 'queued',
      queuedAt: requestedAt,
      resultTtlSeconds: config.redis.resultTtlSeconds,
      targetWorkerId,
      retriedFromJobId,
      webhookUrl,
      idempotencyKey,
    };
  }

  async retry(jobId: string): Promise<EnqueueJobResponse | null> {
    const existing = await this.jobStore.getRecord(jobId);

    if (!existing) {
      return null;
    }

    return this.enqueueFromInput(
      {
        url: existing.url,
        strategy: existing.strategy,
        options: existing.options,
        targetWorkerId: existing.targetWorkerId,
        webhookUrl: existing.webhookUrl,
        webhookSecret: existing.webhookSecret,
      },
      existing.jobId,
    );
  }

  async cancel(jobId: string) {
    const existing = await this.jobStore.getRecord(jobId);

    if (!existing) {
      return null;
    }

    if (existing.status !== 'queued') {
      return existing;
    }

    const updated = await this.jobStore.updateStatus(jobId, 'cancelled');
    await this.jobStore.updateProgress(jobId, 100, 'completed', existing.error);
    const completedAt = nowIso();
    await this.jobStore.saveResult({
      jobId: existing.jobId,
      status: 'cancelled',
      progress: 100,
      stage: 'completed',
      url: existing.url,
      strategy: existing.strategy,
      requestedAt: existing.requestedAt,
      completedAt,
      targetWorkerId: existing.targetWorkerId,
      retriedFromJobId: existing.retriedFromJobId,
      webhookUrl: existing.webhookUrl,
      idempotencyKey: existing.idempotencyKey,
      error: 'Job was cancelled before processing started.',
    });
    if (updated?.webhookUrl) {
      await this.webhookEvents.publishFromResult(
        {
          jobId: existing.jobId,
          status: 'cancelled',
          progress: 100,
          stage: 'completed',
          url: existing.url,
          strategy: existing.strategy,
          requestedAt: existing.requestedAt,
          completedAt,
          targetWorkerId: existing.targetWorkerId,
          retriedFromJobId: existing.retriedFromJobId,
          webhookUrl: existing.webhookUrl,
          idempotencyKey: existing.idempotencyKey,
          error: 'Job was cancelled before processing started.',
        },
        existing.webhookSecret,
      );
    }
    this.invalidateOverviewCache();
    return this.jobStore.getRecord(jobId);
  }

  async getJob(jobId: string) {
    return this.jobStore.getRecord(jobId);
  }

  async getResult(jobId: string) {
    return this.jobStore.getResult(jobId);
  }

  async getDashboardSnapshot(): Promise<JobsDashboardSnapshot> {
    const jobs = await this.jobStore.listRecords(20);
    const config = getApiRuntimeConfig();

    return {
      jobs,
      queueName: config.queue.queueName,
      total: jobs.length,
    };
  }

  async getPaginatedJobs(
    pageInput?: number,
    pageSizeInput?: number,
  ): Promise<JobsPageSnapshot> {
    const page =
      Number.isInteger(pageInput) && (pageInput as number) > 0
        ? (pageInput as number)
        : 1;
    const pageSize =
      Number.isInteger(pageSizeInput) && (pageSizeInput as number) > 0
        ? Math.min(pageSizeInput as number, MAX_PAGE_SIZE)
        : DEFAULT_PAGE_SIZE;

    const offset = (page - 1) * pageSize;
    const [total, jobs] = await Promise.all([
      this.jobStore.countRecords(),
      this.jobStore.listRecords(pageSize, offset),
    ]);

    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 1;

    return {
      jobs,
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  async getOverviewSnapshot(
    recentLimit?: number,
  ): Promise<JobsOverviewSnapshot> {
    const cacheKey = `overview:${recentLimit ?? 'all'}`;
    return this.getOrSetOverviewCache(cacheKey, async () => {
      const config = getApiRuntimeConfig();
      const [{ recentJobs, total, statusCounts }, workers] = await Promise.all([
        this.jobStore.getOverviewData(recentLimit),
        this.workerRegistry.listWorkers(),
      ]);
      const queueStats = await this.publisher.getQueueStats().catch(() => ({
        messageCount: 0,
        consumerCount: 0,
        retryMessageCount: 0,
        deadLetterMessageCount: 0,
        webhookMessageCount: 0,
        webhookRetryMessageCount: 0,
        webhookDeadLetterMessageCount: 0,
      }));

      return {
        queueName: config.queue.queueName,
        total,
        statusCounts,
        queueDepth: queueStats.messageCount,
        consumerCount: queueStats.consumerCount,
        retryQueueDepth: queueStats.retryMessageCount,
        deadLetterQueueDepth: queueStats.deadLetterMessageCount,
        webhookQueueDepth: queueStats.webhookMessageCount,
        webhookRetryQueueDepth: queueStats.webhookRetryMessageCount,
        webhookDeadLetterQueueDepth: queueStats.webhookDeadLetterMessageCount,
        workers,
        recentJobs,
      };
    });
  }

  async getOverviewTimeSeries(
    timeframe: JobsOverviewTimeSeriesTimeframe,
    lookbackBuckets?: number,
  ): Promise<JobsOverviewTimeSeriesSnapshot> {
    const settings = this.getTimeSeriesSettings(timeframe);
    const safeLookbackBuckets = Number.isFinite(lookbackBuckets)
      ? Math.min(
          MAX_TIME_SERIES_LOOKBACK_BUCKETS,
          Math.max(1, Math.floor(lookbackBuckets as number)),
        )
      : settings.defaultLookbackBuckets;
    const cacheKey = `overview:timeseries:${timeframe}:${safeLookbackBuckets}`;

    return this.getOrSetOverviewCache(cacheKey, async () => {
      const config = getApiRuntimeConfig();
      const { recentJobs } = await this.jobStore.getOverviewData();
      const endBucket = this.getBucketStart(new Date(), timeframe);
      const startBucket = new Date(
        endBucket.getTime() - (safeLookbackBuckets - 1) * settings.bucketMs,
      );

      const grouped = new Map<
        string,
        {
          timeKey: string;
          bucketStart: string;
          dispatched: number;
          completed: number;
          failed: number;
        }
      >();

      for (
        let cursor = new Date(startBucket);
        cursor <= endBucket;
        cursor = new Date(cursor.getTime() + settings.bucketMs)
      ) {
        const bucketStartIso = cursor.toISOString();
        const timeKey = `${cursor.getTime()}`;
        grouped.set(timeKey, {
          timeKey,
          bucketStart: bucketStartIso,
          dispatched: 0,
          completed: 0,
          failed: 0,
        });
      }

      recentJobs.forEach((job) => {
        const date = new Date(job.updatedAt || job.requestedAt);
        if (Number.isNaN(date.getTime())) {
          return;
        }

        const bucketStart = this.getBucketStart(date, timeframe);
        const timeKey = `${bucketStart.getTime()}`;
        const entry = grouped.get(timeKey);
        if (!entry) {
          return;
        }

        entry.dispatched += 1;
        if (job.status === 'completed') {
          entry.completed += 1;
        }
        if (job.status === 'failed') {
          entry.failed += 1;
        }
      });

      return {
        queueName: config.queue.queueName,
        timeframe,
        bucketMs: settings.bucketMs,
        lookbackMs: safeLookbackBuckets * settings.bucketMs,
        lookbackBuckets: safeLookbackBuckets,
        generatedAt: nowIso(),
        totalJobsConsidered: recentJobs.length,
        buckets: Array.from(grouped.values()),
      };
    });
  }

  async listWorkers(): Promise<WorkerHeartbeat[]> {
    return this.workerRegistry.listWorkers();
  }
}
