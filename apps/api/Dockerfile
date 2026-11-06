FROM node:22-alpine AS build

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate
WORKDIR /workspace

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/presets/package.json ./packages/presets/package.json
COPY packages/renderer/package.json ./packages/renderer/package.json
COPY packages/scan-validator/package.json ./packages/scan-validator/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN pnpm install --filter @moduqr/api --frozen-lockfile

COPY apps/api/tsconfig.json apps/api/tsconfig.build.json ./apps/api/
COPY apps/api/src ./apps/api/src
COPY apps/api/migrations ./apps/api/migrations

RUN pnpm --filter @moduqr/api build

FROM node:22-alpine AS runtime

RUN apk add --no-cache postgresql-client \
  && mkdir -p /app \
  && chown node:node /app

WORKDIR /app
COPY --from=build --chown=node:node /workspace/apps/api/dist ./dist
COPY --from=build --chown=node:node /workspace/apps/api/migrations ./migrations

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4100

USER node
EXPOSE 4100

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:4100/health/live').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "dist/server.js"]
