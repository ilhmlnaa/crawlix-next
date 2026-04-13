import { Injectable } from '@nestjs/common';
import type {
  ScrapeJobResult,
  WebhookDeliveryMessage,
  WebhookEventName,
  WebhookEventPayload,
} from '@repo/queue-contracts';
import { createEventId, nowIso } from '@repo/shared';
import { QueuePublisherService } from '../infrastructure/queue-publisher.service';

@Injectable()
export class WebhookEventService {
  constructor(private readonly publisher: QueuePublisherService) {}

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

  async publishFromResult(
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

    await this.publisher.publishWebhook(message);
  }
}
