# syntax=docker/dockerfile:1
ARG APP_NAME=email-service

# Stage 1: Builder (use -dev variant for build tools)
FROM node:22-bookworm AS builder
WORKDIR /app
ARG APP_NAME

# Install and enable Corepack
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

# Copy package-related files
COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./
COPY apps/${APP_NAME}/package.json ./apps/${APP_NAME}/
COPY libs/ts/db/package.json ./libs/ts/db/
COPY libs/ts/emails/package.json ./libs/ts/emails/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the remaining project files
COPY apps/${APP_NAME}/ ./apps/${APP_NAME}/
COPY libs/ts/db/ ./libs/ts/db/
COPY libs/ts/emails/ ./libs/ts/emails/

# Bundle with esbuild into a single file (resolves workspace TS imports)
RUN npx esbuild apps/${APP_NAME}/src/index.ts \
    --bundle \
    --platform=node \
    --target=node22 \
    --format=esm \
    --outfile=apps/${APP_NAME}/dist/index.mjs \
    --external:dotenv \
    --external:pg \
    --external:pino \
    --external:resend \
    --external:node-cron \
    --external:date-fns \
    --external:@react-email/render \
    --banner:js="import{createRequire}from'module';const require=createRequire(import.meta.url);"

# Prune dev dependencies for smaller image
RUN CI=true pnpm prune --prod

# Stage 2: Runtime (use minimal runtime image - no shell, no package manager)
FROM node:22-bookworm-slim
WORKDIR /app
ARG APP_NAME

# Copy only necessary files (runtime image provides `node` user)
COPY --from=builder --chown=node:node /app/apps/${APP_NAME}/dist/ /app/apps/${APP_NAME}/dist/
COPY --from=builder --chown=node:node /app/node_modules/ /app/node_modules/
COPY --from=builder --chown=node:node /app/package.json /app/

ENV NODE_ENV=production

# Switch to non-root user from the base runtime image
USER node

# Expose health server port
EXPOSE 3000

# Run bundled JavaScript directly with node
CMD ["node", "apps/email-service/dist/index.mjs"]
