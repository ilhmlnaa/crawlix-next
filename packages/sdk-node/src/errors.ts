export class CrawlixError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CrawlixError";
  }
}

export class CrawlixHttpError extends CrawlixError {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(
    message: string,
    options: {
      status: number;
      code?: string;
      details?: unknown;
    },
  ) {
    super(message);
    this.name = "CrawlixHttpError";
    this.status = options.status;
    this.code = options.code;
    this.details = options.details;
  }
}

export class CrawlixTimeoutError extends CrawlixError {
  constructor(message = "The request timed out.") {
    super(message);
    this.name = "CrawlixTimeoutError";
  }
}

export class CrawlixPollingTimeoutError extends CrawlixError {
  constructor(message = "Polling timed out before the job reached a terminal state.") {
    super(message);
    this.name = "CrawlixPollingTimeoutError";
  }
}

export class CrawlixWebhookVerificationError extends CrawlixError {
  constructor(message = "Webhook signature verification failed.") {
    super(message);
    this.name = "CrawlixWebhookVerificationError";
  }
}
