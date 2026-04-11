import type { ConsumeMessage } from 'amqplib';
import { QueueConsumerService } from '../src/jobs/queue-consumer.service';

describe('QueueConsumerService retry and DLQ flow', () => {
  const workerHeartbeat = {
    getWorkerId: jest.fn().mockReturnValue('worker-host123-4567'),
    getTargetedQueues: jest.fn().mockReturnValue({
      queueName: 'crawlix.scrape.jobs.worker.worker-host123-4567',
      retryQueueName: 'crawlix.scrape.jobs.worker.worker-host123-4567.retry',
      deadLetterQueueName: 'crawlix.scrape.jobs.worker.worker-host123-4567.dlq',
    }),
  };

  beforeAll(() => {
    process.env.WORKER_SERVICE_NAME = 'crawlix-worker';
    process.env.PORT = '3002';
    process.env.RABBITMQ_URL = 'amqp://localhost:5672';
    process.env.RABBITMQ_QUEUE_NAME = 'crawlix.scrape.jobs';
    process.env.RABBITMQ_RETRY_QUEUE_NAME = 'crawlix.scrape.jobs.retry';
    process.env.RABBITMQ_DLQ_QUEUE_NAME = 'crawlix.scrape.jobs.dlq';
    process.env.RABBITMQ_RETRY_DELAY_MS = '15000';
    process.env.RABBITMQ_MAX_DELIVERY_ATTEMPTS = '2';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.REDIS_JOB_PREFIX = 'crawlix:test';
    process.env.RESULT_TTL_SECONDS = '3600';
    process.env.SCRAPER_DEFAULT_STRATEGY = 'auto';
    process.env.SCRAPER_TIMEOUT_MS = '30000';
    process.env.SCRAPER_CACHE_TTL_SECONDS = '900';
    process.env.SCRAPER_MAX_RETRIES = '2';
    process.env.SCRAPER_RETRY_DELAY_MS = '1000';
  });

  it('requeues recoverable failures into retry queue', async () => {
    const processor = {
      process: jest.fn().mockRejectedValue(new Error('temporary failure')),
    };
    const jobStore = {
      updateStatus: jest.fn().mockResolvedValue(null),
      saveResult: jest.fn().mockResolvedValue(undefined),
    };

    const service = new QueueConsumerService(
      processor as never,
      jobStore as never,
      workerHeartbeat as never,
    );

    const channel = {
      sendToQueue: jest.fn(),
      ack: jest.fn(),
    };

    (service as unknown as { channel: typeof channel }).channel = channel;

    const message = {
      content: Buffer.from(
        JSON.stringify({
          jobId: 'job-1',
          url: 'https://example.com',
          strategy: 'auto',
          options: {},
          requestedAt: new Date().toISOString(),
          fingerprint: 'fingerprint',
        }),
      ),
      properties: {
        headers: {
          'x-delivery-attempt': 1,
        },
      },
    } as unknown as ConsumeMessage;

    await (service as unknown as { handleMessage: (message: ConsumeMessage) => Promise<void> }).handleMessage(message);

    expect(jobStore.updateStatus).toHaveBeenCalledWith(
      'job-1',
      'queued',
      'temporary failure',
    );
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'crawlix.scrape.jobs.retry',
      expect.any(Buffer),
      expect.objectContaining({
        expiration: '15000',
      }),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('stores final failures into DLQ after max attempts', async () => {
    const processor = {
      process: jest.fn().mockRejectedValue(new Error('permanent failure')),
    };
    const jobStore = {
      updateStatus: jest.fn().mockResolvedValue(null),
      saveResult: jest.fn().mockResolvedValue(undefined),
    };

    const service = new QueueConsumerService(
      processor as never,
      jobStore as never,
      workerHeartbeat as never,
    );

    const channel = {
      sendToQueue: jest.fn(),
      ack: jest.fn(),
    };

    (service as unknown as { channel: typeof channel }).channel = channel;

    const message = {
      content: Buffer.from(
        JSON.stringify({
          jobId: 'job-2',
          url: 'https://example.org',
          strategy: 'auto',
          options: {},
          requestedAt: new Date().toISOString(),
          fingerprint: 'fingerprint-2',
        }),
      ),
      properties: {
        headers: {
          'x-delivery-attempt': 2,
        },
      },
    } as unknown as ConsumeMessage;

    await (service as unknown as { handleMessage: (message: ConsumeMessage) => Promise<void> }).handleMessage(message);

    expect(jobStore.updateStatus).toHaveBeenCalledWith(
      'job-2',
      'failed',
      'permanent failure',
    );
    expect(jobStore.saveResult).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: 'job-2',
        status: 'failed',
      }),
    );
    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'crawlix.scrape.jobs.dlq',
      expect.any(Buffer),
      expect.any(Object),
    );
    expect(channel.ack).toHaveBeenCalledWith(message);
  });

  it('routes targeted jobs into worker-specific retry queue', async () => {
    const processor = {
      process: jest.fn().mockRejectedValue(new Error('temporary failure')),
    };
    const jobStore = {
      updateStatus: jest.fn().mockResolvedValue(null),
      saveResult: jest.fn().mockResolvedValue(undefined),
    };

    const service = new QueueConsumerService(
      processor as never,
      jobStore as never,
      workerHeartbeat as never,
    );

    const channel = {
      sendToQueue: jest.fn(),
      ack: jest.fn(),
    };

    (service as unknown as { channel: typeof channel }).channel = channel;

    const message = {
      content: Buffer.from(
        JSON.stringify({
          jobId: 'job-3',
          url: 'https://targeted.example.com',
          strategy: 'auto',
          options: {},
          requestedAt: new Date().toISOString(),
          fingerprint: 'fingerprint-3',
          targetWorkerId: 'worker-host123-4567',
        }),
      ),
      properties: {
        headers: {
          'x-delivery-attempt': 1,
        },
      },
    } as unknown as ConsumeMessage;

    await (service as unknown as { handleMessage: (message: ConsumeMessage) => Promise<void> }).handleMessage(message);

    expect(channel.sendToQueue).toHaveBeenCalledWith(
      'crawlix.scrape.jobs.worker.worker-host123-4567.retry',
      expect.any(Buffer),
      expect.objectContaining({
        expiration: '15000',
      }),
    );
  });
});
