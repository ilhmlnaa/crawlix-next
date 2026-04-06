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
import { createLogLine } from '@repo/observability';
import { JobProcessorService } from './job-processor.service';
import { JobStoreService } from './job-store.service';

@Injectable()
export class QueueConsumerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(
    private readonly processor: JobProcessorService,
    private readonly jobStore: JobStoreService,
  ) {}

  async onApplicationBootstrap() {
    const config = getWorkerRuntimeConfig();
    const connection = await amqp.connect(config.queue.url);
    const channel = await connection.createChannel();

    await channel.assertQueue(config.queue.queueName, { durable: true });
    await channel.assertQueue(config.queue.retryQueueName, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: config.queue.queueName,
    });
    await channel.assertQueue(config.queue.deadLetterQueueName, {
      durable: true,
    });
    await channel.prefetch(1);

    await channel.consume(
      config.queue.queueName,
      async (message: ConsumeMessage | null) => this.handleMessage(message),
      { noAck: false },
    );

    this.connection = connection;
    this.channel = channel;

    console.log(createLogLine('worker', `consuming ${config.queue.queueName}`));
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

    try {
      await this.processor.process(payload);
      this.channel.ack(message);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown processing error';

      if (currentAttempt < config.queue.maxDeliveryAttempts) {
        await this.jobStore.updateStatus(payload.jobId, 'queued', errorMessage);
        this.channel.sendToQueue(
          config.queue.retryQueueName,
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
        console.warn(
          createLogLine(
            'worker',
            `job ${payload.jobId} scheduled for retry ${currentAttempt + 1}/${config.queue.maxDeliveryAttempts}`,
          ),
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
        retriedFromJobId: payload.retriedFromJobId,
        error: errorMessage,
      });
      this.channel.sendToQueue(
        config.queue.deadLetterQueueName,
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
      console.error(
        createLogLine(
          'worker',
          `job ${payload.jobId} failed permanently after ${currentAttempt} attempts: ${errorMessage}`,
        ),
      );
    }
  }

  async onModuleDestroy() {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
    this.channel = null;
    this.connection = null;
  }
}
