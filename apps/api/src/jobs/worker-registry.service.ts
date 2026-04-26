import { Injectable } from '@nestjs/common';
import { getApiRuntimeConfig } from '@repo/config';
import type {
  ScrapeStrategy,
  WorkerAllowedStrategy,
  WorkerHeartbeat,
} from '@repo/queue-contracts';
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

  private getAllowedStrategies(
    worker: WorkerHeartbeat,
  ): WorkerAllowedStrategy[] {
    return worker.allowedStrategies?.length
      ? worker.allowedStrategies
      : ['cloudscraper', 'playwright'];
  }

  private supportsStrategy(
    worker: WorkerHeartbeat,
    strategy?: ScrapeStrategy,
  ): boolean {
    if (!strategy) {
      return true;
    }

    const allowedStrategies = this.getAllowedStrategies(worker);
    return strategy === 'auto' || allowedStrategies.includes(strategy);
  }

  private async resolveWorkerWithRoundRobin(
    workers: WorkerHeartbeat[],
    rotationKey: string,
  ): Promise<WorkerHeartbeat | null> {
    const sortedWorkers = [...workers].sort((left, right) =>
      left.workerId.localeCompare(right.workerId),
    );

    if (sortedWorkers.length === 0) {
      return null;
    }

    if (sortedWorkers.length === 1) {
      return sortedWorkers[0] ?? null;
    }

    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);
    const nextRotation = await client.incr(rotationKey);
    const index = (nextRotation - 1) % sortedWorkers.length;

    return sortedWorkers[index] ?? sortedWorkers[0] ?? null;
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
    strategy?: ScrapeStrategy,
  ): Promise<WorkerHeartbeat | null> {
    const trimmedServiceName = serviceName.trim();
    if (!trimmedServiceName) {
      return null;
    }

    const workers = (await this.getWorkersByServiceName(trimmedServiceName))
      .filter((worker) => this.supportsStrategy(worker, strategy));
    const rotationKey = `${this.config.redis.jobPrefix}:worker-service:${trimmedServiceName}:rr`;

    return this.resolveWorkerWithRoundRobin(workers, rotationKey);
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
    strategy?: ScrapeStrategy,
  ): Promise<WorkerHeartbeat | null> {
    const trimmedHostname = hostname.trim();
    if (!trimmedHostname) {
      return null;
    }

    const workers = (await this.getWorkersByHostname(trimmedHostname)).filter(
      (worker) => this.supportsStrategy(worker, strategy),
    );
    const rotationKey = createWorkerHostnameRoundRobinKey(
      this.config.redis.jobPrefix,
      trimmedHostname,
    );

    return this.resolveWorkerWithRoundRobin(workers, rotationKey);
  }
}
