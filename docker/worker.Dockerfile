FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=@repo/worker...
ENV NODE_ENV=production
ENV PORT=3002
CMD ["pnpm", "--filter", "@repo/worker", "start:prod"]
