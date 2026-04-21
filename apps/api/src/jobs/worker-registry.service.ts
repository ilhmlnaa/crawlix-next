import { Injectable } from '@nestjs/common';
import { getApiRuntimeConfig } from '@repo/config';
import type { WorkerHeartbeat } from '@repo/queue-contracts';
import {
  createWorkerHeartbeatKey,
  createWorkerHostnameRoundRobinKey,
  createWorkersIndexKey,
} from '@repo/shared';
import { RedisService } from '../infrastructure/redis.service';

@Injectable()
export class WorkerRegistryService {
  constructor(private readonly redisService: RedisService) {}

  private get config() {
    return getApiRuntimeConfig();
  }

  async listWorkers(): Promise<WorkerHeartbeat[]> {
    const client = this.redisService.getClient();
    const workersIndexKey = createWorkersIndexKey(this.config.redis.jobPrefix);
    await client.connect().catch(() => undefined);

    const workerIds = await client.smembers(workersIndexKey);
    const workers = await Promise.all(
      workerIds.map(async (workerId) => {
        const raw = await client.get(
          createWorkerHeartbeatKey(this.config.redis.jobPrefix, workerId),
        );

        if (!raw) {
          await client.srem(workersIndexKey, workerId);
          return null;
        }

        return JSON.parse(raw) as WorkerHeartbeat;
      }),
    );

    return workers
      .filter((worker): worker is WorkerHeartbeat => Boolean(worker))
      .sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt));
  }

  async getWorkerById(workerId: string): Promise<WorkerHeartbeat | null> {
    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);
    const raw = await client.get(
      createWorkerHeartbeatKey(this.config.redis.jobPrefix, workerId),
    );

    return raw ? (JSON.parse(raw) as WorkerHeartbeat) : null;
  }

  async getWorkersByServiceName(
    serviceName: string,
  ): Promise<WorkerHeartbeat[]> {
    const trimmedServiceName = serviceName.trim();
    if (!trimmedServiceName) {
      return [];
    }

    const workers = await this.listWorkers();
    return workers.filter(
      (worker) => worker.serviceName === trimmedServiceName,
    );
  }

  async resolveWorkerByServiceName(
    serviceName: string,
  ): Promise<WorkerHeartbeat | null> {
    const trimmedServiceName = serviceName.trim();
    if (!trimmedServiceName) {
      return null;
    }

    const workers = (
      await this.getWorkersByServiceName(trimmedServiceName)
    ).sort((left, right) => left.workerId.localeCompare(right.workerId));

    if (workers.length === 0) {
      return null;
    }

    if (workers.length === 1) {
      return workers[0];
    }

    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);
    const rotationKey = `${this.config.redis.jobPrefix}:worker-service:${trimmedServiceName}:rr`;
    const nextRotation = await client.incr(rotationKey);
    const index = (nextRotation - 1) % workers.length;

    return workers[index] ?? workers[0] ?? null;
  }

  async getWorkersByHostname(hostname: string): Promise<WorkerHeartbeat[]> {
    const trimmedHostname = hostname.trim();
    if (!trimmedHostname) {
      return [];
    }

    const workers = await this.listWorkers();
    return workers.filter((worker) => worker.hostname === trimmedHostname);
  }

  async resolveWorkerByHostname(
    hostname: string,
  ): Promise<WorkerHeartbeat | null> {
    const trimmedHostname = hostname.trim();
    if (!trimmedHostname) {
      return null;
    }

    const workers = (await this.getWorkersByHostname(trimmedHostname)).sort(
      (left, right) => left.workerId.localeCompare(right.workerId),
    );

    if (workers.length === 0) {
      return null;
    }

    if (workers.length === 1) {
      return workers[0];
    }

    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);
    const rotationKey = createWorkerHostnameRoundRobinKey(
      this.config.redis.jobPrefix,
      trimmedHostname,
    );
    const nextRotation = await client.incr(rotationKey);
    const index = (nextRotation - 1) % workers.length;

    return workers[index] ?? workers[0] ?? null;
  }
}
