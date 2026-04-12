FROM node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@repo/api...

FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate
COPY . .
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages ./packages
RUN pnpm --filter=@repo/api --prod deploy /app/pruned

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV API_PORT=3001
RUN addgroup -S nodejs && adduser -S nestjs -G nodejs
COPY --from=deps /app/pruned /app/apps/api
RUN chown -R nestjs:nodejs /app
WORKDIR /app/apps/api
USER nestjs
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
	CMD ["node", "-e", "const p=process.env.API_PORT||'3001';fetch('http://localhost:'+p+'/api/health/live').then((r)=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]

CMD ["node", "dist/main.js"]
