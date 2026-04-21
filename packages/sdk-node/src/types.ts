export type JobStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled"
  | "timeout";

export type JobStage =
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

export interface JobOptions {
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

export interface CreateJobInput {
  url: string;
  strategy?: ScrapeStrategy;
  options?: JobOptions;
  targetWorkerId?: string;
  targetWorkerServiceName?: string;
  targetWorkerHostname?: string;
  webhookUrl?: string;
  webhookSecret?: string;
  idempotencyKey?: string;
}

export interface EnqueueJobResponse {
  jobId: string;
  status: JobStatus;
  progress: number;
  stage: JobStage;
  queuedAt: string;
  resultTtlSeconds: number;
  targetWorkerId?: string;
  targetWorkerServiceName?: string;
  targetWorkerHostname?: string;
  retriedFromJobId?: string;
  webhookUrl?: string;
  idempotencyKey?: string;
}

export interface JobRecord {
  jobId: string;
  status: JobStatus;
  progress: number;
  stage: JobStage;
  url: string;
  strategy: ScrapeStrategy;
  requestedAt: string;
  updatedAt: string;
  fingerprint: string;
  options: JobOptions;
  targetWorkerId?: string;
  targetWorkerServiceName?: string;
  targetWorkerHostname?: string;
  retriedFromJobId?: string;
  webhookUrl?: string;
  idempotencyKey?: string;
  error?: string;
}

export interface JobResult {
  jobId: string;
  status: JobStatus;
  progress: number;
  stage: JobStage;
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
  targetWorkerServiceName?: string;
  targetWorkerHostname?: string;
  retriedFromJobId?: string;
  webhookUrl?: string;
  idempotencyKey?: string;
  error?: string;
}

export interface CrawlixClientOptions {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
  defaultHeaders?: Record<string, string>;
}

export interface WaitForCompletionOptions {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  fetchResultOnCompleted?: boolean;
  pollingMode?: "fixed" | "adaptive";
  adaptiveIntervals?: AdaptivePollingStep[];
}

export interface AdaptivePollingStep {
  afterMs: number;
  intervalMs: number;
}

export interface CreateJobOptions {
  autoIdempotencyKey?: boolean;
  idempotencyNamespace?: string;
}

export interface CreateAndWaitAdaptiveOptions extends WaitForCompletionOptions {
  autoIdempotencyKey?: boolean;
  idempotencyNamespace?: string;
}

export interface CreateAndWaitAdaptiveMetrics {
  enqueueMs: number;
  waitMs: number;
  totalMs: number;
  pollCount: number;
}

export interface CreateAndWaitAdaptiveResult extends CreateAndWaitResult {
  metrics: CreateAndWaitAdaptiveMetrics;
}

export interface CreateAndWaitResult {
  job: EnqueueJobResponse;
  terminal: JobRecord | JobResult;
}

export interface WebhookEventPayload {
  event: "job.completed" | "job.failed" | "job.cancelled" | "job.timeout";
  eventId: string;
  timestamp: string;
  data: {
    jobId: string;
    status: JobStatus;
    url: string;
    strategy: ScrapeStrategy;
    requestedAt: string;
    completedAt?: string;
    targetWorkerId?: string;
    targetWorkerServiceName?: string;
    targetWorkerHostname?: string;
    idempotencyKey?: string;
    error?: string;
  };
}

export interface VerifyWebhookSignatureInput {
  secret: string;
  timestamp: string;
  rawBody: string | Buffer;
  signature: string;
}
