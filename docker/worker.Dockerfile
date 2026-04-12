FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@repo/worker...

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile --prod --filter=@repo/worker...

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# ENV PORT=3002
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/worker ./apps/worker
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist
COPY --from=builder /app/packages ./packages

RUN ./node_modules/.bin/playwright install --with-deps chromium

RUN groupadd --system nodejs && useradd --system --gid nodejs --create-home nestjs
RUN chown -R nestjs:nodejs /app /ms-playwright

WORKDIR /app/apps/worker
USER nestjs
# EXPOSE 3002
HEALTHCHECK --interval=30s --timeout=5s --start-period=45s --retries=3 \
	CMD ["node", "-e", "fetch('http://localhost:'+process.env.PORT+'/worker/health/live').then((r)=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/main"]
