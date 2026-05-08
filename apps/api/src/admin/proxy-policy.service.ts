import { Injectable } from '@nestjs/common';
import { getApiRuntimeConfig } from '@repo/config';
import type {
  ProxyPolicy,
  ProxyPolicyMode,
  ProxyScopeType,
  ProxySettingsSnapshot,
  WorkerHeartbeat,
} from '@repo/queue-contracts';
import {
  createProxyPolicyIndexKey,
  createProxyPolicyKey,
  maskProxyUrl,
  nowIso,
} from '@repo/shared';
import { RedisService } from '../infrastructure/redis.service';

type ProxyPolicyInput = {
  enabled: boolean;
  mode: ProxyPolicyMode;
  proxies: string[];
  scopeType: ProxyScopeType;
  scopeKey?: string;
  updatedBy: string;
};

@Injectable()
export class ProxyPolicyService {
  constructor(private readonly redisService: RedisService) {}

  private get config() {
    return getApiRuntimeConfig();
  }

  private get policyIndexKey() {
    return createProxyPolicyIndexKey(this.config.redis.jobPrefix);
  }

  private get client() {
    return this.redisService.getClient();
  }

  private async connect() {
    await this.client.connect().catch(() => undefined);
  }

  private normalizeProxyList(proxies: string[]): string[] {
    return Array.from(
      new Set(
        proxies
          .map((value) => value.trim())
          .filter(Boolean)
          .map((value) => new URL(value).toString()),
      ),
    );
  }

  private createPolicyId(scopeType: ProxyScopeType, scopeKey?: string) {
    return scopeType === 'global'
      ? 'global'
      : `workerService:${scopeKey?.trim() ?? ''}`;
  }

  private sanitizePolicy(policy: ProxyPolicy): ProxyPolicy {
    return {
      ...policy,
      proxies: policy.proxies.map((value) => maskProxyUrl(value)),
    };
  }

  private createKey(scopeType: ProxyScopeType, scopeKey?: string) {
    return createProxyPolicyKey(
      this.config.redis.jobPrefix,
      scopeType,
      scopeKey?.trim(),
    );
  }

  async getPolicy(
    scopeType: ProxyScopeType,
    scopeKey?: string,
  ): Promise<ProxyPolicy | null> {
    await this.connect();
    const raw = await this.client.get(this.createKey(scopeType, scopeKey));
    return raw ? (JSON.parse(raw) as ProxyPolicy) : null;
  }

  async listPolicies(): Promise<ProxyPolicy[]> {
    await this.connect();
    const keys = await this.client.smembers(this.policyIndexKey);
    if (keys.length === 0) {
      return [];
    }

    const values = await this.client.mget(keys);
    return values
      .filter((value): value is string => Boolean(value))
      .map((value) => JSON.parse(value) as ProxyPolicy)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  async upsertPolicy(input: ProxyPolicyInput): Promise<ProxyPolicy> {
    const trimmedScopeKey = input.scopeKey?.trim() || undefined;
    const proxies =
      input.enabled && input.mode === 'pool'
        ? this.normalizeProxyList(input.proxies)
        : [];

    if (input.enabled && input.mode === 'pool' && proxies.length === 0) {
      throw new Error('Proxy pool must contain at least one valid proxy URL');
    }

    const policy: ProxyPolicy = {
      id: this.createPolicyId(input.scopeType, trimmedScopeKey),
      enabled: input.enabled && input.mode === 'pool',
      mode: input.enabled && input.mode === 'pool' ? 'pool' : 'direct',
      proxies,
      strategy: 'round_robin',
      scopeType: input.scopeType,
      scopeKey: trimmedScopeKey,
      updatedAt: nowIso(),
      updatedBy: input.updatedBy,
    };

    const storageKey = this.createKey(input.scopeType, trimmedScopeKey);
    await this.connect();
    await this.client.set(storageKey, JSON.stringify(policy));
    await this.client.sadd(this.policyIndexKey, storageKey);
    return policy;
  }

  async deletePolicy(
    scopeType: ProxyScopeType,
    scopeKey?: string,
  ): Promise<void> {
    const storageKey = this.createKey(scopeType, scopeKey);
    await this.connect();
    await this.client.del(storageKey);
    await this.client.srem(this.policyIndexKey, storageKey);
  }

  async getSettingsSnapshot(
    workers: WorkerHeartbeat[],
  ): Promise<ProxySettingsSnapshot> {
    const policies = await this.listPolicies();
    const availableWorkerServices = Array.from(
      new Set(workers.map((worker) => worker.serviceName).filter(Boolean)),
    ).sort((left, right) => left.localeCompare(right));

    return {
      envOverrideActive: this.config.scraper.forceProxy,
      envPolicy: {
        enabled: this.config.scraper.proxyUrls.length > 0,
        mode: this.config.scraper.proxyUrls.length > 0 ? 'pool' : 'direct',
        strategy: 'round_robin',
        proxies: this.config.scraper.proxyUrls.map((value) => maskProxyUrl(value)),
        poolSize: this.config.scraper.proxyUrls.length,
      },
      policies: policies.map((policy) => this.sanitizePolicy(policy)),
      availableWorkerServices,
    };
  }
}
