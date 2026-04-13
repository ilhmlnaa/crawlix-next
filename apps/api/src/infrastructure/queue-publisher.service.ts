import { Injectable, OnModuleDestroy } from '@nestjs/common';
import amqp, { type Channel, type ChannelModel } from 'amqplib';
import { getApiRuntimeConfig } from '@repo/config';
import type {
  ScrapeJobMessage,
  WebhookDeliveryMessage,
} from '@repo/queue-contracts';
import {
  createTargetedDeadLetterQueueName,
  createTargetedQueueName,
  createTargetedRetryQueueName,
} from '@repo/shared';

export interface QueueStatsSnapshot {
  messageCount: number;
  consumerCount: number;
  retryMessageCount: number;
  deadLetterMessageCount: number;
  webhookMessageCount: number;
  webhookRetryMessageCount: number;
  webhookDeadLetterMessageCount: number;
}

@Injectable()
export class QueuePublisherService implements OnModuleDestroy {
  private connection: ChannelModel | null = null;
  private channel: Channel | null = null;

  private async getChannel(): Promise<Channel> {
    if (this.channel) {
      return this.channel;
    }

    const config = getApiRuntimeConfig();
    const connection = await amqp.connect(config.queue.url);
    const channel = await connection.createChannel();

    await channel.assertQueue(config.queue.queueName, {
      durable: true,
    });
    await channel.assertQueue(config.queue.retryQueueName, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: config.queue.queueName,
    });
    await channel.assertQueue(config.queue.deadLetterQueueName, {
      durable: true,
    });
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

  private resolveQueues(targetWorkerId?: string) {
    const config = getApiRuntimeConfig();
    if (!targetWorkerId) {
      return {
        queueName: config.queue.queueName,
        retryQueueName: config.queue.retryQueueName,
        deadLetterQueueName: config.queue.deadLetterQueueName,
      };
    }

    return {
      queueName: createTargetedQueueName(
        config.queue.queueName,
        targetWorkerId,
      ),
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

  private async assertQueuesForTarget(targetWorkerId?: string) {
    const channel = await this.getChannel();
    const queues = this.resolveQueues(targetWorkerId);

    await channel.assertQueue(queues.queueName, {
      durable: true,
    });
    await channel.assertQueue(queues.retryQueueName, {
      durable: true,
      deadLetterExchange: '',
      deadLetterRoutingKey: queues.queueName,
    });
    await channel.assertQueue(queues.deadLetterQueueName, {
      durable: true,
    });

    return { channel, queues };
  }

  async publish(job: ScrapeJobMessage): Promise<void> {
    const { channel, queues } = await this.assertQueuesForTarget(
      job.targetWorkerId,
    );

    channel.sendToQueue(queues.queueName, Buffer.from(JSON.stringify(job)), {
      persistent: true,
    });
  }

  async publishRetry(
    job: ScrapeJobMessage,
    deliveryAttempt: number,
  ): Promise<void> {
    const { channel, queues } = await this.assertQueuesForTarget(
      job.targetWorkerId,
    );

    channel.sendToQueue(
      queues.retryQueueName,
      Buffer.from(
        JSON.stringify({
          ...job,
          deliveryAttempt,
        }),
      ),
      {
        persistent: true,
        expiration: String(getApiRuntimeConfig().queue.retryDelayMs),
        headers: {
          'x-delivery-attempt': deliveryAttempt,
        },
      },
    );
  }

  async publishDeadLetter(
    job: ScrapeJobMessage,
    deliveryAttempt: number,
    reason: string,
  ): Promise<void> {
    const { channel, queues } = await this.assertQueuesForTarget(
      job.targetWorkerId,
    );

    channel.sendToQueue(
      queues.deadLetterQueueName,
      Buffer.from(
        JSON.stringify({
          ...job,
          deliveryAttempt,
          deadLetterReason: reason,
        }),
      ),
      {
        persistent: true,
        headers: {
          'x-delivery-attempt': deliveryAttempt,
          'x-dead-letter-reason': reason,
        },
      },
    );
  }

  async getQueueStats(): Promise<QueueStatsSnapshot> {
    const channel = await this.getChannel();
    const config = getApiRuntimeConfig();
    const [
      state,
      retryState,
      deadLetterState,
      webhookState,
      webhookRetryState,
      webhookDeadLetterState,
    ] = await Promise.all([
      channel.checkQueue(config.queue.queueName),
      channel.checkQueue(config.queue.retryQueueName),
      channel.checkQueue(config.queue.deadLetterQueueName),
      channel.checkQueue(config.queue.webhookQueueName),
      channel.checkQueue(config.queue.webhookRetryQueueName),
      channel.checkQueue(config.queue.webhookDeadLetterQueueName),
    ]);

    return {
      messageCount: state.messageCount,
      consumerCount: state.consumerCount,
      retryMessageCount: retryState.messageCount,
      deadLetterMessageCount: deadLetterState.messageCount,
      webhookMessageCount: webhookState.messageCount,
      webhookRetryMessageCount: webhookRetryState.messageCount,
      webhookDeadLetterMessageCount: webhookDeadLetterState.messageCount,
    };
  }

  async publishWebhook(message: WebhookDeliveryMessage): Promise<void> {
    const channel = await this.getChannel();
    const config = getApiRuntimeConfig();

    channel.sendToQueue(
      config.queue.webhookQueueName,
      Buffer.from(JSON.stringify(message)),
      { persistent: true },
    );
  }

  async onModuleDestroy() {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
    this.channel = null;
    this.connection = null;
  }
}
