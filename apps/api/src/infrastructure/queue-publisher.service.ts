import { Injectable, OnModuleDestroy } from '@nestjs/common';
import amqp, { type Channel, type ChannelModel } from 'amqplib';
import { getApiRuntimeConfig } from '@repo/config';
import type {
  RoutingStrategy,
  ScrapeJobMessage,
  WebhookDeliveryMessage,
} from '@repo/queue-contracts';
import {
  createStrategyQueueNames,
  createStrategyQueueName,
  createStrategyRetryQueueName,
  createStrategyDeadLetterQueueName,
  resolveRoutingStrategy,
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

  private get sharedRoutingStrategies(): RoutingStrategy[] {
    return ['cloudscraper', 'playwright'];
  }

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
    for (const routingStrategy of this.sharedRoutingStrategies) {
      await channel.assertQueue(
        createStrategyQueueName(config.queue.queueName, routingStrategy),
        {
          durable: true,
        },
      );
      await channel.assertQueue(
        createStrategyRetryQueueName(config.queue.queueName, routingStrategy),
        {
          durable: true,
          deadLetterExchange: '',
          deadLetterRoutingKey: createStrategyQueueName(
            config.queue.queueName,
            routingStrategy,
          ),
        },
      );
      await channel.assertQueue(
        createStrategyDeadLetterQueueName(config.queue.queueName, routingStrategy),
        {
          durable: true,
        },
      );
    }
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

  private resolveQueues(
    routingStrategy: RoutingStrategy,
    targetWorkerId?: string,
  ) {
    const config = getApiRuntimeConfig();

    return createStrategyQueueNames(
      config.queue.queueName,
      routingStrategy,
      targetWorkerId,
    );
  }

  private async assertQueuesForTarget(
    routingStrategy: RoutingStrategy,
    targetWorkerId?: string,
  ) {
    const channel = await this.getChannel();
    const queues = this.resolveQueues(routingStrategy, targetWorkerId);

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
    const routingStrategy = resolveRoutingStrategy(job.strategy);
    const { channel, queues } = await this.assertQueuesForTarget(
      routingStrategy,
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
    const routingStrategy = resolveRoutingStrategy(job.strategy);
    const { channel, queues } = await this.assertQueuesForTarget(
      routingStrategy,
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
    const routingStrategy = resolveRoutingStrategy(job.strategy);
    const { channel, queues } = await this.assertQueuesForTarget(
      routingStrategy,
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
      cloudscraperState,
      playwrightState,
      cloudscraperRetryState,
      playwrightRetryState,
      cloudscraperDeadLetterState,
      playwrightDeadLetterState,
      webhookState,
      webhookRetryState,
      webhookDeadLetterState,
    ] = await Promise.all([
      channel.checkQueue(
        createStrategyQueueName(config.queue.queueName, 'cloudscraper'),
      ),
      channel.checkQueue(
        createStrategyQueueName(config.queue.queueName, 'playwright'),
      ),
      channel.checkQueue(
        createStrategyRetryQueueName(config.queue.queueName, 'cloudscraper'),
      ),
      channel.checkQueue(
        createStrategyRetryQueueName(config.queue.queueName, 'playwright'),
      ),
      channel.checkQueue(
        createStrategyDeadLetterQueueName(
          config.queue.queueName,
          'cloudscraper',
        ),
      ),
      channel.checkQueue(
        createStrategyDeadLetterQueueName(config.queue.queueName, 'playwright'),
      ),
      channel.checkQueue(config.queue.webhookQueueName),
      channel.checkQueue(config.queue.webhookRetryQueueName),
      channel.checkQueue(config.queue.webhookDeadLetterQueueName),
    ]);

    return {
      messageCount: cloudscraperState.messageCount + playwrightState.messageCount,
      consumerCount:
        cloudscraperState.consumerCount + playwrightState.consumerCount,
      retryMessageCount:
        cloudscraperRetryState.messageCount + playwrightRetryState.messageCount,
      deadLetterMessageCount:
        cloudscraperDeadLetterState.messageCount +
        playwrightDeadLetterState.messageCount,
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
