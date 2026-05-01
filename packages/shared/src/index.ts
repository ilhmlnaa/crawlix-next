import crypto from "node:crypto";

export type RoutingStrategy = "cloudscraper" | "playwright";
export type SupportedScrapeStrategy = RoutingStrategy | "auto";

export interface ServiceMetadata {
  name: string;
  displayName: string;
}

export interface JobKeys {
  record: string;
  result: string;
}

export interface IdempotencyKeys {
  request: string;
}

export interface StrategyQueueNames {
  queueName: string;
  retryQueueName: string;
  deadLetterQueueName: string;
}

function stableStringifyValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringifyValue(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(
        ([key, nestedValue]) => `"${key}":${stableStringifyValue(nestedValue)}`,
      );

    return `{${entries.join(",")}}`;
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

export function createEventId(): string {
  return crypto.randomUUID();
}

export function createWebhookSignature(
  secret: string,
  timestamp: string,
  rawBody: string,
): string {
  return crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");
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

export function createIdempotencyKeys(
  prefix: string,
  idempotencyKey: string,
): IdempotencyKeys {
  const digest = crypto
    .createHash("sha256")
    .update(idempotencyKey)
    .digest("hex");

  return {
    request: `${prefix}:idempotency:${digest}`,
  };
}

export function createWorkersIndexKey(prefix: string): string {
  return `${prefix}:workers`;
}

export function createWorkerHeartbeatKey(
  prefix: string,
  workerId: string,
): string {
  return `${prefix}:worker:${workerId}`;
}

function sanitizeQueueSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

function sanitizeRedisSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function createTargetedQueueName(
  queueName: string,
  workerId: string,
): string {
  return `${queueName}.worker.${sanitizeQueueSegment(workerId)}`;
}

export function createTargetedRetryQueueName(
  queueName: string,
  workerId: string,
): string {
  return `${createTargetedQueueName(queueName, workerId)}.retry`;
}

export function createTargetedDeadLetterQueueName(
  queueName: string,
  workerId: string,
): string {
  return `${createTargetedQueueName(queueName, workerId)}.dlq`;
}

export function resolveRoutingStrategy(
  strategy: SupportedScrapeStrategy,
): RoutingStrategy {
  return strategy === "playwright" ? "playwright" : "cloudscraper";
}

export function createStrategyQueueName(
  queueName: string,
  routingStrategy: RoutingStrategy,
): string {
  return `${queueName}.${routingStrategy}`;
}

export function createStrategyRetryQueueName(
  queueName: string,
  routingStrategy: RoutingStrategy,
): string {
  return `${createStrategyQueueName(queueName, routingStrategy)}.retry`;
}

export function createStrategyDeadLetterQueueName(
  queueName: string,
  routingStrategy: RoutingStrategy,
): string {
  return `${createStrategyQueueName(queueName, routingStrategy)}.dlq`;
}

export function createTargetedStrategyQueueName(
  queueName: string,
  routingStrategy: RoutingStrategy,
  workerId: string,
): string {
  return `${createStrategyQueueName(queueName, routingStrategy)}.worker.${sanitizeQueueSegment(workerId)}`;
}

export function createTargetedStrategyRetryQueueName(
  queueName: string,
  routingStrategy: RoutingStrategy,
  workerId: string,
): string {
  return `${createTargetedStrategyQueueName(queueName, routingStrategy, workerId)}.retry`;
}

export function createTargetedStrategyDeadLetterQueueName(
  queueName: string,
  routingStrategy: RoutingStrategy,
  workerId: string,
): string {
  return `${createTargetedStrategyQueueName(queueName, routingStrategy, workerId)}.dlq`;
}

export function createStrategyQueueNames(
  queueName: string,
  routingStrategy: RoutingStrategy,
  targetWorkerId?: string,
): StrategyQueueNames {
  if (!targetWorkerId) {
    return {
      queueName: createStrategyQueueName(queueName, routingStrategy),
      retryQueueName: createStrategyRetryQueueName(queueName, routingStrategy),
      deadLetterQueueName: createStrategyDeadLetterQueueName(
        queueName,
        routingStrategy,
      ),
    };
  }

  return {
    queueName: createTargetedStrategyQueueName(
      queueName,
      routingStrategy,
      targetWorkerId,
    ),
    retryQueueName: createTargetedStrategyRetryQueueName(
      queueName,
      routingStrategy,
      targetWorkerId,
    ),
    deadLetterQueueName: createTargetedStrategyDeadLetterQueueName(
      queueName,
      routingStrategy,
      targetWorkerId,
    ),
  };
}

export function createWorkerHostnameRoundRobinKey(
  prefix: string,
  hostname: string,
): string {
  return `${prefix}:worker-hostname:${sanitizeRedisSegment(hostname)}:rr`;
}

export function createQueueFingerprint(
  url: string,
  strategy: string,
  options?: unknown,
): string {
  return crypto
    .createHash("sha256")
    .update(`${url}:${strategy}:${stableStringifyValue(options)}`)
    .digest("hex")
    .slice(0, 16);
}

export function createScrapeCacheKey(
  prefix: string,
  fingerprint: string,
): string {
  return `${prefix}:cache:${fingerprint}`;
}

export function summarizeContent(content: string, maxLength = 280): string {
  if (content.length <= maxLength) {
    return content;
  }

  return `${content.slice(0, maxLength)}...`;
}
