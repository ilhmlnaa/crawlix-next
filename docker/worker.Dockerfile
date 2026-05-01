FROM node:24-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@repo/worker...

FROM node:24-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY . .
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/packages ./packages
RUN pnpm --filter=@repo/worker --prod deploy /app/pruned

FROM node:24-alpine AS runner
WORKDIR /app
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    libstdc++
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    PLAYWRIGHT_EXECUTABLE_PATH=/usr/bin/chromium-browser \
    NODE_ENV=production \
    WORKER_PORT=3002
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs
COPY --from=deps /app/pruned /app/apps/worker
RUN mkdir -p /app/apps/worker/logs && chown -R nestjs:nodejs /app
WORKDIR /app/apps/worker
USER nestjs
EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
	CMD ["node", "-e", "const p=process.env.WORKER_PORT||'3002';fetch('http://localhost:'+p+'/worker/health/live').then((r)=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "dist/main.js"]
