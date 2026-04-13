export const DEFAULT_JOB_STATUS = "queued";

export type ScrapeJobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout";

export type ScrapeJobStage =
  | "queued"
  | "fetching"
  | "rendering"
  | "waiting_selector"
  | "extracting"
  | "completed";

export type ScrapeStrategy = "cloudscraper" | "playwright" | "auto";

export type ScrapeWaitUntil =
  | "load"
  | "domcontentloaded"
  | "networkidle"
  | "commit";

export interface ScrapeJobOptions {
  timeoutMs?: number;
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  formData?: Record<string, string>;
  useCache?: boolean;
  cacheTtlSeconds?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  waitUntil?: ScrapeWaitUntil;
  waitForSelector?: string;
  waitForFunction?: string;
  additionalDelayMs?: number;
  useProxy?: boolean;
  proxyUrl?: string;
}

export interface CreateScrapeJobInput {
  url: string;
  strategy?: ScrapeStrategy;
  options?: ScrapeJobOptions;
  targetWorkerId?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  idempotencyKey?: string;
}

export interface ScrapeJobMessage {
  jobId: string;
  url: string;
  strategy: ScrapeStrategy;
  options: ScrapeJobOptions;
  requestedAt: string;
  fingerprint: string;
  targetWorkerId?: string;
  retriedFromJobId?: string;
  deliveryAttempt?: number;
  webhookUrl?: string;
  webhookSecret?: string;
  idempotencyKey?: string;
}

export interface ScrapeJobRecord {
  jobId: string;
  status: ScrapeJobStatus;
  progress: number;
  stage: ScrapeJobStage;
  url: string;
  strategy: ScrapeStrategy;
  requestedAt: string;
  updatedAt: string;
  fingerprint: string;
  options: ScrapeJobOptions;
  targetWorkerId?: string;
  retriedFromJobId?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  idempotencyKey?: string;
  error?: string;
}

export interface ScrapeJobResult {
  jobId: string;
  status: ScrapeJobStatus;
  progress: number;
  stage: ScrapeJobStage;
  url: string;
  strategy: ScrapeStrategy;
  requestedAt: string;
  completedAt?: string;
  content?: string;
  preview?: string;
  contentType?: string;
  method?: string;
  responseTimeMs?: number;
  retries?: number;
  cached?: boolean;
  targetWorkerId?: string;
  retriedFromJobId?: string;
  webhookUrl?: string;
  idempotencyKey?: string;
  error?: string;
}

export interface EnqueueJobResponse {
  jobId: string;
  status: ScrapeJobStatus;
  progress: number;
  stage: ScrapeJobStage;
  queuedAt: string;
  resultTtlSeconds: number;
  targetWorkerId?: string;
  retriedFromJobId?: string;
  webhookUrl?: string;
  idempotencyKey?: string;
}

export interface JobsDashboardSnapshot {
  jobs: ScrapeJobRecord[];
  queueName: string;
  total: number;
}

export interface WorkerHeartbeat {
  workerId: string;
  serviceName: string;
  queueName: string;
  targetedQueueName: string;
  retryQueueName: string;
  deadLetterQueueName: string;
  hostname: string;
  pid: number;
  status: "idle" | "processing";
  startedAt: string;
  lastSeenAt: string;
  currentJobId?: string;
  processedCount: number;
  failedCount: number;
}

export interface JobsOverviewSnapshot {
  queueName: string;
  total: number;
  statusCounts: Record<ScrapeJobStatus, number>;
  queueDepth: number;
  consumerCount: number;
  retryQueueDepth: number;
  deadLetterQueueDepth: number;
  webhookQueueDepth: number;
  webhookRetryQueueDepth: number;
  webhookDeadLetterQueueDepth: number;
  workers: WorkerHeartbeat[];
  recentJobs: ScrapeJobRecord[];
}

export type WebhookEventName =
  | "job.completed"
  | "job.failed"
  | "job.cancelled"
  | "job.timeout";

export interface WebhookEventPayload {
  event: WebhookEventName;
  eventId: string;
  timestamp: string;
  data: {
    jobId: string;
    status: ScrapeJobStatus;
    url: string;
    strategy: ScrapeStrategy;
    requestedAt: string;
    completedAt?: string;
    targetWorkerId?: string;
    idempotencyKey?: string;
    error?: string;
  };
}

export interface WebhookDeliveryMessage {
  eventId: string;
  event: WebhookEventName;
  webhookUrl: string;
  webhookSecret?: string;
  payload: WebhookEventPayload;
  deliveryAttempt?: number;
}

export interface AuthenticatedAdmin {
  email: string;
}

export interface DashboardSession {
  sessionId: string;
  email: string;
  createdAt: string;
  expiresAt: string;
}

export interface ApiKeyRecord {
  keyId: string;
  label: string;
  keyPreview: string;
  status: "active" | "revoked";
  createdAt: string;
  revokedAt?: string;
  lastUsedAt?: string;
}

export interface CreateApiKeyInput {
  label: string;
}

export interface CreateApiKeyResponse {
  apiKey: string;
  record: ApiKeyRecord;
}
