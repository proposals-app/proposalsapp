# syntax=docker/dockerfile:1
ARG APP_NAME=email-service

# Stage 1: Builder (use -dev variant for build tools)
FROM dhi.io/node:22-debian13-dev AS builder
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

# Type-check and compile TypeScript to JavaScript
# Override noEmit to actually produce output files
WORKDIR /app/apps/${APP_NAME}
RUN pnpm exec tsc --noEmit false --outDir dist
WORKDIR /app

# Prune dev dependencies for smaller image
RUN CI=true pnpm prune --prod

# Stage 2: Runtime (use minimal runtime image - no shell, no package manager)
FROM dhi.io/node:22-debian13
WORKDIR /app
ARG APP_NAME

# Copy only necessary files (runtime image provides `node` user)
COPY --from=builder --chown=node:node /app/apps/${APP_NAME}/dist/ /app/apps/${APP_NAME}/dist/
COPY --from=builder --chown=node:node /app/libs/ts/db/ /app/libs/ts/db/
COPY --from=builder --chown=node:node /app/libs/ts/emails/ /app/libs/ts/emails/
COPY --from=builder --chown=node:node /app/node_modules/ /app/node_modules/
COPY --from=builder --chown=node:node /app/package.json /app/

ENV NODE_ENV=production

# Switch to non-root user from the base runtime image
USER node

# Expose health server port
EXPOSE 3000

# Run compiled JavaScript directly with node (no shell required)
CMD ["node", "apps/email-service/dist/index.js"]
