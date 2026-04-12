FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@repo/docs...

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DOCS_PORT=3005
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/apps/docs/.next/standalone ./
COPY --from=builder /app/apps/docs/.next/static ./apps/docs/.next/static
COPY --from=builder /app/apps/docs/public ./apps/docs/public

RUN chown -R nextjs:nodejs /app

WORKDIR /app/apps/docs
USER nextjs
EXPOSE 3005
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
	CMD ["node", "-e", "const p=process.env.DOCS_PORT||'3005';fetch('http://localhost:'+p+'/').then((r)=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]

CMD ["sh", "-c", "PORT=${DOCS_PORT:-3005} node server.js"]
