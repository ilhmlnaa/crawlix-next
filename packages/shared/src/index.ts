import crypto from 'node:crypto';

export interface ServiceMetadata {
  name: string;
  displayName: string;
}

export interface JobKeys {
  record: string;
  result: string;
}

function stableStringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringifyValue(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, nestedValue]) =>
          `"${key}":${stableStringifyValue(nestedValue)}`,
      );

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}

export function createServiceMetadata(name: string): ServiceMetadata {
  return {
    name,
    displayName: `crawlix-${name}`,
  };
}

export function createJobId(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function createJobKeys(prefix: string, jobId: string): JobKeys {
  return {
    record: `${prefix}:record:${jobId}`,
    result: `${prefix}:result:${jobId}`,
  };
}

export function createJobsIndexKey(prefix: string): string {
  return `${prefix}:index`;
}

export function createWorkersIndexKey(prefix: string): string {
  return `${prefix}:workers`;
}

export function createWorkerHeartbeatKey(prefix: string, workerId: string): string {
  return `${prefix}:worker:${workerId}`;
}

export function createQueueFingerprint(
  url: string,
  strategy: string,
  options?: unknown,
): string {
  return crypto
    .createHash('sha256')
    .update(`${url}:${strategy}:${stableStringifyValue(options)}`)
    .digest('hex')
    .slice(0, 16);
}

export function createScrapeCacheKey(prefix: string, fingerprint: string): string {
  return `${prefix}:cache:${fingerprint}`;
}

export function summarizeContent(content: string, maxLength = 280): string {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength)}...`;
}
