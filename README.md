<div align="center">

<img src="https://storage.hamdiv.me/project/crawlix/crawlix-next.png" alt="Crawlix Next" width="480" height="270" style="border-radius: 12px;" />

<!-- https://media1.tenor.com/m/gWFk3_M14rkAAAAd/craft-anime.gif -->

<p>
  <img src="https://img.shields.io/badge/Next.js-16+-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js">
  <img src="https://img.shields.io/badge/NestJS-11+-E0234E?style=flat-square&logo=nestjs&logoColor=white" alt="NestJS">
  <img src="https://img.shields.io/badge/TypeScript-5.9+-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/Turborepo-Monorepo-EF4444?style=flat-square&logo=turborepo&logoColor=white" alt="Turborepo">
  <img src="https://img.shields.io/badge/RabbitMQ-Queue-FF6600?style=flat-square&logo=rabbitmq&logoColor=white" alt="RabbitMQ">
  <img src="https://img.shields.io/badge/Redis-State%20%26%20Cache-DC382D?style=flat-square&logo=redis&logoColor=white" alt="Redis">
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind CSS">
  <img src="https://img.shields.io/badge/Docker-Ready-2496ED?style=flat-square&logo=docker&logoColor=white" alt="Docker">
</p>

</div>

---

# Crawlix Next

> Crawlix Next is a production-oriented scraping platform built as a `pnpm` monorepo with a Next.js operations dashboard, a NestJS API, and horizontally scalable NestJS workers backed by RabbitMQ and Redis.

Crawlix Next separates request handling from job execution so the platform can stay responsive under load, route jobs through queues, and scale API and worker capacity independently. The current codebase already includes dashboard authentication, API key based programmatic access, worker heartbeat tracking, retry and dead-letter handling, targeted worker dispatch, and deployment-ready Docker artifacts.

---

## Table of Contents

- [Overview](#overview)
- [Core Capabilities](#core-capabilities)
- [Architecture](#architecture)
- [Workspace Structure](#workspace-structure)
- [Technology Stack](#technology-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [Environment Strategy](#environment-strategy)
- [Development Scripts](#development-scripts)
- [Running the Platform](#running-the-platform)
- [Docker Images and Deployment Notes](#docker-images-and-deployment-notes)
- [Health Endpoints](#health-endpoints)
- [Testing and Verification](#testing-and-verification)
- [Documentation](#documentation)
- [Production Readiness Status](#production-readiness-status)
- [Troubleshooting](#troubleshooting)

---

## Overview

Crawlix Next is designed for teams that need a clear separation between:

- inbound API traffic
- background scraping execution
- operational visibility
- deployment flexibility

Instead of performing heavy scraping work directly in the request cycle, the API enqueues jobs to RabbitMQ and dedicated workers process them asynchronously. Redis stores job status, results, cache entries, worker heartbeats, and lightweight operational state used by the dashboard.

This design makes it practical to:

- scale API instances independently from workers
- run workers in Docker, on EC2 virtual machines, or across multiple hosts
- route jobs to the shared fleet or pin them to a specific worker
- inspect queue health, job lifecycle, and worker activity from one dashboard

---

## Core Capabilities

- Asynchronous scrape job execution through RabbitMQ and Redis-backed state management
- Separate applications for `web`, `api`, `worker`, and `docs`
- Session-based admin dashboard authentication for operators
- API key authentication for programmatic job creation and polling
- Retry queue and dead-letter queue handling for recoverable and permanent failures
- Worker heartbeat registry with `workerId`, hostname, status, counters, and queue metadata
- Targeted worker dispatch through `targetWorkerId` in `POST /api/jobs`
- Admin dashboard for queue metrics, worker fleet visibility, retry, cancel, and API key management
- Production-oriented Dockerfiles for API and worker, plus compose definitions for local and production-style runtime
- Fumadocs-based documentation site for platform, API, worker, and deployment guidance

---

## Architecture

```text
Client / Integration
        |
        v
   NestJS API
        |
        v
    RabbitMQ
   /       \
  v         v
Shared   Worker-specific
Queue      Queues
  \         /
   v       v
 NestJS Workers
        |
        v
      Redis
        |
        v
 Next.js Dashboard
```

### Runtime responsibilities

- `apps/api`
  Accepts authenticated requests, validates payloads, writes job records, publishes queue messages, and serves operational/admin endpoints.
- `apps/worker`
  Consumes jobs from RabbitMQ, executes scrape strategies, updates Redis state, emits worker heartbeat, and manages retry or dead-letter behavior.
- `apps/web`
  Provides an internal dashboard for operators to monitor queues, inspect jobs, manage API keys, and dispatch targeted jobs.
- `apps/docs`
  Hosts product and operational documentation using Fumadocs.

---

## Workspace Structure

```text
crawlix-next/
├── apps/
│   ├── api/        # NestJS API
│   ├── docs/       # Fumadocs site
│   ├── web/        # Next.js admin dashboard
│   └── worker/     # NestJS background worker
├── packages/
│   ├── config/             # Shared environment parsing and runtime config
│   ├── observability/      # Logging and runtime helpers
│   ├── queue-contracts/    # Shared job, auth, worker, and response types
│   ├── scraper/            # Scrape orchestration and strategy runtime
│   ├── shared/             # Shared helpers and key builders
│   ├── ui/                 # Shared UI package
│   ├── eslint-config/      # Shared ESLint config
│   └── typescript-config/  # Shared TypeScript config
├── docker/
│   ├── api.Dockerfile
│   ├── web.Dockerfile
│   └── worker.Dockerfile
├── docs/
│   └── deployment.md
├── docker-compose.yml
├── docker-compose.prod.yml
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

---

## Technology Stack

| Area               | Technology                                                                      |
| ------------------ | ------------------------------------------------------------------------------- |
| Frontend dashboard | Next.js App Router, Tailwind CSS, shadcn/ui                                     |
| API                | NestJS                                                                          |
| Worker runtime     | NestJS                                                                          |
| Queue broker       | RabbitMQ                                                                        |
| State and cache    | Redis                                                                           |
| Monorepo tooling   | pnpm, Turborepo                                                                 |
| Scraping execution | Shared scraper package with `auto`, `cloudscraper`, and `playwright` strategies |
| Documentation      | Fumadocs                                                                        |
| Containerization   | Docker, Docker Compose                                                          |

---

## Prerequisites

Before running the project, ensure these tools are available:

| Tool    | Minimum Version       | Notes                                                       |
| ------- | --------------------- | ----------------------------------------------------------- |
| Node.js | `>= 18`               | Required for the monorepo                                   |
| pnpm    | `>= 9`                | Official package manager used by this repository            |
| Docker  | Recent stable version | Needed for local RabbitMQ, Redis, and containerized runtime |
| Git     | Recent stable version | Recommended for branch and release workflow                 |

---

## Quick Start

### 1. Clone the repository

```bash
git clone <your-repository-url>
cd crawlix-next
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Create local environment file

```bash
cp .env.example .env
```

If you are on Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

### 4. Start infrastructure services

```bash
pnpm dev:infra
```

### 5. Run the applications

In separate terminals:

```bash
pnpm dev:api
pnpm dev:worker
pnpm dev:web
```

Optional:

```bash
pnpm dev:docs
```

### 6. Open the platform

| Service             | URL                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------ |
| Dashboard           | [http://localhost:3000](http://localhost:3000)                                       |
| API base            | [http://localhost:3001/api](http://localhost:3001/api)                               |
| Worker health       | [http://localhost:3002/worker/health/live](http://localhost:3002/worker/health/live) |
| RabbitMQ management | [http://localhost:15672](http://localhost:15672)                                     |
| Docs                | [http://localhost:3005](http://localhost:3005)                                       |

---

## Configuration

For standard local development, use the root `.env` file. The repository already includes a structured [`.env.example`](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\.env.example) with grouped sections for:

- shared infrastructure
- API service
- dashboard authentication
- worker service
- scraper runtime
- web application

### Important environment variables

| Variable                           | Purpose                                            |
| ---------------------------------- | -------------------------------------------------- |
| `API_PORT`                         | Dedicated port for the NestJS API                  |
| `WORKER_PORT`                      | Dedicated port for the NestJS worker               |
| `DASHBOARD_PORT`                   | Dedicated port for the Next.js dashboard runtime   |
| `RABBITMQ_URL`                     | RabbitMQ connection string                         |
| `REDIS_URL`                        | Redis connection string                            |
| `RABBITMQ_QUEUE_NAME`              | Shared main queue name                             |
| `RABBITMQ_RETRY_QUEUE_NAME`        | Shared retry queue                                 |
| `RABBITMQ_DLQ_QUEUE_NAME`          | Shared dead-letter queue                           |
| `SESSION_SECRET`                   | Cookie session signing secret                      |
| `DASHBOARD_ADMIN_EMAIL`            | Seeded admin email                                 |
| `DASHBOARD_ADMIN_PASSWORD`         | Seeded admin password                              |
| `NEXT_PUBLIC_API_BASE_URL`         | Public API URL used by the dashboard at build time |
| `SCRAPER_DEFAULT_STRATEGY`         | Default strategy for job creation                  |
| `PUBLIC_API_RATE_LIMIT_PER_MINUTE` | Public API throttling threshold                    |

### Per-app environment examples

These examples are useful when services are deployed independently:

- [apps/api/.env.example](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\apps\api\.env.example)
- [apps/worker/.env.example](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\apps\worker\.env.example)
- [apps/web/.env.example](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\apps\web\.env.example)

---

## Environment Strategy

Use the following model when deciding where environment variables should live:

- Root `.env`
  Use this for standard monorepo development where `api`, `worker`, and `web` run together locally.
- Per-app `.env`
  Use these when deploying `api`, `worker`, and `web` as separate services or when running them independently in different environments.
- `apps/web`
  Pay extra attention to `NEXT_PUBLIC_*` variables. These are injected at build time and must be set before building the Next.js dashboard.

### Port variables

The root environment file now supports service-specific ports:

- `API_PORT`
- `WORKER_PORT`
- `DASHBOARD_PORT`

For backward compatibility, `PORT` is still accepted as a fallback. The lookup priority is:

- API: `API_PORT` -> `PORT` -> `3001`
- Worker: `WORKER_PORT` -> `PORT` -> `3002`
- Dashboard: `DASHBOARD_PORT` -> `PORT` -> `3000`

This matters especially for Docker deployment:

- `api` and `worker` can use environment variables directly at runtime
- `web` should be built with the correct `NEXT_PUBLIC_API_BASE_URL` for the target environment

---

## Development Scripts

Run all commands from the repository root:

| Command            | Purpose                                         |
| ------------------ | ----------------------------------------------- |
| `pnpm install`     | Install workspace dependencies                  |
| `pnpm dev`         | Start main app development pipeline             |
| `pnpm dev:api`     | Start NestJS API in watch mode                  |
| `pnpm dev:worker`  | Start NestJS worker in watch mode               |
| `pnpm dev:web`     | Start Next.js dashboard                         |
| `pnpm dev:docs`    | Start Fumadocs site                             |
| `pnpm dev:infra`   | Start RabbitMQ and Redis through Docker Compose |
| `pnpm build`       | Build all packages and applications             |
| `pnpm check-types` | Run TypeScript checks across the workspace      |
| `pnpm lint`        | Run linting tasks                               |
| `pnpm docker:up`   | Start the full local Docker stack               |
| `pnpm docker:down` | Stop the local Docker stack                     |
| `pnpm docker:logs` | Stream container logs                           |

---

## Running the Platform

### Local services mode

Use this when you want the fastest development loop:

1. start RabbitMQ and Redis with `pnpm dev:infra`
2. run `pnpm dev:api`
3. run `pnpm dev:worker`
4. run `pnpm dev:web`

### Full Docker mode

Use this when you want the full stack through Compose:

```bash
pnpm docker:up
```

To stop it:

```bash
pnpm docker:down
```

---

## Docker Images and Deployment Notes

The repository includes dedicated production Dockerfiles for:

- API: [docker/api.Dockerfile](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\docker\api.Dockerfile)
- Worker: [docker/worker.Dockerfile](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\docker\worker.Dockerfile)
- Web: [docker/web.Dockerfile](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\docker\web.Dockerfile)

### Important note about API and worker images

The API and worker services already have dedicated production image definitions and are ready to be built and shipped as stable runtime containers.

### Important note about the web image

The web dashboard should be built specifically for the target environment because `NEXT_PUBLIC_API_BASE_URL` is embedded during the Next.js build. In practice, this means:

- `api` and `worker` are straightforward runtime container targets
- `web` should be rebuilt whenever its `NEXT_PUBLIC_*` values change

### Production Compose

Use [docker-compose.prod.yml](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\docker-compose.prod.yml) for production-oriented container orchestration.

This file already separates:

- `api`
- `worker`
- `web`

and expects you to provide the correct environment values before startup.

### Hybrid deployment support

The current architecture supports:

- full Docker stack
- `web` and `api` in Docker with `worker` on EC2 via `systemd`
- multiple workers across different hosts connected to the same RabbitMQ and Redis infrastructure

For detailed deployment examples, see [docs/deployment.md](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\docs\deployment.md).

---

## Health Endpoints

### API

- `GET /api/health/live`
- `GET /api/health/ready`

API readiness verifies:

- Redis connectivity
- RabbitMQ queue access
- queue depth and consumer visibility

### Worker

- `GET /worker/health/live`
- `GET /worker/health/ready`

Worker readiness verifies:

- process health
- queue connectivity
- Redis connectivity
- browser runtime readiness information

---

## Testing and Verification

The repository already includes build, typecheck, and end-to-end coverage for the core platform flow.

### Recommended verification commands

```bash
pnpm build
pnpm check-types
pnpm --filter @repo/api test:e2e
pnpm --filter @repo/worker test:e2e
```

### What is currently covered

- dashboard authentication flow
- API key management flow
- job creation and polling
- targeted worker routing behavior
- retry and dead-letter handling
- worker queue processing lifecycle

---

## Documentation

The documentation site is available under `apps/docs` and uses Fumadocs.

Useful references:

- Docs app: [apps/docs](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\apps\docs)
- Deployment guide: [docs/deployment.md](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\docs\deployment.md)
- Public jobs API docs: [apps/docs/content/docs/api/jobs.mdx](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\apps\docs\content\docs\api\jobs.mdx)
- Worker runtime docs: [apps/docs/content/docs/worker/runtime.mdx](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\apps\docs\content\docs\worker\runtime.mdx)

---

## Production Readiness Status

### Implemented today

- Monorepo structure with separate `web`, `api`, `worker`, and `docs`
- Session-protected operator dashboard
- API key protected programmatic job endpoints
- RabbitMQ queue, retry queue, and dead-letter queue flow
- Redis-backed job state, result storage, cache, and worker heartbeat
- Worker-targeted dispatch using `targetWorkerId`
- Dashboard metrics for queue state, job lifecycle, and worker fleet activity
- Docker and hybrid deployment support
- Fumadocs-based product and operational documentation

### Recommended next-level hardening

These are no longer blockers for normal deployment, but are worth adding for large-scale environments:

- Prometheus and Grafana integration
- centralized log aggregation
- secrets manager integration
- CI/CD release pipeline with image publishing
- infrastructure-specific deployment manifests such as ECS or Kubernetes

---

## Troubleshooting

### `pnpm install` fails

Make sure your Node.js and `pnpm` versions satisfy the repository requirements:

```bash
node -v
pnpm -v
```

### API boots but dashboard cannot connect

Verify:

- `NEXT_PUBLIC_API_BASE_URL` points to the correct API origin
- the dashboard was rebuilt after changing `NEXT_PUBLIC_*`
- `CORS_ORIGIN` and `DASHBOARD_ORIGIN` match the dashboard host

### Jobs stay queued

Check:

- RabbitMQ is reachable
- the worker service is running
- the worker heartbeat appears in the dashboard
- targeted jobs are not pinned to a worker that is currently offline

### Login works locally but not after deployment

Verify:

- `SESSION_SECRET` is present
- `DASHBOARD_ORIGIN` is set correctly
- your proxy or load balancer forwards cookies properly

### Web container points to the wrong API

This usually means the dashboard was built with the wrong `NEXT_PUBLIC_API_BASE_URL`. Rebuild the web image using the correct environment value before deployment.
