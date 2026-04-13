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

## Quick Start

```ts
import { CrawlixClient } from '@crawlixnext/sdk-node';

const client = new CrawlixClient({
  baseUrl: 'https://api.example.com/api',
  apiKey: 'cx_xxx',
});

const job = await client.createJob({
  url: 'https://example.com',
  strategy: 'auto',
});

const result = await client.waitForCompletion(job.jobId, {
  fetchResultOnCompleted: true,
});
```

## Features

- API key authenticated client
- async job creation and polling
- targeted worker dispatch support
- idempotent job creation support
- webhook signature verification helpers
- TypeScript-first public types
