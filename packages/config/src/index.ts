export interface QueueConfig {
  url: string;
  queueName: string;
  retryQueueName: string;
  deadLetterQueueName: string;
  retryDelayMs: number;
  maxDeliveryAttempts: number;
}

export interface RedisConfig {
  url: string;
  jobPrefix: string;
  resultTtlSeconds: number;
}

export interface ApiRuntimeConfig {
  serviceName: string;
  port: number;
  corsOrigin: string;
  publicApiRateLimitPerMinute: number;
  queue: QueueConfig;
  redis: RedisConfig;
  scraper: ScraperRuntimeConfig;
  auth: AuthRuntimeConfig;
}

export interface WorkerRuntimeConfig {
  serviceName: string;
  port: number;
  queue: QueueConfig;
  redis: RedisConfig;
  scraper: ScraperRuntimeConfig;
}

export interface WebRuntimeConfig {
  apiBaseUrl: string;
}

export interface AuthRuntimeConfig {
  sessionSecret: string;
  sessionCookieName: string;
  sessionTtlSeconds: number;
  dashboardOrigin: string;
  adminEmail: string;
  adminPassword: string;
  apiKeyPrefix: string;
}

export interface ScraperRuntimeConfig {
  defaultStrategy: "cloudscraper" | "playwright" | "auto";
  defaultTimeoutMs: number;
  defaultCacheTtlSeconds: number;
  maxRetries: number;
  retryDelayMs: number;
  userAgent: string;
  proxyUrl?: string;
  playwrightHeadless: boolean;
  playwrightExecutablePath?: string;
  browserIdleTimeoutMs: number;
}

function readNumber(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function readPort(
  env: NodeJS.ProcessEnv,
  specificKey: string,
  fallback: number,
): number {
  return readNumber(env[specificKey] ?? env.PORT, fallback);
}

function readQueueConfig(env: NodeJS.ProcessEnv): QueueConfig {
  return {
    url: env.RABBITMQ_URL ?? "amqp://localhost:5672",
    queueName: env.RABBITMQ_QUEUE_NAME ?? "crawlix.scrape.jobs",
    retryQueueName:
      env.RABBITMQ_RETRY_QUEUE_NAME ?? "crawlix.scrape.jobs.retry",
    deadLetterQueueName:
      env.RABBITMQ_DLQ_QUEUE_NAME ?? "crawlix.scrape.jobs.dlq",
    retryDelayMs: readNumber(env.RABBITMQ_RETRY_DELAY_MS, 15000),
    maxDeliveryAttempts: readNumber(env.RABBITMQ_MAX_DELIVERY_ATTEMPTS, 3),
  };
}

function assertNonEmpty(value: string, label: string): string {
  if (!value.trim()) {
    throw new Error(`${label} must not be empty`);
  }

  return value;
}

function assertPositiveInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }

  return value;
}

function assertUrl(value: string, label: string): string {
  try {
    new URL(value);
    return value;
  } catch {
    throw new Error(`${label} must be a valid URL`);
  }
}

function validateQueueConfig(config: QueueConfig): QueueConfig {
  return {
    url: assertUrl(assertNonEmpty(config.url, "RABBITMQ_URL"), "RABBITMQ_URL"),
    queueName: assertNonEmpty(config.queueName, "RABBITMQ_QUEUE_NAME"),
    retryQueueName: assertNonEmpty(
      config.retryQueueName,
      "RABBITMQ_RETRY_QUEUE_NAME",
    ),
    deadLetterQueueName: assertNonEmpty(
      config.deadLetterQueueName,
      "RABBITMQ_DLQ_QUEUE_NAME",
    ),
    retryDelayMs: assertPositiveInteger(
      config.retryDelayMs,
      "RABBITMQ_RETRY_DELAY_MS",
    ),
    maxDeliveryAttempts: assertPositiveInteger(
      config.maxDeliveryAttempts,
      "RABBITMQ_MAX_DELIVERY_ATTEMPTS",
    ),
  };
}

function validateRedisConfig(config: RedisConfig): RedisConfig {
  return {
    url: assertUrl(assertNonEmpty(config.url, "REDIS_URL"), "REDIS_URL"),
    jobPrefix: assertNonEmpty(config.jobPrefix, "REDIS_JOB_PREFIX"),
    resultTtlSeconds: assertPositiveInteger(
      config.resultTtlSeconds,
      "RESULT_TTL_SECONDS",
    ),
  };
}

function validateScraperConfig(
  config: ScraperRuntimeConfig,
): ScraperRuntimeConfig {
  return {
    ...config,
    defaultTimeoutMs: assertPositiveInteger(
      config.defaultTimeoutMs,
      "SCRAPER_TIMEOUT_MS",
    ),
    defaultCacheTtlSeconds: assertPositiveInteger(
      config.defaultCacheTtlSeconds,
      "SCRAPER_CACHE_TTL_SECONDS",
    ),
    maxRetries:
      Number.isInteger(config.maxRetries) && config.maxRetries >= 0
        ? config.maxRetries
        : (() => {
            throw new Error("SCRAPER_MAX_RETRIES must be 0 or greater");
          })(),
    retryDelayMs:
      Number.isInteger(config.retryDelayMs) && config.retryDelayMs >= 0
        ? config.retryDelayMs
        : (() => {
            throw new Error("SCRAPER_RETRY_DELAY_MS must be 0 or greater");
          })(),
    userAgent: assertNonEmpty(config.userAgent, "SCRAPER_USER_AGENT"),
    playwrightHeadless: config.playwrightHeadless,
    browserIdleTimeoutMs: assertPositiveInteger(
      config.browserIdleTimeoutMs,
      "PLAYWRIGHT_BROWSER_IDLE_TIMEOUT_MS",
    ),
    proxyUrl: config.proxyUrl?.trim() ? config.proxyUrl : undefined,
    playwrightExecutablePath: config.playwrightExecutablePath?.trim()
      ? config.playwrightExecutablePath
      : undefined,
  };
}

function validateAuthConfig(config: AuthRuntimeConfig): AuthRuntimeConfig {
  return {
    sessionSecret: assertNonEmpty(config.sessionSecret, "SESSION_SECRET"),
    sessionCookieName: assertNonEmpty(
      config.sessionCookieName,
      "SESSION_COOKIE_NAME",
    ),
    sessionTtlSeconds: assertPositiveInteger(
      config.sessionTtlSeconds,
      "SESSION_TTL_SECONDS",
    ),
    dashboardOrigin: assertUrl(
      assertNonEmpty(config.dashboardOrigin, "DASHBOARD_ORIGIN"),
      "DASHBOARD_ORIGIN",
    ),
    adminEmail: assertNonEmpty(config.adminEmail, "DASHBOARD_ADMIN_EMAIL"),
    adminPassword: assertNonEmpty(
      config.adminPassword,
      "DASHBOARD_ADMIN_PASSWORD",
    ),
    apiKeyPrefix: assertNonEmpty(config.apiKeyPrefix, "API_KEY_PREFIX"),
  };
}

export function validateApiRuntimeConfig(
  config: ApiRuntimeConfig,
): ApiRuntimeConfig {
  return {
    ...config,
    serviceName: assertNonEmpty(config.serviceName, "API_SERVICE_NAME"),
    port: assertPositiveInteger(config.port, "API_PORT"),
    corsOrigin: assertNonEmpty(config.corsOrigin, "CORS_ORIGIN"),
    publicApiRateLimitPerMinute: assertPositiveInteger(
      config.publicApiRateLimitPerMinute,
      "PUBLIC_API_RATE_LIMIT_PER_MINUTE",
    ),
    queue: validateQueueConfig(config.queue),
    redis: validateRedisConfig(config.redis),
    scraper: validateScraperConfig(config.scraper),
    auth: validateAuthConfig(config.auth),
  };
}

export function validateWorkerRuntimeConfig(
  config: WorkerRuntimeConfig,
): WorkerRuntimeConfig {
  return {
    ...config,
    serviceName: assertNonEmpty(config.serviceName, "WORKER_SERVICE_NAME"),
    port: assertPositiveInteger(config.port, "WORKER_PORT"),
    queue: validateQueueConfig(config.queue),
    redis: validateRedisConfig(config.redis),
    scraper: validateScraperConfig(config.scraper),
  };
}

export function validateWebRuntimeConfig(
  config: WebRuntimeConfig,
): WebRuntimeConfig {
  return {
    apiBaseUrl: assertUrl(
      assertNonEmpty(config.apiBaseUrl, "NEXT_PUBLIC_API_BASE_URL"),
      "NEXT_PUBLIC_API_BASE_URL",
    ),
  };
}

function readRedisConfig(env: NodeJS.ProcessEnv): RedisConfig {
  return {
    url: env.REDIS_URL ?? "redis://localhost:6379",
    jobPrefix: env.REDIS_JOB_PREFIX ?? "crawlix:jobs",
    resultTtlSeconds: readNumber(env.RESULT_TTL_SECONDS, 3600),
  };
}

function readScraperConfig(env: NodeJS.ProcessEnv): ScraperRuntimeConfig {
  const defaultStrategy = env.SCRAPER_DEFAULT_STRATEGY;

  return {
    defaultStrategy:
      defaultStrategy === "cloudscraper" ||
      defaultStrategy === "playwright" ||
      defaultStrategy === "auto"
        ? defaultStrategy
        : "auto",
    defaultTimeoutMs: readNumber(env.SCRAPER_TIMEOUT_MS, 30000),
    defaultCacheTtlSeconds: readNumber(env.SCRAPER_CACHE_TTL_SECONDS, 900),
    maxRetries: readNumber(env.SCRAPER_MAX_RETRIES, 2),
    retryDelayMs: readNumber(env.SCRAPER_RETRY_DELAY_MS, 1000),
    userAgent:
      env.SCRAPER_USER_AGENT ??
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
    proxyUrl: env.SCRAPER_PROXY_URL,
    playwrightHeadless: env.PLAYWRIGHT_HEADLESS !== "false",
    playwrightExecutablePath: env.PLAYWRIGHT_EXECUTABLE_PATH,
    browserIdleTimeoutMs: readNumber(
      env.PLAYWRIGHT_BROWSER_IDLE_TIMEOUT_MS,
      120000,
    ),
  };
}

function readAuthConfig(env: NodeJS.ProcessEnv): AuthRuntimeConfig {
  return {
    sessionSecret: env.SESSION_SECRET ?? "change-me-session-secret",
    sessionCookieName: env.SESSION_COOKIE_NAME ?? "crawlix_session",
    sessionTtlSeconds: readNumber(env.SESSION_TTL_SECONDS, 60 * 60 * 12),
    dashboardOrigin: env.DASHBOARD_ORIGIN ?? "http://localhost:3000",
    adminEmail: env.DASHBOARD_ADMIN_EMAIL ?? "admin@crawlix.local",
    adminPassword: env.DASHBOARD_ADMIN_PASSWORD ?? "change-me-admin-password",
    apiKeyPrefix: env.API_KEY_PREFIX ?? "cx",
  };
}

export function getApiRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): ApiRuntimeConfig {
  return {
    serviceName: env.API_SERVICE_NAME ?? "crawlix-api",
    port: readPort(env, "API_PORT", 3001),
    corsOrigin: env.CORS_ORIGIN ?? "*",
    publicApiRateLimitPerMinute: readNumber(
      env.PUBLIC_API_RATE_LIMIT_PER_MINUTE,
      60,
    ),
    queue: readQueueConfig(env),
    redis: readRedisConfig(env),
    scraper: readScraperConfig(env),
    auth: readAuthConfig(env),
  };
}

export function getWorkerRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): WorkerRuntimeConfig {
  return {
    serviceName: env.WORKER_SERVICE_NAME ?? "crawlix-worker",
    port: Number(env.PORT ?? readPort(env, "WORKER_PORT", 3002)),
    queue: readQueueConfig(env),
    redis: readRedisConfig(env),
    scraper: readScraperConfig(env),
  };
}

export function getWebRuntimeConfig(
  env: NodeJS.ProcessEnv = process.env,
): WebRuntimeConfig {
  return {
    apiBaseUrl: env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001/api",
  };
}
