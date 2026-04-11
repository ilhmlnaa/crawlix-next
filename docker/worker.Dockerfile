FROM node:22-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @repo/scraper exec playwright install --with-deps chromium
RUN pnpm turbo run build --filter=@repo/worker...
ENV NODE_ENV=production
ENV PORT=3002
EXPOSE 3002
CMD ["pnpm", "--filter", "@repo/worker", "start:prod"]
