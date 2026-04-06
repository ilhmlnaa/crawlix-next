export const DEFAULT_JOB_STATUS = 'queued';

export type ScrapeJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type ScrapeStrategy = 'cloudscraper' | 'playwright' | 'auto';

export type ScrapeWaitUntil =
  | 'load'
  | 'domcontentloaded'
  | 'networkidle'
  | 'commit';

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
}

export interface CreateScrapeJobInput {
  url: string;
  strategy?: ScrapeStrategy;
  options?: ScrapeJobOptions;
}

export interface ScrapeJobMessage {
  jobId: string;
  url: string;
  strategy: ScrapeStrategy;
  options: ScrapeJobOptions;
  requestedAt: string;
  fingerprint: string;
  retriedFromJobId?: string;
  deliveryAttempt?: number;
}

export interface ScrapeJobRecord {
  jobId: string;
  status: ScrapeJobStatus;
  url: string;
  strategy: ScrapeStrategy;
  requestedAt: string;
  updatedAt: string;
  fingerprint: string;
  options: ScrapeJobOptions;
  retriedFromJobId?: string;
  error?: string;
}

export interface ScrapeJobResult {
  jobId: string;
  status: ScrapeJobStatus;
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
  retriedFromJobId?: string;
  error?: string;
}

export interface EnqueueJobResponse {
  jobId: string;
  status: ScrapeJobStatus;
  queuedAt: string;
  resultTtlSeconds: number;
  retriedFromJobId?: string;
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
  hostname: string;
  pid: number;
  status: 'idle' | 'processing';
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
  workers: WorkerHeartbeat[];
  recentJobs: ScrapeJobRecord[];
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
  status: 'active' | 'revoked';
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
