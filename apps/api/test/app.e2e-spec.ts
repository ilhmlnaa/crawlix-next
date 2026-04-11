import { ValidationPipe } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { QueuePublisherService } from './../src/infrastructure/queue-publisher.service';
import { RedisService } from './../src/infrastructure/redis.service';
import {
  createWorkerHeartbeatKey,
  createWorkersIndexKey,
} from '@repo/shared';

class FakeRedisClient {
  private readonly values = new Map<string, string>();
  private readonly lists = new Map<string, string[]>();
  private readonly sets = new Map<string, Set<string>>();

  async connect() {
    return this;
  }

  async ping() {
    return 'PONG';
  }

  async get(key: string) {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string) {
    this.values.set(key, value);
    return 'OK';
  }

  async del(key: string) {
    this.values.delete(key);
    return 1;
  }

  async lrem(key: string, _count: number, value: string) {
    const current = this.lists.get(key) ?? [];
    this.lists.set(
      key,
      current.filter((item) => item !== value),
    );
    return 1;
  }

  async lpush(key: string, value: string) {
    const current = this.lists.get(key) ?? [];
    current.unshift(value);
    this.lists.set(key, current);
    return current.length;
  }

  async ltrim(key: string, start: number, stop: number) {
    const current = this.lists.get(key) ?? [];
    this.lists.set(key, current.slice(start, stop + 1));
    return 'OK';
  }

  async lrange(key: string, start: number, stop: number) {
    const current = this.lists.get(key) ?? [];
    return current.slice(start, stop + 1);
  }

  async smembers(key: string) {
    return Array.from(this.sets.get(key) ?? []);
  }

  async sadd(key: string, value: string) {
    const current = this.sets.get(key) ?? new Set<string>();
    current.add(value);
    this.sets.set(key, current);
    return current.size;
  }

  async srem(key: string, value: string) {
    const current = this.sets.get(key);
    current?.delete(value);
    return 1;
  }
}

class FakeRedisService {
  private readonly client = new FakeRedisClient();

  getClient() {
    return this.client;
  }

  async seedWorker(worker: Record<string, unknown>, prefix = 'crawlix:test') {
    const workerId = worker.workerId as string;
    await this.client.sadd(createWorkersIndexKey(prefix), workerId);
    await this.client.set(
      createWorkerHeartbeatKey(prefix, workerId),
      JSON.stringify(worker),
    );
  }
}

class FakeQueuePublisherService {
  public readonly publishedJobs: unknown[] = [];

  async publish(job: unknown) {
    this.publishedJobs.push(job);
  }

  async getQueueStats() {
    return {
      messageCount: this.publishedJobs.length,
      consumerCount: 2,
      retryMessageCount: 1,
      deadLetterMessageCount: 1,
    };
  }
}

describe('API auth and jobs flow (e2e)', () => {
  let app: App;
  let queuePublisher: FakeQueuePublisherService;

  beforeAll(async () => {
    process.env.API_SERVICE_NAME = 'crawlix-api';
    process.env.PORT = '3001';
    process.env.CORS_ORIGIN = 'http://localhost:3000';
    process.env.DASHBOARD_ORIGIN = 'http://localhost:3000';
    process.env.SESSION_SECRET = 'test-session-secret';
    process.env.SESSION_COOKIE_NAME = 'crawlix_session';
    process.env.SESSION_TTL_SECONDS = '3600';
    process.env.DASHBOARD_ADMIN_EMAIL = 'admin@crawlix.local';
    process.env.DASHBOARD_ADMIN_PASSWORD = 'supersecret123';
    process.env.API_KEY_PREFIX = 'cx';
    process.env.RABBITMQ_URL = 'amqp://localhost:5672';
    process.env.RABBITMQ_QUEUE_NAME = 'crawlix.scrape.jobs';
    process.env.RABBITMQ_RETRY_QUEUE_NAME = 'crawlix.scrape.jobs.retry';
    process.env.RABBITMQ_DLQ_QUEUE_NAME = 'crawlix.scrape.jobs.dlq';
    process.env.RABBITMQ_RETRY_DELAY_MS = '15000';
    process.env.RABBITMQ_MAX_DELIVERY_ATTEMPTS = '3';
    process.env.REDIS_URL = 'redis://localhost:6379';
    process.env.REDIS_JOB_PREFIX = 'crawlix:test';
    process.env.RESULT_TTL_SECONDS = '3600';
    process.env.SCRAPER_DEFAULT_STRATEGY = 'auto';
    process.env.SCRAPER_TIMEOUT_MS = '30000';
    process.env.SCRAPER_CACHE_TTL_SECONDS = '900';
    process.env.SCRAPER_MAX_RETRIES = '2';
    process.env.SCRAPER_RETRY_DELAY_MS = '1000';

    queuePublisher = new FakeQueuePublisherService();
    const fakeRedis = new FakeRedisService();
    await fakeRedis.seedWorker({
      workerId: 'worker-host123-4567',
      serviceName: 'crawlix-worker',
      queueName: 'crawlix.scrape.jobs',
      targetedQueueName: 'crawlix.scrape.jobs.worker.worker-host123-4567',
      retryQueueName: 'crawlix.scrape.jobs.worker.worker-host123-4567.retry',
      deadLetterQueueName:
        'crawlix.scrape.jobs.worker.worker-host123-4567.dlq',
      hostname: 'host123',
      pid: 4567,
      status: 'idle',
      startedAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      processedCount: 11,
      failedCount: 1,
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(RedisService)
      .useValue(fakeRedis)
      .overrideProvider(QueuePublisherService)
      .useValue(queuePublisher)
      .compile();

    const nestApp = moduleFixture.createNestApplication();
    nestApp.setGlobalPrefix('api');
    nestApp.use(cookieParser());
    nestApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await nestApp.init();
    app = nestApp.getHttpServer();
  });

  it('rejects invalid dashboard credentials', async () => {
    await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@crawlix.local',
        password: 'wrong-password',
      })
      .expect(401);
  });

  it('supports admin session, api key creation, enqueue, retry, cancel, and overview metrics', async () => {
    const agent = request.agent(app);

    const loginResponse = await agent.post('/api/auth/login').send({
      email: 'admin@crawlix.local',
      password: 'supersecret123',
    });

    expect(loginResponse.status).toBe(201);
    expect(loginResponse.body.admin.email).toBe('admin@crawlix.local');

    const meResponse = await agent.get('/api/auth/me').expect(200);
    expect(meResponse.body.admin.email).toBe('admin@crawlix.local');

    await request(app).get('/api/jobs/overview').expect(401);

    const createKeyResponse = await agent
      .post('/api/admin/api-keys')
      .send({ label: 'Primary client' })
      .expect(201);

    expect(createKeyResponse.body.record.label).toBe('Primary client');
    expect(createKeyResponse.body.apiKey).toMatch(/^cx_/);

    const apiKey = createKeyResponse.body.apiKey as string;

    const secondaryKeyResponse = await agent
      .post('/api/admin/api-keys')
      .send({ label: 'Disposable client' })
      .expect(201);

    const workersResponse = await agent.get('/api/workers').expect(200);
    expect(Array.isArray(workersResponse.body)).toBe(true);
    expect(workersResponse.body[0].workerId).toBe('worker-host123-4567');

    await request(app)
      .post('/api/jobs')
      .send({ url: 'https://example.com' })
      .expect(401);

    const enqueueResponse = await request(app)
      .post('/api/jobs')
      .set('x-api-key', apiKey)
      .send({ url: 'https://example.com' })
      .expect(201);

    expect(enqueueResponse.body.status).toBe('queued');

    const statusResponse = await request(app)
      .get(`/api/jobs/${enqueueResponse.body.jobId}`)
      .set('x-api-key', apiKey)
      .expect(200);

    expect(statusResponse.body.url).toBe('https://example.com');

    const targetedEnqueue = await request(app)
      .post('/api/jobs')
      .set('x-api-key', apiKey)
      .send({
        url: 'https://example.net',
        targetWorkerId: 'worker-host123-4567',
      })
      .expect(201);

    expect(targetedEnqueue.body.targetWorkerId).toBe('worker-host123-4567');

    const targetedStatus = await request(app)
      .get(`/api/jobs/${targetedEnqueue.body.jobId}`)
      .set('x-api-key', apiKey)
      .expect(200);
    expect(targetedStatus.body.targetWorkerId).toBe('worker-host123-4567');

    await request(app)
      .post('/api/jobs')
      .set('x-api-key', apiKey)
      .send({
        url: 'https://example.invalid',
        targetWorkerId: 'missing-worker',
      })
      .expect(404);

    const overviewResponse = await agent.get('/api/jobs/overview').expect(200);
    expect(overviewResponse.body.queueDepth).toBeGreaterThanOrEqual(1);
    expect(overviewResponse.body.retryQueueDepth).toBe(1);
    expect(overviewResponse.body.deadLetterQueueDepth).toBe(1);

    const cancelResponse = await agent
      .post(`/api/jobs/${enqueueResponse.body.jobId}/cancel`)
      .expect(201);
    expect(cancelResponse.body.status).toBe('cancelled');

    const retryResponse = await agent
      .post(`/api/jobs/${targetedEnqueue.body.jobId}/retry`)
      .expect(201);
    expect(retryResponse.body.retriedFromJobId).toBe(targetedEnqueue.body.jobId);
    expect(retryResponse.body.targetWorkerId).toBe('worker-host123-4567');

    const revokeResponse = await agent
      .post(`/api/admin/api-keys/${createKeyResponse.body.record.keyId}/revoke`)
      .expect(201);
    expect(revokeResponse.body.status).toBe('revoked');

    await agent
      .delete(`/api/admin/api-keys/${secondaryKeyResponse.body.record.keyId}`)
      .expect(200);

    const listKeysResponse = await agent.get('/api/admin/api-keys').expect(200);
    expect(
      listKeysResponse.body.some(
        (record: { keyId: string }) =>
          record.keyId === secondaryKeyResponse.body.record.keyId,
      ),
    ).toBe(false);

    await request(app)
      .post('/api/jobs')
      .set('x-api-key', apiKey)
      .send({ url: 'https://example.org' })
      .expect(401);
  });
});
