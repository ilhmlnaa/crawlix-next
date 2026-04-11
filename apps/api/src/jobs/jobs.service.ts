import { Injectable, NotFoundException } from '@nestjs/common';
import { getApiRuntimeConfig } from '@repo/config';
import {
  DEFAULT_JOB_STATUS,
  type CreateScrapeJobInput,
  type EnqueueJobResponse,
  type JobsDashboardSnapshot,
  type JobsOverviewSnapshot,
  type ScrapeJobMessage,
  type ScrapeJobRecord,
  type WorkerHeartbeat,
} from '@repo/queue-contracts';
import {
  createJobId,
  createQueueFingerprint,
  nowIso,
} from '@repo/shared';
import { JobStoreService } from './job-store.service';
import { QueuePublisherService } from '../infrastructure/queue-publisher.service';
import { WorkerRegistryService } from './worker-registry.service';

@Injectable()
export class JobsService {
  constructor(
    private readonly jobStore: JobStoreService,
    private readonly publisher: QueuePublisherService,
    private readonly workerRegistry: WorkerRegistryService,
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
      requestedAt,
      updatedAt: requestedAt,
      fingerprint,
      targetWorkerId,
      retriedFromJobId,
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
    };

    await this.jobStore.saveRecord(record);
    await this.publisher.publish(message);

    return {
      jobId,
      status: DEFAULT_JOB_STATUS,
      queuedAt: requestedAt,
      resultTtlSeconds: config.redis.resultTtlSeconds,
      targetWorkerId,
      retriedFromJobId,
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

    await this.jobStore.updateStatus(jobId, 'cancelled');
    await this.jobStore.deleteResult(jobId);
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

  async getOverviewSnapshot(): Promise<JobsOverviewSnapshot> {
    const recentJobs = await this.jobStore.listRecords(50);
    const workers = await this.workerRegistry.listWorkers();
    const config = getApiRuntimeConfig();
    const queueStats = await this.publisher.getQueueStats().catch(() => ({
      messageCount: 0,
      consumerCount: 0,
      retryMessageCount: 0,
      deadLetterMessageCount: 0,
    }));

    const statusCounts = recentJobs.reduce<JobsOverviewSnapshot['statusCounts']>(
      (accumulator, job) => {
        accumulator[job.status] += 1;
        return accumulator;
      },
      {
        queued: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
      },
    );

    return {
      queueName: config.queue.queueName,
      total: recentJobs.length,
      statusCounts,
      queueDepth: queueStats.messageCount,
      consumerCount: queueStats.consumerCount,
      retryQueueDepth: queueStats.retryMessageCount,
      deadLetterQueueDepth: queueStats.deadLetterMessageCount,
      workers,
      recentJobs,
    };
  }

  async listWorkers(): Promise<WorkerHeartbeat[]> {
    return this.workerRegistry.listWorkers();
  }
}
