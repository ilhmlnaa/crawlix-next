import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ScraperService } from '@repo/scraper';
import type { ScrapeJobMessage } from '@repo/queue-contracts';
import { JobStoreService } from './job-store.service';
import { ScrapeCacheService } from './scrape-cache.service';
import { WorkerHeartbeatService } from './worker-heartbeat.service';

@Injectable()
export class JobProcessorService implements OnModuleDestroy {
  private readonly scraper = new ScraperService();

  constructor(
    private readonly jobStore: JobStoreService,
    private readonly scrapeCache: ScrapeCacheService,
    private readonly workerHeartbeat: WorkerHeartbeatService,
  ) {}

  async process(job: ScrapeJobMessage): Promise<void> {
    const record = await this.jobStore.getRecord(job.jobId);

    if (record?.status === 'cancelled') {
      await this.jobStore.saveResult({
        jobId: job.jobId,
        status: 'cancelled',
        url: job.url,
        strategy: job.strategy,
        requestedAt: job.requestedAt,
        completedAt: new Date().toISOString(),
        retriedFromJobId: job.retriedFromJobId,
        error: 'Job was cancelled before processing started.',
      });
      return;
    }

    await this.workerHeartbeat.markProcessing(job.jobId);
    await this.jobStore.updateStatus(job.jobId, 'processing');

    try {
      const cachedResult =
        job.options.useCache === false ? null : await this.scrapeCache.get(job);
      const result = {
        ...(cachedResult ?? (await this.scraper.execute(job))),
        retriedFromJobId: job.retriedFromJobId,
      };

      if (result.status !== 'completed') {
        throw new Error(result.error ?? 'Scrape job did not complete successfully.');
      }

      await this.jobStore.updateStatus(job.jobId, result.status, result.error);
      await this.jobStore.saveResult(result);

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
