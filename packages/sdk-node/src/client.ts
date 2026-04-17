import { createHash } from "node:crypto";
import {
  CrawlixHttpError,
  CrawlixPollingTimeoutError,
  CrawlixTimeoutError,
} from "./errors.js";
import type {
  AdaptivePollingStep,
  CreateAndWaitResult,
  CreateAndWaitAdaptiveOptions,
  CreateAndWaitAdaptiveResult,
  CreateJobInput,
  CreateJobOptions,
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

const DEFAULT_ADAPTIVE_INTERVALS: AdaptivePollingStep[] = [
  { afterMs: 0, intervalMs: 120 },
  { afterMs: 600, intervalMs: 200 },
  { afterMs: 1500, intervalMs: 300 },
  { afterMs: 3000, intervalMs: 450 },
  { afterMs: 6000, intervalMs: 700 },
];

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

function normalizeAdaptiveIntervals(
  adaptiveIntervals?: AdaptivePollingStep[],
): AdaptivePollingStep[] {
  const source =
    adaptiveIntervals && adaptiveIntervals.length > 0
      ? adaptiveIntervals
      : DEFAULT_ADAPTIVE_INTERVALS;

  return source
    .map((step) => ({
      afterMs: Math.max(0, Math.floor(step.afterMs)),
      intervalMs: Math.max(1, Math.floor(step.intervalMs)),
    }))
    .sort((left, right) => left.afterMs - right.afterMs);
}

function resolveAdaptiveInterval(
  elapsedMs: number,
  intervals: AdaptivePollingStep[],
): number {
  let resolved = intervals[0]?.intervalMs ?? 2000;

  for (const step of intervals) {
    if (elapsedMs >= step.afterMs) {
      resolved = step.intervalMs;
      continue;
    }

    break;
  }

  return resolved;
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

function isJobResultLike(value: unknown): value is JobResult {
  return Boolean(
    value && typeof value === "object" && "jobId" in value && "status" in value,
  );
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

  buildIdempotencyKey(
    input: Omit<CreateJobInput, "idempotencyKey"> | CreateJobInput,
    namespace = "sdk",
  ): string {
    const raw = stableStringifyValue({
      url: input.url,
      strategy: input.strategy,
      options: input.options,
      targetWorkerId: input.targetWorkerId,
      webhookUrl: input.webhookUrl,
    });

    const digest = createHash("sha256").update(raw).digest("hex").slice(0, 32);
    return `${namespace}-${digest}`;
  }

  async createJob(
    input: CreateJobInput,
    options: CreateJobOptions = {},
  ): Promise<EnqueueJobResponse> {
    const idempotencyKey =
      input.idempotencyKey ??
      (options.autoIdempotencyKey
        ? this.buildIdempotencyKey(input, options.idempotencyNamespace ?? "sdk")
        : undefined);
    const payload =
      idempotencyKey && !input.idempotencyKey
        ? { ...input, idempotencyKey }
        : input;

    return this.request<EnqueueJobResponse>("POST", "/jobs", {
      body: payload,
      idempotencyKey,
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
    const result = await this.waitForCompletionInternal(jobId, options);
    return result.terminal;
  }

  async waitForCompletionWithMeta(
    jobId: string,
    options: WaitForCompletionOptions = {},
  ): Promise<{ terminal: JobRecord | JobResult; pollCount: number }> {
    return this.waitForCompletionInternal(jobId, options);
  }

  private async waitForCompletionInternal(
    jobId: string,
    options: WaitForCompletionOptions = {},
  ): Promise<{ terminal: JobRecord | JobResult; pollCount: number }> {
    const intervalMs = options.intervalMs ?? 2000;
    const timeoutMs = options.timeoutMs ?? 60000;
    const pollingMode = options.pollingMode ?? "fixed";
    const adaptiveIntervals = normalizeAdaptiveIntervals(
      options.adaptiveIntervals,
    );
    const startedAt = Date.now();
    let pollCount = 0;

    while (true) {
      if (options.signal?.aborted) {
        throw new DOMException("The operation was aborted.", "AbortError");
      }

      if (Date.now() - startedAt >= timeoutMs) {
        throw new CrawlixPollingTimeoutError();
      }

      const job = await this.getJob(jobId, options.signal);
      pollCount += 1;
      if (isTerminalStatus(job.status)) {
        if (job.status === "completed" && options.fetchResultOnCompleted) {
          while (true) {
            const maybeResult = await this.request<JobResult | null>(
              "GET",
              `/jobs/${jobId}/result`,
              { signal: options.signal },
            );

            if (isJobResultLike(maybeResult)) {
              return { terminal: maybeResult, pollCount };
            }

            if (Date.now() - startedAt >= timeoutMs) {
              throw new CrawlixPollingTimeoutError();
            }

            const elapsedForResult = Date.now() - startedAt;
            const nextResultIntervalMs =
              pollingMode === "adaptive"
                ? resolveAdaptiveInterval(elapsedForResult, adaptiveIntervals)
                : intervalMs;
            await sleep(nextResultIntervalMs, options.signal);
          }
        }

        return { terminal: job, pollCount };
      }

      const elapsed = Date.now() - startedAt;
      const nextIntervalMs =
        pollingMode === "adaptive"
          ? resolveAdaptiveInterval(elapsed, adaptiveIntervals)
          : intervalMs;
      await sleep(nextIntervalMs, options.signal);
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

  async createAndWaitAdaptive(
    input: CreateJobInput,
    options: CreateAndWaitAdaptiveOptions = {},
  ): Promise<CreateAndWaitAdaptiveResult> {
    const startedAt = Date.now();
    const enqueueStart = Date.now();
    const job = await this.createJob(input, {
      autoIdempotencyKey: options.autoIdempotencyKey,
      idempotencyNamespace: options.idempotencyNamespace,
    });
    const enqueueMs = Date.now() - enqueueStart;

    const waitStart = Date.now();
    const waitResult = await this.waitForCompletionInternal(job.jobId, {
      fetchResultOnCompleted: options.fetchResultOnCompleted ?? true,
      timeoutMs: options.timeoutMs ?? 20000,
      signal: options.signal,
      pollingMode: options.pollingMode ?? "adaptive",
      intervalMs: options.intervalMs,
      adaptiveIntervals: options.adaptiveIntervals,
    });
    const waitMs = Date.now() - waitStart;

    return {
      job,
      terminal: waitResult.terminal,
      metrics: {
        enqueueMs,
        waitMs,
        totalMs: Date.now() - startedAt,
        pollCount: waitResult.pollCount,
      },
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
