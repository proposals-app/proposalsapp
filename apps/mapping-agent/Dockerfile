# syntax=docker/dockerfile:1
ARG APP_NAME=mapping-agent

FROM node:22-bookworm AS builder
WORKDIR /app
ARG APP_NAME

RUN corepack enable && corepack prepare pnpm@10.30.0 --activate

COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./
COPY apps/${APP_NAME}/package.json ./apps/${APP_NAME}/
COPY libs/ts/db/package.json ./libs/ts/db/

RUN pnpm install --frozen-lockfile

COPY apps/${APP_NAME}/ ./apps/${APP_NAME}/
COPY libs/ts/db/ ./libs/ts/db/

RUN npx esbuild apps/${APP_NAME}/src/index.ts \
    --bundle \
    --platform=node \
    --target=node22 \
    --format=esm \
    --outfile=apps/${APP_NAME}/dist/index.mjs \
    --external:dotenv \
    --external:pg \
    --external:pino \
    --external:@mariozechner/pi-coding-agent \
    --banner:js="import{createRequire}from'module';const require=createRequire(import.meta.url);"

RUN CI=true pnpm prune --prod

FROM node:22-bookworm-slim
WORKDIR /app
ARG APP_NAME

COPY --from=builder --chown=node:node /app/apps/${APP_NAME}/dist/ /app/apps/${APP_NAME}/dist/
COPY --from=builder --chown=node:node /app/node_modules/ /app/node_modules/
COPY --from=builder --chown=node:node /app/package.json /app/

ENV NODE_ENV=production
ENV PORT=3000

USER node

EXPOSE 3000

CMD ["node", "apps/mapping-agent/dist/index.mjs"]
