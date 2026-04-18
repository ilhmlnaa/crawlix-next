import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { getWorkerRuntimeConfig } from '@repo/config';
import { ScraperService } from '@repo/scraper';
import { resolveProxySettings } from '@repo/scraper';
import type { ScrapeJobMessage } from '@repo/queue-contracts';
import { JobStoreService } from './job-store.service';
import { ScrapeCacheService } from './scrape-cache.service';
import { WorkerHeartbeatService } from './worker-heartbeat.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';

@Injectable()
export class JobProcessorService implements OnModuleDestroy {
  private readonly scraper = new ScraperService();
  private readonly logger = new Logger(JobProcessorService.name);

  constructor(
    private readonly jobStore: JobStoreService,
    private readonly scrapeCache: ScrapeCacheService,
    private readonly workerHeartbeat: WorkerHeartbeatService,
    private readonly webhookDispatcher: WebhookDispatcherService,
  ) {}

  async process(job: ScrapeJobMessage): Promise<void> {
    const startedAt = Date.now();
    const record = await this.jobStore.getRecord(job.jobId);
    this.logger.log(
      JSON.stringify({
        event: 'job.processing.started',
        jobId: job.jobId,
        workerId: this.workerHeartbeat.getWorkerId(),
        targetWorkerId: job.targetWorkerId ?? null,
        url: job.url,
        strategy: job.strategy,
        requestedAt: job.requestedAt,
      }),
    );

    if (record?.status === 'cancelled') {
      this.logger.warn(
        JSON.stringify({
          event: 'job.processing.skipped',
          reason: 'cancelled_before_start',
          jobId: job.jobId,
          workerId: this.workerHeartbeat.getWorkerId(),
          targetWorkerId: job.targetWorkerId ?? null,
        }),
      );
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
        executedWorkerId: this.workerHeartbeat.getWorkerId(),
        executedServiceName: this.workerHeartbeat.getServiceName(),
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
          executedWorkerId: this.workerHeartbeat.getWorkerId(),
          executedServiceName: this.workerHeartbeat.getServiceName(),
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
    const proxySettings = resolveProxySettings(
      job.options,
      getWorkerRuntimeConfig().scraper,
    );
    await this.jobStore.patchRecord(job.jobId, {
      proxyEnabled: proxySettings.enabled,
      proxyUrl: proxySettings.proxyUrl,
    });

    try {
      const cachedResult =
        job.options.useCache === false ? null : await this.scrapeCache.get(job);
      this.logger.log(
        JSON.stringify({
          event: cachedResult ? 'scraper.cache.hit' : 'scraper.cache.miss',
          jobId: job.jobId,
          workerId: this.workerHeartbeat.getWorkerId(),
          targetWorkerId: job.targetWorkerId ?? null,
          strategy: job.strategy,
        }),
      );
      if (cachedResult) {
        await this.jobStore.updateProgress(job.jobId, 100, 'completed');
      }

      const executionResult =
        cachedResult ??
        (await this.scraper.execute(job, {
          onStageChange: async (stage, progress) => {
            await this.jobStore.updateProgress(job.jobId, progress, stage);
          },
          onEvent: async (event) => {
            switch (event.type) {
              case 'stage':
                this.logger.log(
                  JSON.stringify({
                    event: 'job.stage.changed',
                    jobId: job.jobId,
                    workerId: this.workerHeartbeat.getWorkerId(),
                    targetWorkerId: job.targetWorkerId ?? null,
                    stage: event.stage,
                    progress: event.progress,
                  }),
                );
                break;
              case 'strategy_selected':
                this.logger.log(
                  JSON.stringify({
                    event: 'scraper.strategy.selected',
                    jobId: job.jobId,
                    workerId: this.workerHeartbeat.getWorkerId(),
                    requestedStrategy: event.requestedStrategy,
                    strategy: event.strategy,
                  }),
                );
                break;
              case 'attempt_started':
                this.logger.log(
                  JSON.stringify({
                    event: 'job.attempt.started',
                    jobId: job.jobId,
                    workerId: this.workerHeartbeat.getWorkerId(),
                    strategy: event.strategy,
                    attempt: event.attempt,
                    maxRetries: event.maxRetries,
                  }),
                );
                break;
              case 'strategy_succeeded':
                this.logger.log(
                  JSON.stringify({
                    event: 'scraper.strategy.succeeded',
                    jobId: job.jobId,
                    workerId: this.workerHeartbeat.getWorkerId(),
                    strategy: event.strategy,
                    attempt: event.attempt,
                    method: event.method,
                    responseTimeMs: event.responseTimeMs,
                  }),
                );
                break;
              case 'strategy_failed':
                this.logger.warn(
                  JSON.stringify({
                    event: 'scraper.strategy.failed',
                    jobId: job.jobId,
                    workerId: this.workerHeartbeat.getWorkerId(),
                    strategy: event.strategy,
                    attempt: event.attempt,
                    method: event.method ?? null,
                    error: event.error ?? 'Unknown scrape error',
                  }),
                );
                break;
              case 'fallback_started': {
                const reason =
                  'reason' in event && typeof event.reason === 'string'
                    ? event.reason
                    : null;
                this.logger.warn(
                  JSON.stringify({
                    event: 'scraper.strategy.fallback',
                    jobId: job.jobId,
                    workerId: this.workerHeartbeat.getWorkerId(),
                    from: event.from,
                    to: event.to,
                    attempt: event.attempt,
                    reason,
                  }),
                );
                break;
              }
              case 'retry_scheduled':
                this.logger.warn(
                  JSON.stringify({
                    event: 'job.retry.scheduled',
                    jobId: job.jobId,
                    workerId: this.workerHeartbeat.getWorkerId(),
                    attempt: event.attempt,
                    nextAttempt: event.nextAttempt,
                    delayMs: event.delayMs,
                  }),
                );
                break;
            }
          },
        }));

      if (
        job.strategy === 'playwright' &&
        executionResult.status === 'completed' &&
        executionResult.method?.includes('http-fallback')
      ) {
        throw new Error(
          'Playwright strict mode: HTTP fallback is disabled for strategy=playwright.',
        );
      }

      const result = {
        ...executionResult,
        proxyEnabled: proxySettings.enabled,
        proxyUrl: proxySettings.proxyUrl,
        targetWorkerId: job.targetWorkerId,
        executedWorkerId: this.workerHeartbeat.getWorkerId(),
        executedServiceName: this.workerHeartbeat.getServiceName(),
        retriedFromJobId: job.retriedFromJobId,
        webhookUrl: job.webhookUrl,
        idempotencyKey: job.idempotencyKey,
      };

      if (result.status !== 'completed') {
        await this.jobStore.updateStatus(
          job.jobId,
          result.status,
          result.error,
        );
        await this.jobStore.updateProgress(
          job.jobId,
          100,
          'completed',
          result.error,
        );
        await this.jobStore.saveResult(result);
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

      this.logger.log(
        JSON.stringify({
          event: 'job.processing.completed',
          jobId: job.jobId,
          workerId: this.workerHeartbeat.getWorkerId(),
          targetWorkerId: job.targetWorkerId ?? null,
          strategy: result.strategy,
          cached: result.cached ?? false,
          method: result.method ?? null,
          responseTimeMs: result.responseTimeMs ?? null,
          durationMs: Date.now() - startedAt,
        }),
      );

      await this.workerHeartbeat.markIdle(true);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown processing error';
      this.logger.error(
        JSON.stringify({
          event: 'job.processing.failed',
          jobId: job.jobId,
          workerId: this.workerHeartbeat.getWorkerId(),
          targetWorkerId: job.targetWorkerId ?? null,
          strategy: job.strategy,
          durationMs: Date.now() - startedAt,
          error: message,
        }),
      );
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
