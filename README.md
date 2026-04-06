# Crawlix Next

Monorepo `pnpm` + Turborepo untuk fondasi Crawlix versi baru dengan Next.js dashboard, NestJS API, dan NestJS worker.

## Apps

- `apps/web`: dashboard internal Next.js
- `apps/api`: NestJS API untuk enqueue job dan baca status/result
- `apps/worker`: NestJS worker untuk consume RabbitMQ dan memproses job

## Packages

- `packages/config`: shared runtime config/env helper
- `packages/shared`: helper umum lintas app
- `packages/queue-contracts`: kontrak payload job/status/result
- `packages/observability`: helper log/bootstrapping dasar

## Local development

1. Salin root [`.env.example`](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\.env.example) menjadi `.env` untuk workflow lokal standar.
2. Jalankan infra lokal:
   - `pnpm dev:infra`
3. Jalankan aplikasi secara terpisah:
   - `pnpm dev:api`
   - `pnpm dev:worker`
   - `pnpm dev:web`
4. Buka:
   - Dashboard: `http://localhost:3000`
   - API: `http://localhost:3001/api`
   - RabbitMQ UI: `http://localhost:15672`

## Full docker runtime

Gunakan satu command untuk menjalankan stack penuh:

```bash
pnpm docker:up
```

Service yang dijalankan:
- `web`
- `api`
- `worker`
- `rabbitmq`
- `redis`

Untuk menghentikan:

```bash
pnpm docker:down
```

## Health endpoints

- Liveness API:
  - `GET /api/health/live`
- Readiness API:
  - `GET /api/health/ready`

Readiness akan memeriksa:
- koneksi Redis
- queue RabbitMQ
- queue depth dan consumer count

## Current Phase

Production foundation yang sudah aktif:
- enqueue job via API key
- dashboard admin dengan session/cookie
- API key management dari dashboard
- worker heartbeat aktif di Redis
- retry queue dan DLQ di RabbitMQ
- queue depth utama, retry, dan DLQ di dashboard
- cancel dan retry action untuk operator
- docker compose lokal dan compose production-oriented
- integration/e2e test dasar untuk auth, jobs flow, dan retry/DLQ worker

## Env strategy

- Untuk workflow lokal normal dari root monorepo, cukup pakai root [`.env.example`](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\.env.example) menjadi `.env`.
- Saya juga tambahkan contoh per app:
  - [apps/api/.env.example](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\apps\api\.env.example)
  - [apps/worker/.env.example](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\apps\worker\.env.example)
  - [apps/web/.env.example](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\apps\web\.env.example)
- File per app ini berguna kalau nanti API, worker, dan web dijalankan atau dideploy terpisah.
- Jadi jawabannya: tidak wajib membuat `.env` di setiap folder `apps`, tapi itu berguna untuk deployment terpisah atau local run per service.

Env auth tambahan yang sekarang wajib untuk API production:
- `DASHBOARD_ORIGIN`
- `SESSION_SECRET`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_SECONDS`
- `DASHBOARD_ADMIN_EMAIL`
- `DASHBOARD_ADMIN_PASSWORD`
- `API_KEY_PREFIX`

Env queue hardening tambahan:
- `RABBITMQ_RETRY_QUEUE_NAME`
- `RABBITMQ_DLQ_QUEUE_NAME`
- `RABBITMQ_RETRY_DELAY_MS`
- `RABBITMQ_MAX_DELIVERY_ATTEMPTS`

## Production hardening status

Yang sudah ada:
- validasi config fail-fast saat bootstrap API dan worker
- API liveness dan readiness endpoint
- heartbeat worker aktif di Redis
- queue depth main/retry/DLQ dan consumer count dari RabbitMQ
- retry dan cancel action untuk job queued
- session auth untuk dashboard internal
- API key auth untuk client programmatic
- endpoint admin untuk create/list/revoke API key
- test e2e dasar untuk auth, key flow, enqueue, retry, cancel, dan worker retry/DLQ
- docker compose healthcheck untuk `rabbitmq`, `redis`, `api`, dan `web`
- graceful shutdown hook di API dan worker

Yang masih perlu sebelum saya sebut production-ready penuh untuk traffic besar:
- test integration/e2e yang lebih lengkap dengan Redis/RabbitMQ nyata
- finalisasi runtime Playwright/cloudscraper production
- observability stack terpisah seperti Prometheus/Grafana/log aggregation
- deployment manifest final untuk target nyata seperti ECS/Kubernetes

## Deployment guide

Panduan deploy final ada di:

- [docs/deployment.md](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\docs\deployment.md)
- [docker-compose.prod.yml](E:\Data Kuliah\Tingkat 4\nganggur\EndGame\crawlix-next\docker-compose.prod.yml)

Dokumen itu mencakup:
- full Docker stack
- `web`/`api` di Docker + worker di EC2 VM
- worker horizontal multi-host
- contoh `systemd` untuk worker
- env yang wajib sama antar worker
- rolling update dan health endpoint load balancer
