import { Injectable } from '@nestjs/common';
import { getApiRuntimeConfig } from '@repo/config';
import type { WorkerHeartbeat } from '@repo/queue-contracts';
import {
  createWorkerHeartbeatKey,
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
}
