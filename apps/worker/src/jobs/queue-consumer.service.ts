import {
  Logger,
  Injectable,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import amqp, {
  type Channel,
  type ChannelModel,
  type ConsumeMessage,
} from 'amqplib';
import { getWorkerRuntimeConfig } from '@repo/config';
import type {
  RoutingStrategy,
  ScrapeJobMessage,
} from '@repo/queue-contracts';
import {
  createStrategyDeadLetterQueueName,
  createStrategyQueueName,
  createStrategyQueueNames,
  resolveRoutingStrategy,
} from '@repo/shared';
import { JobProcessorService } from './job-processor.service';
import { JobStoreService } from './job-store.service';
import { WorkerHeartbeatService } from './worker-heartbeat.service';
import { WebhookDispatcherService } from './webhook-dispatcher.service';
import {
  logJobFailure,
  logJobRetry,
  logQueueConsumerReady,
} from '../common/logging';

@Injectable()
export class QueueConsumerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(QueueConsumerService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private consuming = false;
  private subscribedQueues: string[] = [];

  constructor(
    private readonly processor: JobProcessorService,
    private readonly jobStore: JobStoreService,
    private readonly workerHeartbeat: WorkerHeartbeatService,
    private readonly webhookDispatcher: WebhookDispatcherService,
  ) {}

  private getRoutingQueues(
    strategy: ScrapeJobMessage['strategy'],
    targetWorkerId?: string,
  ) {
    const config = getWorkerRuntimeConfig();

    return createStrategyQueueNames(
      config.queue.queueName,
      resolveRoutingStrategy(strategy),
      targetWorkerId,
    );
  }

  private getSubscribedStrategies(): RoutingStrategy[] {
    return getWorkerRuntimeConfig().allowedStrategies;
  }

  private async processWithWatchdog(payload: ScrapeJobMessage): Promise<void> {
    let timeoutHandle: NodeJS.Timeout | null = null;
    const config = getWorkerRuntimeConfig();
    const watchdogTimeoutMs = config.processingWatchdogTimeoutMs;

    try {
      await Promise.race([
        this.processor.process(payload),
        new Promise<never>((_, reject) => {
          timeoutHandle = setTimeout(() => {
            reject(
              new Error(
                `Job processing watchdog timeout after ${watchdogTimeoutMs}ms.`,
              ),
            );
          }, watchdogTimeoutMs);
        }),
      ]);
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    }
  }

  async onApplicationBootstrap() {
    const config = getWorkerRuntimeConfig();
    let connection: ChannelModel;
    let channel: Channel;

    try {
      connection = await amqp.connect(config.queue.url);
      channel = await connection.createChannel();
    } catch (error) {
      const details =
        error instanceof Error ? error.message : 'Unknown AMQP error';
      throw new Error(
        `Unable to connect to RabbitMQ using RABBITMQ_URL=${config.queue.url}. Check the host, credentials, and ensure the port is AMQP (usually 5672, not 15672). Original error: ${details}`,
      );
    }

    const subscribedStrategies = this.getSubscribedStrategies();
    const subscribedQueues: string[] = [];

    await channel.assertQueue(config.queue.deadLetterQueueName, {
      durable: true,
    });
    for (const routingStrategy of subscribedStrategies) {
      const sharedQueues = createStrategyQueueNames(
        config.queue.queueName,
        routingStrategy,
      );
      const targetedQueues = createStrategyQueueNames(
        config.queue.queueName,
        routingStrategy,
        this.workerHeartbeat.getWorkerId(),
      );

      await channel.assertQueue(sharedQueues.queueName, { durable: true });
      await channel.assertQueue(sharedQueues.retryQueueName, {
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: sharedQueues.queueName,
      });
      await channel.assertQueue(sharedQueues.deadLetterQueueName, {
        durable: true,
      });
      await channel.assertQueue(targetedQueues.queueName, { durable: true });
      await channel.assertQueue(targetedQueues.retryQueueName, {
        durable: true,
        deadLetterExchange: '',
        deadLetterRoutingKey: targetedQueues.queueName,
      });
      await channel.assertQueue(targetedQueues.deadLetterQueueName, {
        durable: true,
      });

      subscribedQueues.push(sharedQueues.queueName, targetedQueues.queueName);
    }
    await channel.prefetch(config.workerConcurrency);

    for (const queueName of subscribedQueues) {
      await channel.consume(
        queueName,
        async (message: ConsumeMessage | null) => this.handleMessage(message),
        { noAck: false },
      );
    }

    this.connection = connection;
    this.channel = channel;
    this.consuming = true;
    this.subscribedQueues = subscribedQueues;

    logQueueConsumerReady(subscribedQueues.join(', '));
  }

  private async handleMessage(message: ConsumeMessage | null) {
    if (!message || !this.channel) {
      return;
    }

    const config = getWorkerRuntimeConfig();
    let payload: ScrapeJobMessage;

    try {
      payload = JSON.parse(message.content.toString()) as ScrapeJobMessage;
    } catch (error) {
      const parseError =
        error instanceof Error ? error.message : 'Invalid JSON payload';
      const rawBody = message.content.toString();

      this.channel.sendToQueue(
        config.queue.deadLetterQueueName,
        Buffer.from(
          JSON.stringify({
            deadLetterReason: `Malformed queue payload: ${parseError}`,
            rawBody,
            routingKey: message.fields?.routingKey,
            receivedAt: new Date().toISOString(),
          }),
        ),
        {
          persistent: true,
          headers: {
            'x-dead-letter-reason': 'malformed-payload',
          },
        },
      );

      this.channel.ack(message);
      this.logger.error(
        JSON.stringify({
          event: 'queue.message.malformed',
          workerId: this.workerHeartbeat.getWorkerId(),
          queueName: message.fields?.routingKey ?? config.queue.queueName,
          error: parseError,
        }),
      );
      return;
    }

    const currentAttempt =
      Number(message.properties.headers?.['x-delivery-attempt'] ?? 1) ||
      payload.deliveryAttempt ||
      1;
    const routingStrategy = resolveRoutingStrategy(payload.strategy);
    const routingQueues = this.getRoutingQueues(
      payload.strategy,
      payload.targetWorkerId,
    );

    this.logger.log(
      JSON.stringify({
        event: 'queue.message.received',
        jobId: payload.jobId,
        workerId: this.workerHeartbeat.getWorkerId(),
        targetWorkerId: payload.targetWorkerId ?? null,
        queueName: message.fields?.routingKey || routingQueues.queueName,
        attempt: currentAttempt,
        strategy: payload.strategy,
        routingStrategy,
      }),
    );

    try {
      await this.processWithWatchdog(payload);
      this.channel.ack(message);
      this.logger.log(
        JSON.stringify({
          event: 'queue.message.acked',
          jobId: payload.jobId,
          workerId: this.workerHeartbeat.getWorkerId(),
          targetWorkerId: payload.targetWorkerId ?? null,
          attempt: currentAttempt,
          routingStrategy,
        }),
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown processing error';

      if (currentAttempt < config.queue.maxDeliveryAttempts) {
        await this.jobStore.updateStatus(payload.jobId, 'queued', errorMessage);
        await this.jobStore.updateProgress(
          payload.jobId,
          0,
          'queued',
          errorMessage,
        );
        this.channel.sendToQueue(
          routingQueues.retryQueueName,
          Buffer.from(
            JSON.stringify({
              ...payload,
              deliveryAttempt: currentAttempt + 1,
            }),
          ),
          {
            persistent: true,
            expiration: String(config.queue.retryDelayMs),
            headers: {
              'x-delivery-attempt': currentAttempt + 1,
            },
          },
        );
        this.channel.ack(message);
        logJobRetry(
          payload.jobId,
          currentAttempt + 1,
          config.queue.maxDeliveryAttempts,
        );
        this.logger.warn(
          JSON.stringify({
            event: 'queue.message.requeued',
            jobId: payload.jobId,
            workerId: this.workerHeartbeat.getWorkerId(),
            targetWorkerId: payload.targetWorkerId ?? null,
            attempt: currentAttempt,
            nextAttempt: currentAttempt + 1,
            retryQueueName: routingQueues.retryQueueName,
            error: errorMessage,
            routingStrategy,
          }),
        );
        return;
      }

      await this.jobStore.updateStatus(payload.jobId, 'failed', errorMessage);
      await this.jobStore.updateProgress(
        payload.jobId,
        100,
        'completed',
        errorMessage,
      );
      const failedResult = {
        jobId: payload.jobId,
        status: 'failed',
        progress: 100,
        stage: 'completed',
        url: payload.url,
        strategy: payload.strategy,
        requestedAt: payload.requestedAt,
        completedAt: new Date().toISOString(),
        retries: currentAttempt - 1,
        targetWorkerId: payload.targetWorkerId,
        targetWorkerHostname: payload.targetWorkerHostname,
        retriedFromJobId: payload.retriedFromJobId,
        webhookUrl: payload.webhookUrl,
        idempotencyKey: payload.idempotencyKey,
        error: errorMessage,
      } as const;
      await this.jobStore.saveResult(failedResult);
      await this.webhookDispatcher.enqueueFromResult(
        failedResult,
        payload.webhookSecret,
      );
      this.channel.sendToQueue(
        routingQueues.deadLetterQueueName,
        Buffer.from(
          JSON.stringify({
            ...payload,
            deliveryAttempt: currentAttempt,
            deadLetterReason: errorMessage,
          }),
        ),
        {
          persistent: true,
          headers: {
            'x-delivery-attempt': currentAttempt,
            'x-dead-letter-reason': errorMessage,
          },
        },
      );
      this.channel.ack(message);
      logJobFailure(payload.jobId, currentAttempt, errorMessage);
      this.logger.error(
        JSON.stringify({
          event: 'queue.message.dead_lettered',
          jobId: payload.jobId,
          workerId: this.workerHeartbeat.getWorkerId(),
          targetWorkerId: payload.targetWorkerId ?? null,
          attempt: currentAttempt,
          deadLetterQueueName: routingQueues.deadLetterQueueName,
          error: errorMessage,
          routingStrategy,
        }),
      );
    }
  }

  async onModuleDestroy() {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
    this.channel = null;
    this.connection = null;
    this.consuming = false;
    this.subscribedQueues = [];
  }

  getStatus() {
    const config = getWorkerRuntimeConfig();

    return {
      connected: Boolean(this.connection && this.channel && this.consuming),
      queueName: config.queue.queueName,
      retryQueueName: createStrategyQueueNames(
        config.queue.queueName,
        'cloudscraper',
      ).retryQueueName,
      deadLetterQueueName: createStrategyDeadLetterQueueName(
        config.queue.queueName,
        'cloudscraper',
      ),
      subscribedQueues: this.subscribedQueues,
    };
  }
}
