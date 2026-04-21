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
    strategy: "cloudscraper",
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

## Features

- API key authenticated client
- async job creation and polling
- adaptive polling and adaptive create-and-wait helper
- targeted worker dispatch support by worker ID or worker hostname
- idempotent job creation support
- webhook signature verification helpers
- TypeScript-first public types
