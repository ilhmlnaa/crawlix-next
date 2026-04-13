import {
  getWorkerRuntimeConfig,
  type ScraperRuntimeConfig,
} from "@repo/config";
import type {
  ScrapeJobMessage,
  ScrapeJobStage,
  ScrapeJobOptions,
  ScrapeJobResult,
  ScrapeStrategy,
  ScrapeWaitUntil,
} from "@repo/queue-contracts";
import { summarizeContent } from "@repo/shared";

export interface ScrapeExecutionContext {
  config?: ScraperRuntimeConfig;
  onStageChange?: (stage: ScrapeJobStage, progress: number) => Promise<void> | void;
  onEvent?: (
    event:
      | {
          type: "strategy_selected";
          strategy: Exclude<ScrapeStrategy, "auto">;
          requestedStrategy: ScrapeStrategy;
        }
      | {
          type: "attempt_started";
          attempt: number;
          maxRetries: number;
          strategy: Exclude<ScrapeStrategy, "auto">;
        }
      | {
          type: "strategy_succeeded";
          attempt: number;
          strategy: string;
          method: string;
          responseTimeMs: number;
        }
      | {
          type: "strategy_failed";
          attempt: number;
          strategy: string;
          method?: string;
          error?: string;
        }
      | {
          type: "fallback_started";
          from: "cloudscraper";
          to: "playwright";
          attempt: number;
        }
      | {
          type: "retry_scheduled";
          attempt: number;
          nextAttempt: number;
          delayMs: number;
        }
      | {
          type: "stage";
          stage: ScrapeJobStage;
          progress: number;
        },
  ) => Promise<void> | void;
}

interface ScraperStrategyResult {
  success: boolean;
  content: string;
  contentType: string;
  method: string;
  responseTimeMs: number;
  error?: string;
}

interface ScraperStrategy {
  execute(
    job: ScrapeJobMessage,
    context: Required<ScrapeExecutionContext>,
  ): Promise<ScraperStrategyResult>;
}

type ScrapeJobOptionsWithProxy = ScrapeJobOptions & {
  proxyUrl?: string;
};

export interface BrowserRuntimeStats {
  available: boolean;
  direct: {
    active: boolean;
    contexts: number;
  };
  proxy: {
    active: boolean;
    contexts: number;
  };
}

const DEFAULT_HEADERS = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  Connection: "keep-alive",
  "Upgrade-Insecure-Requests": "1",
};

function readConfig(
  context?: ScrapeExecutionContext,
): Required<ScrapeExecutionContext> {
  return {
    config: context?.config ?? getWorkerRuntimeConfig().scraper,
    onStageChange: context?.onStageChange ?? (() => undefined),
    onEvent: context?.onEvent ?? (() => undefined),
  };
}

function buildHeaders(
  options: ScrapeJobOptions,
  config: ScraperRuntimeConfig,
): HeadersInit {
  return {
    ...DEFAULT_HEADERS,
    "User-Agent": config.userAgent,
    ...(options.headers ?? {}),
  };
}

function buildBody(options: ScrapeJobOptions): BodyInit | undefined {
  if (options.formData) {
    return new URLSearchParams(options.formData);
  }

  return options.body;
}

function readTimeout(
  options: ScrapeJobOptions,
  config: ScraperRuntimeConfig,
): number {
  return options.timeoutMs ?? config.defaultTimeoutMs;
}

function resolveProxyUrl(
  options: ScrapeJobOptionsWithProxy,
  config: ScraperRuntimeConfig,
): string | undefined {
  if (options.useProxy !== true) {
    return undefined;
  }

  const requestProxyUrl = options.proxyUrl?.trim();
  if (requestProxyUrl) {
    return requestProxyUrl;
  }

  const fallbackProxyUrl = config.proxyUrl?.trim();
  return fallbackProxyUrl ? fallbackProxyUrl : undefined;
}

class BrowserPoolManager {
  private static instance: BrowserPoolManager | null = null;
  private directBrowser: any | null = null;
  private proxyBrowser: any | null = null;
  private proxyBrowserUrl: string | null = null;
  private idleTimers = new Map<
    "direct" | "proxy",
    ReturnType<typeof setTimeout>
  >();
  private playwrightAvailable = true;

  static getInstance() {
    if (!BrowserPoolManager.instance) {
      BrowserPoolManager.instance = new BrowserPoolManager();
    }

    return BrowserPoolManager.instance;
  }

  async getBrowser(
    proxyUrl: string | undefined,
    config: ScraperRuntimeConfig,
  ): Promise<any> {
    const key: "direct" | "proxy" = proxyUrl ? "proxy" : "direct";

    if (
      key === "proxy" &&
      this.proxyBrowser &&
      this.proxyBrowserUrl !== proxyUrl
    ) {
      await this.closeBrowser("proxy");
    }

    const existing = key === "proxy" ? this.proxyBrowser : this.directBrowser;

    if (existing) {
      this.resetIdleTimer(key, config);
      return existing;
    }

    const dynamicImport = new Function(
      "specifier",
      "return import(specifier)",
    ) as (specifier: string) => Promise<any>;

    try {
      const playwright = await dynamicImport("playwright");
      const chromium = playwright.chromium;
      const browser = await chromium.launch({
        headless: config.playwrightHeadless,
        executablePath: config.playwrightExecutablePath,
        proxy: key === "proxy" && proxyUrl ? { server: proxyUrl } : undefined,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      });

      if (key === "proxy") {
        this.proxyBrowser = browser;
        this.proxyBrowserUrl = proxyUrl ?? null;
      } else {
        this.directBrowser = browser;
      }
      this.playwrightAvailable = true;
      this.resetIdleTimer(key, config);

      return browser;
    } catch (error) {
      this.playwrightAvailable = false;
      throw error;
    }
  }

  private resetIdleTimer(
    key: "direct" | "proxy",
    config: ScraperRuntimeConfig,
  ) {
    const current = this.idleTimers.get(key);
    if (current) {
      clearTimeout(current);
    }

    const timer = setTimeout(() => {
      void this.closeBrowser(key);
    }, config.browserIdleTimeoutMs);
    this.idleTimers.set(key, timer);
  }

  async closeBrowser(key: "direct" | "proxy") {
    const browser = key === "proxy" ? this.proxyBrowser : this.directBrowser;

    if (!browser) {
      return;
    }

    await browser.close().catch(() => undefined);
    if (key === "proxy") {
      this.proxyBrowser = null;
      this.proxyBrowserUrl = null;
    } else {
      this.directBrowser = null;
    }
    const timer = this.idleTimers.get(key);
    if (timer) {
      clearTimeout(timer);
      this.idleTimers.delete(key);
    }
  }

  async destroy() {
    await Promise.all([
      this.closeBrowser("direct"),
      this.closeBrowser("proxy"),
    ]);
  }

  getStats(): BrowserRuntimeStats {
    return {
      available: this.playwrightAvailable,
      direct: {
        active: Boolean(this.directBrowser),
        contexts: this.directBrowser?.contexts().length ?? 0,
      },
      proxy: {
        active: Boolean(this.proxyBrowser),
        contexts: this.proxyBrowser?.contexts().length ?? 0,
      },
    };
  }
}

async function executeHttpFetch(
  job: ScrapeJobMessage,
  context: Required<ScrapeExecutionContext>,
  methodLabel: string,
): Promise<ScraperStrategyResult> {
  await context.onStageChange("fetching", 15);
  await context.onEvent({
    type: "stage",
    stage: "fetching",
    progress: 15,
  });
  const startedAt = Date.now();
  const { options } = job;
  const controller = new AbortController();
  const timeoutMs = readTimeout(options, context.config);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(job.url, {
      method: options.method ?? "GET",
      headers: buildHeaders(options, context.config),
      body: buildBody(options),
      signal: controller.signal,
    });

    const content = await response.text();
    await context.onStageChange("extracting", 85);
    await context.onEvent({
      type: "stage",
      stage: "extracting",
      progress: 85,
    });

    if (!response.ok) {
      return {
        success: false,
        content,
        contentType: response.headers.get("content-type") ?? "text/plain",
        method: methodLabel,
        responseTimeMs: Date.now() - startedAt,
        error: `Upstream request failed with status ${response.status}`,
      };
    }

    return {
      success: true,
      content,
      contentType: response.headers.get("content-type") ?? "text/plain",
      method: methodLabel,
      responseTimeMs: Date.now() - startedAt,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown fetch error";

    return {
      success: false,
      content: "",
      contentType: "text/plain",
      method: methodLabel,
      responseTimeMs: Date.now() - startedAt,
      error: message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

class CloudscraperStrategy implements ScraperStrategy {
  async execute(
    job: ScrapeJobMessage,
    context: Required<ScrapeExecutionContext>,
  ): Promise<ScraperStrategyResult> {
    const dynamicImport = new Function(
      "specifier",
      "return import(specifier)",
    ) as (specifier: string) => Promise<any>;

    try {
      await context.onStageChange("fetching", 15);
      await context.onEvent({
        type: "stage",
        stage: "fetching",
        progress: 15,
      });
      const cloudscraperModule = await dynamicImport("cloudscraper");
      const cloudscraper = cloudscraperModule.default ?? cloudscraperModule;
      const startedAt = Date.now();
      const proxyUrl = resolveProxyUrl(job.options, context.config);
      const response = await cloudscraper({
        uri: new URL(job.url).href,
        method: job.options.method ?? "GET",
        body: job.options.body,
        form: job.options.formData,
        headers: buildHeaders(job.options, context.config),
        timeout: readTimeout(job.options, context.config),
        proxy: proxyUrl,
        gzip: true,
        resolveWithFullResponse: true,
      });

      const content =
        typeof response.body === "string"
          ? response.body
          : JSON.stringify(response.body);
      await context.onStageChange("extracting", 85);
      await context.onEvent({
        type: "stage",
        stage: "extracting",
        progress: 85,
      });

      return {
        success: true,
        content,
        contentType: response.headers["content-type"] ?? "text/html",
        method: proxyUrl ? "cloudscraper-proxy" : "cloudscraper-direct",
        responseTimeMs: Date.now() - startedAt,
      };
    } catch {
      return executeHttpFetch(job, context, "cloudscraper-http-fallback");
    }
  }
}

async function maybeWaitForSelector(
  page: any,
  selector?: string,
  timeoutMs?: number,
) {
  if (selector) {
    await page.waitForSelector(selector, { timeout: timeoutMs });
  }
}

async function maybeWaitForFunction(
  page: any,
  fn?: string,
  timeoutMs?: number,
) {
  if (fn) {
    await page.waitForFunction(fn, { timeout: timeoutMs });
  }
}

async function maybeWaitAdditionalDelay(page: any, additionalDelayMs?: number) {
  if (additionalDelayMs && additionalDelayMs > 0) {
    await page.waitForTimeout(additionalDelayMs);
  }
}

class PlaywrightStrategy implements ScraperStrategy {
  private readonly browserPool = BrowserPoolManager.getInstance();

  async execute(
    job: ScrapeJobMessage,
    context: Required<ScrapeExecutionContext>,
  ): Promise<ScraperStrategyResult> {
    const dynamicImport = new Function(
      "specifier",
      "return import(specifier)",
    ) as (specifier: string) => Promise<any>;

    try {
      const playwright = await dynamicImport("playwright");
      const startedAt = Date.now();
      const timeoutMs = readTimeout(job.options, context.config);
      const proxyUrl = resolveProxyUrl(job.options, context.config);
      const browser = await this.browserPool.getBrowser(
        proxyUrl,
        context.config,
      );
      await context.onStageChange("rendering", 40);
      await context.onEvent({
        type: "stage",
        stage: "rendering",
        progress: 40,
      });
      const page = await browser.newPage({
        userAgent: context.config.userAgent,
      });

      try {
        const waitUntil = (job.options.waitUntil ??
          "domcontentloaded") as ScrapeWaitUntil;
        const response = await page.goto(job.url, {
          timeout: timeoutMs,
          waitUntil,
        });

        await context.onStageChange("waiting_selector", 60);
        await context.onEvent({
          type: "stage",
          stage: "waiting_selector",
          progress: 60,
        });
        await maybeWaitForSelector(
          page,
          job.options.waitForSelector,
          timeoutMs,
        );
        await maybeWaitForFunction(
          page,
          job.options.waitForFunction,
          timeoutMs,
        );
        await maybeWaitAdditionalDelay(page, job.options.additionalDelayMs);

        await context.onStageChange("extracting", 85);
        await context.onEvent({
          type: "stage",
          stage: "extracting",
          progress: 85,
        });
        const contentType = response?.headers()["content-type"] ?? "text/html";
        const content = contentType.includes("text/html")
          ? await page.content()
          : ((await response?.text()) ?? "");

        return {
          success: true,
          content,
          contentType,
          method: proxyUrl ? "playwright-proxy" : "playwright-direct",
          responseTimeMs: Date.now() - startedAt,
        };
      } finally {
        await page.close().catch(() => undefined);
      }
    } catch {
      return executeHttpFetch(job, context, "playwright-http-fallback");
    }
  }
}

function createStrategies(): Record<
  Exclude<ScrapeStrategy, "auto">,
  ScraperStrategy
> {
  return {
    cloudscraper: new CloudscraperStrategy(),
    playwright: new PlaywrightStrategy(),
  };
}

function createFailureResult(
  job: ScrapeJobMessage,
  error: string,
  retries: number,
): ScrapeJobResult {
  return {
    jobId: job.jobId,
    status: "failed",
    progress: 100,
    stage: "completed",
    url: job.url,
    strategy: job.strategy,
    requestedAt: job.requestedAt,
    completedAt: new Date().toISOString(),
    retries,
    error,
  };
}

function createSuccessResult(
  job: ScrapeJobMessage,
  execution: ScraperStrategyResult,
  retries: number,
  cached = false,
): ScrapeJobResult {
  return {
    jobId: job.jobId,
    status: "completed",
    progress: 100,
    stage: "completed",
    url: job.url,
    strategy: job.strategy,
    requestedAt: job.requestedAt,
    completedAt: new Date().toISOString(),
    content: execution.content,
    preview: summarizeContent(execution.content),
    contentType: execution.contentType,
    method: execution.method,
    responseTimeMs: execution.responseTimeMs,
    retries,
    cached,
  };
}

export class ScraperService {
  private readonly strategies = createStrategies();
  private readonly browserPool = BrowserPoolManager.getInstance();

  async execute(
    job: ScrapeJobMessage,
    context?: ScrapeExecutionContext,
  ): Promise<ScrapeJobResult> {
    const resolvedContext = readConfig(context);
    const strategy =
      job.strategy === "auto"
        ? resolvedContext.config.defaultStrategy
        : job.strategy;
    const maxRetries =
      job.options.maxRetries ?? resolvedContext.config.maxRetries;
    const retryDelayMs =
      job.options.retryDelayMs ?? resolvedContext.config.retryDelayMs;
    const primaryStrategy =
      strategy === "auto" ? "cloudscraper" : strategy;

    await resolvedContext.onEvent({
      type: "strategy_selected",
      strategy: primaryStrategy,
      requestedStrategy: job.strategy,
    });

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const currentStrategy = strategy === "auto" ? "cloudscraper" : strategy;
      await resolvedContext.onEvent({
        type: "attempt_started",
        attempt,
        maxRetries,
        strategy: currentStrategy,
      });
      const primary = this.strategies[currentStrategy];
      const execution = await primary.execute(job, resolvedContext);

      if (execution.success) {
        await resolvedContext.onEvent({
          type: "strategy_succeeded",
          attempt,
          strategy: currentStrategy,
          method: execution.method,
          responseTimeMs: execution.responseTimeMs,
        });
        return createSuccessResult(job, execution, attempt);
      }

      await resolvedContext.onEvent({
        type: "strategy_failed",
        attempt,
        strategy: currentStrategy,
        method: execution.method,
        error: execution.error,
      });

      if (job.strategy === "auto" && currentStrategy === "cloudscraper") {
        await resolvedContext.onEvent({
          type: "fallback_started",
          from: "cloudscraper",
          to: "playwright",
          attempt,
        });
        const fallbackExecution = await this.strategies.playwright.execute(
          job,
          resolvedContext,
        );

        if (fallbackExecution.success) {
          await resolvedContext.onEvent({
            type: "strategy_succeeded",
            attempt,
            strategy: "playwright",
            method: fallbackExecution.method,
            responseTimeMs: fallbackExecution.responseTimeMs,
          });
          return createSuccessResult(job, fallbackExecution, attempt);
        }

        await resolvedContext.onEvent({
          type: "strategy_failed",
          attempt,
          strategy: "playwright",
          method: fallbackExecution.method,
          error: fallbackExecution.error,
        });
      }

      if (attempt === maxRetries) {
        return createFailureResult(
          job,
          execution.error ?? "Scraping failed",
          attempt,
        );
      }

      await resolvedContext.onEvent({
        type: "retry_scheduled",
        attempt,
        nextAttempt: attempt + 1,
        delayMs: retryDelayMs * Math.pow(2, attempt),
      });
      await new Promise((resolve) =>
        setTimeout(resolve, retryDelayMs * Math.pow(2, attempt)),
      );
    }

    return createFailureResult(job, "Max retries exceeded", maxRetries);
  }

  async dispose(): Promise<void> {
    await this.browserPool.destroy();
  }

  getRuntimeStats(): BrowserRuntimeStats {
    return this.browserPool.getStats();
  }
}
