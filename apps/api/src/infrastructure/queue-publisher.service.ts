import { Injectable, OnModuleDestroy } from '@nestjs/common';
import amqp, { type Channel, type ChannelModel } from 'amqplib';
import { getApiRuntimeConfig } from '@repo/config';
import type { ScrapeJobMessage } from '@repo/queue-contracts';

export interface QueueStatsSnapshot {
  messageCount: number;
  consumerCount: number;
  retryMessageCount: number;
  deadLetterMessageCount: number;
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

    this.connection = connection;
    this.channel = channel;

    return channel;
  }

  async publish(job: ScrapeJobMessage): Promise<void> {
    const channel = await this.getChannel();
    const config = getApiRuntimeConfig();

    channel.sendToQueue(
      config.queue.queueName,
      Buffer.from(JSON.stringify(job)),
      { persistent: true },
    );
  }

  async publishRetry(
    job: ScrapeJobMessage,
    deliveryAttempt: number,
  ): Promise<void> {
    const channel = await this.getChannel();
    const config = getApiRuntimeConfig();

    channel.sendToQueue(
      config.queue.retryQueueName,
      Buffer.from(
        JSON.stringify({
          ...job,
          deliveryAttempt,
        }),
      ),
      {
        persistent: true,
        expiration: String(config.queue.retryDelayMs),
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
    const channel = await this.getChannel();
    const config = getApiRuntimeConfig();

    channel.sendToQueue(
      config.queue.deadLetterQueueName,
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
    const [state, retryState, deadLetterState] = await Promise.all([
      channel.checkQueue(config.queue.queueName),
      channel.checkQueue(config.queue.retryQueueName),
      channel.checkQueue(config.queue.deadLetterQueueName),
    ]);

    return {
      messageCount: state.messageCount,
      consumerCount: state.consumerCount,
      retryMessageCount: retryState.messageCount,
      deadLetterMessageCount: deadLetterState.messageCount,
    };
  }

  async onModuleDestroy() {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
    this.channel = null;
    this.connection = null;
  }
}
