FROM node:22-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps ./apps
COPY packages ./packages
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build --filter=web...
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
	CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/').then((r)=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"]
CMD ["pnpm", "--filter", "web", "start"]
