import {
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
import type { ScrapeJobMessage } from '@repo/queue-contracts';
import {
  createTargetedDeadLetterQueueName,
  createTargetedQueueName,
  createTargetedRetryQueueName,
} from '@repo/shared';
import { JobProcessorService } from './job-processor.service';
import { JobStoreService } from './job-store.service';
import { WorkerHeartbeatService } from './worker-heartbeat.service';
import {
  logJobFailure,
  logJobRetry,
  logQueueConsumerReady,
} from '../common/logging';

@Injectable()
export class QueueConsumerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private consuming = false;

  constructor(
    private readonly processor: JobProcessorService,
    private readonly jobStore: JobStoreService,
    private readonly workerHeartbeat: WorkerHeartbeatService,
  ) {}

  private getRoutingQueues(targetWorkerId?: string) {
    const config = getWorkerRuntimeConfig();
    if (!targetWorkerId) {
      return {
        queueName: config.queue.queueName,
        retryQueueName: config.queue.retryQueueName,
        deadLetterQueueName: config.queue.deadLetterQueueName,
      };
    }

    return {
      queueName: createTargetedQueueName(config.queue.queueName, targetWorkerId),
      retryQueueName: createTargetedRetryQueueName(
        config.queue.queueName,
        targetWorkerId,
      ),
      deadLetterQueueName: createTargetedDeadLetterQueueName(
        config.queue.queueName,
        targetWorkerId,
      ),
    };
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

    const targetedQueues = this.workerHeartbeat.getTargetedQueues();

    await channel.assertQueue(config.queue.queueName, { durable: true });
    await channel.assertQueue(config.queue.retryQueueName, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: config.queue.queueName,
    });
    await channel.assertQueue(config.queue.deadLetterQueueName, {
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
    await channel.prefetch(1);

    await channel.consume(
      config.queue.queueName,
      async (message: ConsumeMessage | null) => this.handleMessage(message),
      { noAck: false },
    );
    await channel.consume(
      targetedQueues.queueName,
      async (message: ConsumeMessage | null) => this.handleMessage(message),
      { noAck: false },
    );

    this.connection = connection;
    this.channel = channel;
    this.consuming = true;

    logQueueConsumerReady(config.queue.queueName);
  }

  private async handleMessage(message: ConsumeMessage | null) {
    if (!message || !this.channel) {
      return;
    }

    const payload = JSON.parse(message.content.toString()) as ScrapeJobMessage;
    const config = getWorkerRuntimeConfig();
    const currentAttempt =
      Number(message.properties.headers?.['x-delivery-attempt'] ?? 1) ||
      payload.deliveryAttempt ||
      1;
    const routingQueues = this.getRoutingQueues(payload.targetWorkerId);

    try {
      await this.processor.process(payload);
      this.channel.ack(message);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown processing error';

      if (currentAttempt < config.queue.maxDeliveryAttempts) {
        await this.jobStore.updateStatus(payload.jobId, 'queued', errorMessage);
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
        return;
      }

      await this.jobStore.updateStatus(payload.jobId, 'failed', errorMessage);
      await this.jobStore.saveResult({
        jobId: payload.jobId,
        status: 'failed',
        url: payload.url,
        strategy: payload.strategy,
        requestedAt: payload.requestedAt,
        completedAt: new Date().toISOString(),
        retries: currentAttempt - 1,
        targetWorkerId: payload.targetWorkerId,
        retriedFromJobId: payload.retriedFromJobId,
        error: errorMessage,
      });
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
    }
  }

  async onModuleDestroy() {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
    this.channel = null;
    this.connection = null;
    this.consuming = false;
  }

  getStatus() {
    const config = getWorkerRuntimeConfig();

    return {
      connected: Boolean(this.connection && this.channel && this.consuming),
      queueName: config.queue.queueName,
      retryQueueName: this.workerHeartbeat.getTargetedQueues().retryQueueName,
      deadLetterQueueName:
        this.workerHeartbeat.getTargetedQueues().deadLetterQueueName,
    };
  }
}
