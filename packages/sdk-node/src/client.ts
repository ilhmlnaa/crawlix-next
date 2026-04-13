import {
  CrawlixHttpError,
  CrawlixPollingTimeoutError,
  CrawlixTimeoutError,
} from "./errors.js";
import type {
  CreateAndWaitResult,
  CreateJobInput,
  CrawlixClientOptions,
  EnqueueJobResponse,
  JobRecord,
  JobResult,
  WaitForCompletionOptions,
} from "./types.js";

interface RequestOptions {
  body?: unknown;
  signal?: AbortSignal;
  idempotencyKey?: string;
}

interface ErrorEnvelope {
  success?: false;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
  code?: string;
  message?: string | string[];
  details?: unknown;
}

interface SuccessEnvelope<T> {
  success?: true;
  data?: T;
}

const TERMINAL_STATUSES = new Set([
  "completed",
  "failed",
  "cancelled",
  "timeout",
]);

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = stripTrailingSlash(baseUrl.trim());
  if (normalized.endsWith("/api")) {
    return normalized;
  }

  return `${normalized}/api`;
}

function joinUrl(baseUrl: string, path: string): string {
  return `${stripTrailingSlash(baseUrl)}/${path.replace(/^\/+/, "")}`;
}

function parsePayload<T>(raw: string): T | null {
  if (!raw.trim()) {
    return null;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return raw as T;
  }
}

function normalizeErrorMessage(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim().length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    const parts = value.filter(
      (item): item is string => typeof item === "string",
    );
    if (parts.length > 0) {
      return parts.join(", ");
    }
  }

  return undefined;
}

function extractErrorInfo(payload: unknown): {
  message?: string;
  code?: string;
  details?: unknown;
} {
  if (!payload) {
    return {};
  }

  if (typeof payload === "string") {
    return {
      message: payload,
      details: payload,
    };
  }

  if (typeof payload !== "object") {
    return {};
  }

  const errorPayload = payload as ErrorEnvelope;
  const message =
    normalizeErrorMessage(errorPayload.error?.message) ??
    normalizeErrorMessage(errorPayload.message);

  return {
    message,
    code: errorPayload.error?.code ?? errorPayload.code,
    details: errorPayload.error?.details ?? errorPayload.details ?? payload,
  };
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(resolve, ms);
    const abort = () => {
      clearTimeout(timeout);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    };

    signal?.addEventListener("abort", abort, { once: true });
  });
}

function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

export class CrawlixClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly defaultHeaders: Record<string, string>;

  constructor(options: CrawlixClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl);
    this.apiKey = options.apiKey;
    this.timeoutMs = options.timeoutMs ?? 10000;
    this.defaultHeaders = options.defaultHeaders ?? {};
  }

  async createJob(input: CreateJobInput): Promise<EnqueueJobResponse> {
    return this.request<EnqueueJobResponse>("POST", "/jobs", {
      body: input,
      idempotencyKey: input.idempotencyKey,
    });
  }

  async getJob(jobId: string, signal?: AbortSignal): Promise<JobRecord> {
    return this.request<JobRecord>("GET", `/jobs/${jobId}`, { signal });
  }

  async getJobResult(jobId: string, signal?: AbortSignal): Promise<JobResult> {
    return this.request<JobResult>("GET", `/jobs/${jobId}/result`, { signal });
  }

  async waitForCompletion(
    jobId: string,
    options: WaitForCompletionOptions = {},
  ): Promise<JobRecord | JobResult> {
    const intervalMs = options.intervalMs ?? 2000;
    const timeoutMs = options.timeoutMs ?? 60000;
    const startedAt = Date.now();

    while (true) {
      if (options.signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }

      if (Date.now() - startedAt >= timeoutMs) {
        throw new CrawlixPollingTimeoutError();
      }

      const job = await this.getJob(jobId, options.signal);
      if (isTerminalStatus(job.status)) {
        if (job.status === "completed" && options.fetchResultOnCompleted) {
          return this.getJobResult(jobId, options.signal);
        }

        return job;
      }

      await sleep(intervalMs, options.signal);
    }
  }

  async createAndWait(
    input: CreateJobInput,
    options: WaitForCompletionOptions = {},
  ): Promise<CreateAndWaitResult> {
    const job = await this.createJob(input);
    const terminal = await this.waitForCompletion(job.jobId, options);

    return {
      job,
      terminal,
    };
  }

  private async request<T>(
    method: string,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort();
    options.signal?.addEventListener("abort", onAbort, { once: true });

    try {
      const response = await fetch(joinUrl(this.baseUrl, path), {
        method,
        headers: {
          "x-api-key": this.apiKey,
          ...this.defaultHeaders,
          ...(options.body ? { "content-type": "application/json" } : {}),
          ...(options.idempotencyKey
            ? { "Idempotency-Key": options.idempotencyKey }
            : {}),
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      const raw = await response.text();
      const payload = parsePayload<SuccessEnvelope<T> | ErrorEnvelope | T>(raw);

      if (!response.ok) {
        const errorInfo = extractErrorInfo(payload);
        throw new CrawlixHttpError(
          errorInfo.message ??
            `HTTP request failed with status ${response.status}.`,
          {
            status: response.status,
            code: errorInfo.code,
            details: errorInfo.details,
          },
        );
      }

      const successPayload = payload as SuccessEnvelope<T> | T | null;
      if (
        successPayload &&
        typeof successPayload === "object" &&
        "success" in successPayload &&
        "data" in successPayload
      ) {
        return successPayload.data as T;
      }

      return successPayload as T;
    } catch (error) {
      if (error instanceof CrawlixHttpError) {
        throw error;
      }

      if (
        error instanceof DOMException &&
        error.name === "AbortError" &&
        !options.signal?.aborted
      ) {
        throw new CrawlixTimeoutError();
      }

      throw error;
    } finally {
      clearTimeout(timeout);
      options.signal?.removeEventListener("abort", onAbort);
    }
  }
}
