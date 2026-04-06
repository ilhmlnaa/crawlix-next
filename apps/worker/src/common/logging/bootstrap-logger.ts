import { Logger } from '@nestjs/common';
import type { WorkerRuntimeConfig } from '@repo/config';

const logger = new Logger('WorkerBootstrap');

function redactRabbitUrl(urlValue: string): string {
  try {
    const parsed = new URL(urlValue);
    if (parsed.password) {
      parsed.password = '***';
    }
    return parsed.toString();
  } catch {
    return urlValue;
  }
}

export function logWorkerBootstrapSummary(config: WorkerRuntimeConfig) {
  const queueUrl = redactRabbitUrl(config.queue.url);
  const portHint = config.queue.url.includes(':15672')
    ? ' (hint: 15672 is usually the RabbitMQ management port; AMQP is usually 5672)'
    : '';

  logger.log(
    `service=${config.serviceName} port=${config.port} queueUrl=${queueUrl}${portHint}`,
  );
  logger.log(
    `queue=${config.queue.queueName} retry=${config.queue.retryQueueName} dlq=${config.queue.deadLetterQueueName} retryDelayMs=${config.queue.retryDelayMs} maxAttempts=${config.queue.maxDeliveryAttempts}`,
  );
}
