FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@repo/web...

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/apps/web/.next/standalone/apps/web ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

RUN chown -R nextjs:nodejs /app

WORKDIR /app/apps/web
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
	CMD ["node", "-e", "fetch('http://localhost:'+process.env.PORT+'/').then((r)=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "server.js"]
