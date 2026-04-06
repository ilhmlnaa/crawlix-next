# Deployment Guide

## Shared infrastructure

Semua deployment model wajib memakai infrastruktur yang sama untuk:

- RabbitMQ
- Redis
- env queue contract yang konsisten

Nilai berikut harus sama di semua instance API dan worker:

- `RABBITMQ_URL`
- `RABBITMQ_QUEUE_NAME`
- `RABBITMQ_RETRY_QUEUE_NAME`
- `RABBITMQ_DLQ_QUEUE_NAME`
- `RABBITMQ_RETRY_DELAY_MS`
- `RABBITMQ_MAX_DELIVERY_ATTEMPTS`
- `REDIS_URL`
- `REDIS_JOB_PREFIX`
- `RESULT_TTL_SECONDS`

Nilai berikut wajib sama di semua instance API:

- `SESSION_SECRET`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_SECONDS`
- `DASHBOARD_ADMIN_EMAIL`
- `DASHBOARD_ADMIN_PASSWORD`
- `API_KEY_PREFIX`
- `DASHBOARD_ORIGIN`
- `CORS_ORIGIN`

## Model 1: Full Docker stack

Pakai [docker-compose.prod.yml](E:/Data%20Kuliah/Tingkat%204/nganggur/EndGame/crawlix-next/docker-compose.prod.yml) untuk deploy `web`, `api`, dan `worker` di host yang sama.

Langkah umum:

1. Siapkan `.env` production.
2. Pastikan `RABBITMQ_URL` dan `REDIS_URL` mengarah ke service production/shared.
3. Jalankan `docker compose -f docker-compose.prod.yml up -d --build`.
4. Pasang reverse proxy di depan `web` dan `api` bila perlu.

## Model 2: Web/API di Docker, worker di EC2 VM

Model ini cocok bila worker perlu akses host lebih langsung atau ingin scale manual di VM.

### Web/API

- Jalankan `web` dan `api` via Docker seperti biasa.
- Health endpoint load balancer untuk API:
  - `GET /api/health/live`
  - `GET /api/health/ready`

### Worker di EC2 VM

1. Install Node.js, `pnpm`, dan dependency sistem yang diperlukan scraper.
2. Pull source versi release yang sama dengan API.
3. Siapkan `.env` worker dengan queue/redis contract yang sama.
4. Jalankan worker via `systemd`.

Contoh unit `systemd`:

```ini
[Unit]
Description=Crawlix Worker
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/crawlix-next
EnvironmentFile=/opt/crawlix-next/apps/worker/.env
ExecStart=/usr/bin/pnpm --filter @repo/worker start:prod
Restart=always
RestartSec=5
User=ubuntu

[Install]
WantedBy=multi-user.target
```

## Model 3: Worker horizontal multi-host

Worker bisa dijalankan campuran:

- Docker di host A
- `systemd` di EC2 host B
- Docker/VM lain di host C, D, dan seterusnya

Selama semua worker memakai queue dan Redis yang sama, RabbitMQ akan membagi message antar consumer.

Saran rollout:

1. Deploy worker baru.
2. Tunggu heartbeat worker baru muncul di dashboard.
3. Verifikasi queue depth dan failure rate stabil.
4. Hentikan worker lama bertahap.

## Rolling update aman

- Update API dulu bila perubahan backward-compatible pada payload queue.
- Update worker sebelum mengaktifkan perubahan payload yang tidak backward-compatible.
- Hindari mengubah format `ScrapeJobMessage` secara breaking tanpa versioning.

## Health and readiness

- API liveness: `GET /api/health/live`
- API readiness: `GET /api/health/ready`

Gunakan readiness sebagai target load balancer, karena endpoint ini memeriksa Redis dan RabbitMQ.

## Dashboard security

- Dashboard memakai session cookie admin.
- Jangan expose dashboard ke internet tanpa reverse proxy, TLS, dan IP allowlist atau VPN.
- API key dibuat per client dan bisa direvoke dari dashboard.
