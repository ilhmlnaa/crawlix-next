import { Injectable, NotFoundException } from '@nestjs/common';
import { getApiRuntimeConfig } from '@repo/config';
import {
  DEFAULT_JOB_STATUS,
  type CreateScrapeJobInput,
  type EnqueueJobResponse,
  type JobsDashboardSnapshot,
  type JobsPageSnapshot,
  type JobsOverviewSnapshot,
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

@Injectable()
export class JobsService {
  constructor(
    private readonly jobStore: JobStoreService,
    private readonly publisher: QueuePublisherService,
    private readonly workerRegistry: WorkerRegistryService,
    private readonly webhookEvents: WebhookEventService,
  ) {}

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

  async getOverviewSnapshot(): Promise<JobsOverviewSnapshot> {
    const config = getApiRuntimeConfig();
    const [{ recentJobs, total, statusCounts }, workers] = await Promise.all([
      this.jobStore.getOverviewData(config.redis.jobIndexMaxRecords),
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
  }

  async listWorkers(): Promise<WorkerHeartbeat[]> {
    return this.workerRegistry.listWorkers();
  }
}
