# @crawlixnext/sdk-node

Node.js SDK for Crawlix Next public API.

## Install

```bash
pnpm add @crawlixnext/sdk-node
```

## Requirements

- Node.js 18 or newer
- Crawlix Next API key
- Crawlix Next API base URL

The SDK accepts your deployment origin, for example `https://crawlix-next-api.hamdiv.me`, and automatically appends `/api` internally. Base URLs that already end with `/api` remain supported for backward compatibility.

## Quick Start

```ts
import { CrawlixClient } from "@crawlixnext/sdk-node";

const client = new CrawlixClient({
  baseUrl: "https://api.example.com",
  apiKey: "cx_xxx",
});

const job = await client.createJob({
  url: "https://example.com",
  strategy: "auto",
});

const hostnameJob = await client.createJob({
  url: "https://example.com/heavy-page",
  strategy: "playwright",
  targetWorkerHostname: "crawlix-worker-east-1",
});

const serviceNameJob = await client.createJob({
  url: "https://example.com/heavy-page",
  strategy: "playwright",
  targetWorkerServiceName: "crawlix-worker-coolify",
});

const result = await client.waitForCompletion(job.jobId, {
  fetchResultOnCompleted: true,
});
```

## Faster Completion Polling

For low-latency workloads (for example static pages with `cloudscraper`), use adaptive polling:

```ts
const { job, terminal, metrics } = await client.createAndWaitAdaptive(
  {
    url: "https://example.com",
    strategy: "http",
  },
  {
    autoIdempotencyKey: true,
    idempotencyNamespace: "sdk-fast",
    pollingMode: "adaptive",
    timeoutMs: 20000,
  },
);

console.log(job.jobId, terminal.status, metrics);
```

If you want to keep using `waitForCompletion`, you can still switch polling mode:

```ts
const result = await client.waitForCompletion(job.jobId, {
  pollingMode: "adaptive",
  fetchResultOnCompleted: true,
});
```

Backward compatibility note:

- Existing calls keep the same behavior by default (`pollingMode: 'fixed'`, `intervalMs: 2000`).
- New options are additive and optional.

## Webhook Integration (Recommended for Production)

For production workloads, webhooks eliminate polling entirely. Instead of repeatedly checking job status, the worker pushes results directly to your endpoint when a job completes.

### Why webhooks over polling?

- **0 polling requests** — no rate limit usage for status checks
- **Real-time** — notified the moment a job finishes
- **Scalable** — handles thousands of concurrent jobs without multiplying API calls

### Submit a job with webhook

```ts
const job = await client.createJob({
  url: "https://example.com",
  strategy: "http",
  webhookUrl: "https://your-server.com/crawlix/webhook",
  webhookSecret: "your-hmac-secret",
});
// No need to call waitForCompletion — the result comes to you
```

### Receive and verify webhook

```ts
import { assertWebhookSignature, parseWebhookEvent } from "@crawlixnext/sdk-node";

app.post("/crawlix/webhook", (req, res) => {
  assertWebhookSignature({
    secret: "your-hmac-secret",
    timestamp: req.headers["x-crawlix-timestamp"],
    rawBody: req.body, // must be raw Buffer, not parsed JSON
    signature: req.headers["x-crawlix-signature"],
  });

  const event = parseWebhookEvent(JSON.parse(req.body.toString()));

  if (event.event === "job.completed") {
    // Fetch full result if needed
    const result = await client.getJobResult(event.data.jobId);
  }

  res.sendStatus(200);
});
```

### Webhook events

| Event | When |
|---|---|
| `job.completed` | Job finished successfully |
| `job.failed` | Job failed after all retries |
| `job.cancelled` | Job was cancelled |
| `job.timeout` | Job exceeded timeout |

See `examples/crawlix-webhook/` for a complete working example with Express.

## Features

- API key authenticated client
- async job creation and polling
- adaptive polling and adaptive create-and-wait helper
- targeted worker dispatch support by worker ID, service name, or worker hostname
- idempotent job creation support
- webhook signature verification helpers
- TypeScript-first public types
