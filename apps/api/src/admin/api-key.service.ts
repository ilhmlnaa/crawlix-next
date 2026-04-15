import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { getApiRuntimeConfig } from '@repo/config';
import type { ApiKeyRecord, CreateApiKeyResponse } from '@repo/queue-contracts';
import type { Request } from 'express';
import { RedisService } from '../infrastructure/redis.service';

interface StoredApiKeyRecord extends ApiKeyRecord {
  keyHash: string;
}

@Injectable()
export class ApiKeyService {
  constructor(private readonly redisService: RedisService) {}

  private get config() {
    return getApiRuntimeConfig();
  }

  private get namespace() {
    return `${this.config.redis.jobPrefix}:auth:api-keys`;
  }

  private get indexKey() {
    return `${this.namespace}:index`;
  }

  private getRecordKey(keyId: string) {
    return `${this.namespace}:${keyId}`;
  }

  private async getRedis() {
    const client = this.redisService.getClient();
    await client.connect().catch(() => undefined);
    return client;
  }

  private hashApiKey(apiKey: string) {
    return createHash('sha256').update(apiKey).digest('hex');
  }

  private buildApiKey(keyId: string, secret: string) {
    return `${this.config.auth.apiKeyPrefix}_${keyId}_${secret}`;
  }

  private parseApiKey(apiKey: string) {
    const [prefix, keyId, ...secretParts] = apiKey.split('_');
    if (
      prefix !== this.config.auth.apiKeyPrefix ||
      !keyId ||
      secretParts.length === 0
    ) {
      return null;
    }

    return {
      keyId,
      secret: secretParts.join('_'),
    };
  }

  async create(
    label: string,
    rateLimit?: number | null,
  ): Promise<CreateApiKeyResponse> {
    const keyId = randomBytes(8).toString('hex');
    const secret = randomBytes(24).toString('hex');
    const apiKey = this.buildApiKey(keyId, secret);
    const record: StoredApiKeyRecord = {
      keyId,
      label: label.trim(),
      keyPreview: `${apiKey.slice(0, 12)}...${apiKey.slice(-4)}`,
      status: 'active',
      createdAt: new Date().toISOString(),
      keyHash: this.hashApiKey(apiKey),
      rateLimit: rateLimit ?? undefined,
    };

    const redis = await this.getRedis();
    await redis.set(this.getRecordKey(keyId), JSON.stringify(record));
    await redis.lrem(this.indexKey, 0, keyId);
    await redis.lpush(this.indexKey, keyId);

    const { keyHash, ...publicRecord } = record;
    return {
      apiKey,
      record: publicRecord,
    };
  }

  async list(): Promise<ApiKeyRecord[]> {
    const redis = await this.getRedis();
    const ids = await redis.lrange(this.indexKey, 0, 99);
    const records = await Promise.all(ids.map((keyId) => this.getById(keyId)));
    return records.filter((record): record is ApiKeyRecord => Boolean(record));
  }

  async getById(keyId: string): Promise<ApiKeyRecord | null> {
    const stored = await this.getStoredById(keyId);
    if (!stored) {
      return null;
    }

    const { keyHash, ...record } = stored;
    return record;
  }

  private async getStoredById(
    keyId: string,
  ): Promise<StoredApiKeyRecord | null> {
    const redis = await this.getRedis();
    const value = await redis.get(this.getRecordKey(keyId));
    return value ? (JSON.parse(value) as StoredApiKeyRecord) : null;
  }

  async revoke(keyId: string): Promise<ApiKeyRecord | null> {
    const existing = await this.getStoredById(keyId);
    if (!existing) {
      return null;
    }

    const updated: StoredApiKeyRecord = {
      ...existing,
      status: 'revoked',
      revokedAt: existing.revokedAt ?? new Date().toISOString(),
    };

    const redis = await this.getRedis();
    await redis.set(this.getRecordKey(keyId), JSON.stringify(updated));

    const { keyHash, ...record } = updated;
    return record;
  }

  async delete(keyId: string): Promise<ApiKeyRecord | null> {
    const existing = await this.getStoredById(keyId);
    if (!existing) {
      return null;
    }

    const redis = await this.getRedis();
    await redis.del(this.getRecordKey(keyId));
    await redis.lrem(this.indexKey, 0, keyId);

    const { keyHash, ...record } = existing;
    return record;
  }

  async validate(rawApiKey?: string | null): Promise<ApiKeyRecord | null> {
    if (!rawApiKey) {
      return null;
    }

    const parsed = this.parseApiKey(rawApiKey.trim());
    if (!parsed) {
      return null;
    }

    const stored = await this.getStoredById(parsed.keyId);
    if (!stored || stored.status !== 'active') {
      return null;
    }

    const incomingHash = this.hashApiKey(rawApiKey.trim());
    const left = Buffer.from(incomingHash);
    const right = Buffer.from(stored.keyHash);
    if (left.length !== right.length || !timingSafeEqual(left, right)) {
      return null;
    }

    const updated: StoredApiKeyRecord = {
      ...stored,
      lastUsedAt: new Date().toISOString(),
    };
    const redis = await this.getRedis();
    await redis.set(this.getRecordKey(parsed.keyId), JSON.stringify(updated));

    const { keyHash, ...record } = updated;
    return record;
  }

  extractFromRequest(request: Request) {
    const header = request.headers['x-api-key'];
    if (typeof header === 'string' && header.trim()) {
      return header.trim();
    }

    const authorization = request.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      return null;
    }

    return authorization.slice('Bearer '.length).trim() || null;
  }

  async requireApiKey(request: Request) {
    const apiKey = await this.validate(this.extractFromRequest(request));
    if (!apiKey) {
      throw new UnauthorizedException('Valid API key is required');
    }

    return apiKey;
  }
}
