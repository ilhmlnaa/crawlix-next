import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ScraperService } from '@repo/scraper';
import type { ScrapeJobMessage } from '@repo/queue-contracts';
import { JobStoreService } from './job-store.service';
import { ScrapeCacheService } from './scrape-cache.service';
import { WorkerHeartbeatService } from './worker-heartbeat.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

@Injectable()
export class JobProcessorService implements OnModuleDestroy {
  private readonly scraper = new ScraperService();

  constructor(
    private readonly jobStore: JobStoreService,
    private readonly scrapeCache: ScrapeCacheService,
    private readonly workerHeartbeat: WorkerHeartbeatService,
    private readonly webhookDispatcher: WebhookDispatcherService,
  ) {}

  async process(job: ScrapeJobMessage): Promise<void> {
    const record = await this.jobStore.getRecord(job.jobId);

    if (record?.status === 'cancelled') {
      await this.jobStore.saveResult({
        jobId: job.jobId,
        status: 'cancelled',
        progress: 100,
        stage: 'completed',
        url: job.url,
        strategy: job.strategy,
        requestedAt: job.requestedAt,
        completedAt: new Date().toISOString(),
        targetWorkerId: job.targetWorkerId,
        retriedFromJobId: job.retriedFromJobId,
        webhookUrl: job.webhookUrl,
        idempotencyKey: job.idempotencyKey,
        error: 'Job was cancelled before processing started.',
      });
      await this.webhookDispatcher.enqueueFromResult(
        {
          jobId: job.jobId,
          status: 'cancelled',
          progress: 100,
          stage: 'completed',
          url: job.url,
          strategy: job.strategy,
          requestedAt: job.requestedAt,
          completedAt: new Date().toISOString(),
          targetWorkerId: job.targetWorkerId,
          retriedFromJobId: job.retriedFromJobId,
          webhookUrl: job.webhookUrl,
          idempotencyKey: job.idempotencyKey,
          error: 'Job was cancelled before processing started.',
        },
        job.webhookSecret,
      );
      return;
    }

    await this.workerHeartbeat.markProcessing(job.jobId);
    await this.jobStore.updateStatus(job.jobId, 'processing');
    await this.jobStore.updateProgress(job.jobId, 5, 'fetching');

    try {
      const cachedResult =
        job.options.useCache === false ? null : await this.scrapeCache.get(job);
      if (cachedResult) {
        await this.jobStore.updateProgress(job.jobId, 100, 'completed');
      }

      const executionResult =
        cachedResult ??
        (await this.scraper.execute(job, {
          onStageChange: async (stage, progress) => {
            await this.jobStore.updateProgress(job.jobId, progress, stage);
          },
        }));

      const result = {
        ...executionResult,
        targetWorkerId: job.targetWorkerId,
        retriedFromJobId: job.retriedFromJobId,
        webhookUrl: job.webhookUrl,
        idempotencyKey: job.idempotencyKey,
      };

      if (result.status !== 'completed') {
        throw new Error(
          result.error ?? 'Scrape job did not complete successfully.',
        );
      }

      await this.jobStore.updateStatus(job.jobId, result.status, result.error);
      await this.jobStore.updateProgress(
        job.jobId,
        100,
        'completed',
        result.error,
      );
      await this.jobStore.saveResult(result);
      await this.webhookDispatcher.enqueueFromResult(result, job.webhookSecret);

      if (result.status === 'completed' && !result.cached) {
        await this.scrapeCache.set(job, result);
      }

      await this.workerHeartbeat.markIdle(true);
    } catch (error) {
      await this.workerHeartbeat.markIdle(false);
      throw error;
    }
  }

  getRuntimeStats() {
    return this.scraper.getRuntimeStats();
  }

  async onModuleDestroy() {
    await this.scraper.dispose();
  }
}
