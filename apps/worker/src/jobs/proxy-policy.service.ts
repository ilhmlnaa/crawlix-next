import { Injectable } from '@nestjs/common';
import { getWorkerRuntimeConfig } from '@repo/config';
import { type ResolvedProxyRuntime } from '@repo/scraper';
import type { ProxyPolicy, ScrapeJobMessage } from '@repo/queue-contracts';
import {
  createProxyPolicyKey,
  createProxyPoolRoundRobinKey,
  maskProxyUrl,
} from '@repo/shared';
import { RedisService } from '../infrastructure/redis.service';
import { WorkerHeartbeatService } from './worker-heartbeat.service';

@Injectable()
export class ProxyPolicyService {
  constructor(
    private readonly redisService: RedisService,
    private readonly workerHeartbeat: WorkerHeartbeatService,
  ) {}

  private get config() {
    return getWorkerRuntimeConfig();
  }

  private get client() {
    return this.redisService.getClient();
  }

  private async connect() {
    await this.client.connect().catch(() => undefined);
  }

  private async getPolicy(
    scopeType: 'global' | 'workerService',
    scopeKey?: string,
  ): Promise<ProxyPolicy | null> {
    await this.connect();
    const key = createProxyPolicyKey(
      this.config.redis.jobPrefix,
      scopeType,
      scopeKey?.trim(),
    );
    const raw = await this.client.get(key);
    return raw ? (JSON.parse(raw) as ProxyPolicy) : null;
  }

  private async selectProxy(
    proxies: string[],
    scopeType: 'env' | 'global' | 'workerService' | 'job',
    scopeKey?: string,
  ): Promise<{ proxyUrl: string; proxyIndex: number }> {
    if (proxies.length === 1) {
      return {
        proxyUrl: proxies[0] ?? '',
        proxyIndex: 0,
      };
    }

    await this.connect();
    const rotationKey = createProxyPoolRoundRobinKey(
      this.config.redis.jobPrefix,
      scopeType,
      scopeKey?.trim(),
    );
    const nextRotation = await this.client.incr(rotationKey);
    const proxyIndex = (nextRotation - 1) % proxies.length;

    return {
      proxyUrl: proxies[proxyIndex] ?? proxies[0] ?? '',
      proxyIndex,
    };
  }

  private async resolveFromPool(
    proxies: string[],
    source: ResolvedProxyRuntime['source'],
    scopeType: ResolvedProxyRuntime['scopeType'],
    scopeKey?: string,
  ): Promise<ResolvedProxyRuntime> {
    if (proxies.length === 0) {
      return {
        enabled: false,
        source: 'direct',
      };
    }

    const { proxyIndex, proxyUrl } = await this.selectProxy(
      proxies,
      source === 'env'
        ? 'env'
        : source === 'job'
          ? 'job'
          : scopeType === 'workerService'
            ? 'workerService'
            : 'global',
      scopeKey,
    );

    return {
      enabled: true,
      proxyUrl,
      proxyDisplayUrl: maskProxyUrl(proxyUrl),
      source,
      scopeType,
      scopeKey,
      proxyPoolSize: proxies.length,
      proxyIndex,
    };
  }

  async resolveForJob(job: ScrapeJobMessage): Promise<ResolvedProxyRuntime> {
    const envProxies = this.config.scraper.proxyUrls;
    if (this.config.scraper.forceProxy && envProxies.length > 0) {
      return this.resolveFromPool(envProxies, 'env', 'global');
    }

    const serviceName = this.workerHeartbeat.getServiceName();
    const servicePolicy = await this.getPolicy('workerService', serviceName);
    if (servicePolicy?.enabled && servicePolicy.proxies.length > 0) {
      return this.resolveFromPool(
        servicePolicy.proxies,
        'workerService',
        'workerService',
        serviceName,
      );
    }

    const globalPolicy = await this.getPolicy('global');
    if (globalPolicy?.enabled && globalPolicy.proxies.length > 0) {
      return this.resolveFromPool(globalPolicy.proxies, 'global', 'global');
    }

    const requestProxyUrl = job.options.proxyUrl?.trim();
    if (requestProxyUrl) {
      return {
        enabled: true,
        proxyUrl: requestProxyUrl,
        proxyDisplayUrl: maskProxyUrl(requestProxyUrl),
        source: 'job',
        scopeType: 'global',
        proxyPoolSize: 1,
        proxyIndex: 0,
      };
    }

    if (job.options.useProxy === true && envProxies.length > 0) {
      return this.resolveFromPool(envProxies, 'env', 'global');
    }

    return {
      enabled: false,
      source: 'direct',
    };
  }
}
