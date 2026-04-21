import {
  Injectable,
  Logger,
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
  ScrapeJobResult,
  WebhookDeliveryMessage,
  WebhookEventName,
  WebhookEventPayload,
} from '@repo/queue-contracts';
import { createEventId, createWebhookSignature, nowIso } from '@repo/shared';

@Injectable()
export class WebhookDispatcherService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(WebhookDispatcherService.name);
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;
  private consuming = false;

  private async getChannel(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }

    const config = getWorkerRuntimeConfig();
    const connection = await amqp.connect(config.queue.url);
    const channel = await connection.createChannel();

    await channel.assertQueue(config.queue.webhookQueueName, {
      durable: true,
    });
    await channel.assertQueue(config.queue.webhookRetryQueueName, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: config.queue.webhookQueueName,
    });
    await channel.assertQueue(config.queue.webhookDeadLetterQueueName, {
      durable: true,
    });

    this.connection = connection;
    this.channel = channel;

    return channel;
  }

  async onApplicationBootstrap() {
    const config = getWorkerRuntimeConfig();
    const channel = await this.getChannel();

    await channel.consume(
      config.queue.webhookQueueName,
      async (message) => this.handleMessage(message),
      { noAck: false },
    );

    this.consuming = true;
    this.logger.log(
      `Webhook dispatcher listening on queue ${config.queue.webhookQueueName}`,
    );
  }

  private resolveEventName(
    status: ScrapeJobResult['status'],
  ): WebhookEventName | null {
    switch (status) {
      case 'completed':
        return 'job.completed';
      case 'failed':
        return 'job.failed';
      case 'cancelled':
        return 'job.cancelled';
      case 'timeout':
        return 'job.timeout';
      default:
        return null;
    }
  }

  async enqueueFromResult(
    result: ScrapeJobResult,
    webhookSecret?: string,
  ): Promise<void> {
    if (!result.webhookUrl) {
      return;
    }

    const event = this.resolveEventName(result.status);
    if (!event) {
      return;
    }

    const timestamp = nowIso();
    const payload: WebhookEventPayload = {
      event,
      eventId: createEventId(),
      timestamp,
      data: {
        jobId: result.jobId,
        status: result.status,
        url: result.url,
        strategy: result.strategy,
        requestedAt: result.requestedAt,
        completedAt: result.completedAt,
        targetWorkerId: result.targetWorkerId,
        targetWorkerHostname: result.targetWorkerHostname,
        idempotencyKey: result.idempotencyKey,
        error: result.error,
      },
    };

    const message: WebhookDeliveryMessage = {
      eventId: payload.eventId,
      event,
      webhookUrl: result.webhookUrl,
      webhookSecret,
      payload,
    };

    const channel = await this.getChannel();
    channel.sendToQueue(
      getWorkerRuntimeConfig().queue.webhookQueueName,
      Buffer.from(JSON.stringify(message)),
      { persistent: true },
    );
  }

  private async handleMessage(message: ConsumeMessage | null): Promise<void> {
    if (!message || !this.channel) {
      return;
    }

    const payload = JSON.parse(
      message.content.toString(),
    ) as WebhookDeliveryMessage;
    const config = getWorkerRuntimeConfig();
    const currentAttempt =
      Number(message.properties.headers?.['x-delivery-attempt'] ?? 1) ||
      payload.deliveryAttempt ||
      1;

    try {
      const rawBody = JSON.stringify(payload.payload);
      const timestamp = payload.payload.timestamp;
      const secret = payload.webhookSecret ?? config.webhook.signingSecret;
      const signature = createWebhookSignature(secret, timestamp, rawBody);
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        config.webhook.requestTimeoutMs,
      );

      try {
        const response = await fetch(payload.webhookUrl, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-crawlix-event': payload.event,
            'x-crawlix-event-id': payload.eventId,
            'x-crawlix-timestamp': timestamp,
            'x-crawlix-signature': signature,
          },
          body: rawBody,
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Webhook responded with status ${response.status}`);
        }
      } finally {
        clearTimeout(timeout);
      }

      this.channel.ack(message);
    } catch (error) {
      const reason =
        error instanceof Error
          ? error.message
          : 'Unknown webhook delivery error';

      if (currentAttempt < config.queue.webhookMaxDeliveryAttempts) {
        this.channel.sendToQueue(
          config.queue.webhookRetryQueueName,
          Buffer.from(
            JSON.stringify({
              ...payload,
              deliveryAttempt: currentAttempt + 1,
            }),
          ),
          {
            persistent: true,
            expiration: String(config.queue.webhookRetryDelayMs),
            headers: {
              'x-delivery-attempt': currentAttempt + 1,
            },
          },
        );
        this.channel.ack(message);
        this.logger.warn(
          `Webhook retry scheduled for event ${payload.eventId} (${currentAttempt + 1}/${config.queue.webhookMaxDeliveryAttempts}): ${reason}`,
        );
        return;
      }

      this.channel.sendToQueue(
        config.queue.webhookDeadLetterQueueName,
        Buffer.from(
          JSON.stringify({
            ...payload,
            deliveryAttempt: currentAttempt,
            deadLetterReason: reason,
          }),
        ),
        {
          persistent: true,
          headers: {
            'x-delivery-attempt': currentAttempt,
            'x-dead-letter-reason': reason,
          },
        },
      );
      this.channel.ack(message);
      this.logger.error(
        `Webhook moved to DLQ for event ${payload.eventId}: ${reason}`,
      );
    }
  }

  getStatus() {
    const config = getWorkerRuntimeConfig();

    return {
      connected: Boolean(this.connection && this.channel && this.consuming),
      queueName: config.queue.webhookQueueName,
      retryQueueName: config.queue.webhookRetryQueueName,
      deadLetterQueueName: config.queue.webhookDeadLetterQueueName,
    };
  }

  async onModuleDestroy() {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
    this.channel = null;
    this.connection = null;
    this.consuming = false;
  }
}
