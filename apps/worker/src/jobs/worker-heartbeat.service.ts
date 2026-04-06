import os from 'node:os';
import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { getWorkerRuntimeConfig } from '@repo/config';
import type { WorkerHeartbeat } from '@repo/queue-contracts';
import {
  createWorkerHeartbeatKey,
  createWorkersIndexKey,
} from '@repo/shared';
import { RedisService } from '../infrastructure/redis.service';

@Injectable()
export class WorkerHeartbeatService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly heartbeatTtlSeconds = 30;
  private readonly heartbeatIntervalMs = 10_000;
  private readonly workerId = `${os.hostname()}-${process.pid}`;
  private readonly startedAt = new Date().toISOString();
  private timer: NodeJS.Timeout | null = null;
  private processedCount = 0;
  private failedCount = 0;
  private status: WorkerHeartbeat['status'] = 'idle';
  private currentJobId?: string;

  constructor(private readonly redisService: RedisService) {}

  private get config() {
    return getWorkerRuntimeConfig();
  }

  private get heartbeatKey() {
    return createWorkerHeartbeatKey(this.config.redis.jobPrefix, this.workerId);
  }

  private get workersIndexKey() {
    return createWorkersIndexKey(this.config.redis.jobPrefix);
  }

  private createPayload(): WorkerHeartbeat {
    return {
      workerId: this.workerId,
      serviceName: this.config.serviceName,
      queueName: this.config.queue.queueName,
      hostname: os.hostname(),
      pid: process.pid,
      status: this.status,
      startedAt: this.startedAt,
      lastSeenAt: new Date().toISOString(),
      currentJobId: this.currentJobId,
      processedCount: this.processedCount,
      failedCount: this.failedCount,
    };
  }

  private async writeHeartbeat(): Promise<void> {
    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);
    await client.sadd(this.workersIndexKey, this.workerId);
    await client.set(
      this.heartbeatKey,
      JSON.stringify(this.createPayload()),
      'EX',
      this.heartbeatTtlSeconds,
    );
  }

  async onApplicationBootstrap() {
    await this.writeHeartbeat();
    this.timer = setInterval(() => {
      void this.writeHeartbeat();
    }, this.heartbeatIntervalMs);
  }

  async markProcessing(jobId: string): Promise<void> {
    this.status = 'processing';
    this.currentJobId = jobId;
    await this.writeHeartbeat();
  }

  async markIdle(success: boolean): Promise<void> {
    this.status = 'idle';
    this.currentJobId = undefined;

    if (success) {
      this.processedCount += 1;
    } else {
      this.failedCount += 1;
    }

    await this.writeHeartbeat();
  }

  async onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);
    await client.del(this.heartbeatKey).catch(() => undefined);
    await client.srem(this.workersIndexKey, this.workerId).catch(() => undefined);
  }
}
