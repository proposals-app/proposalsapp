ARG APP_NAME=email-service

# Stage 1: Builder
FROM node:22-alpine AS builder
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

# Build the project (type-check only, no secrets needed)
RUN pnpm build-${APP_NAME}

# Stage 2: Final
FROM node:22-alpine
WORKDIR /app
ARG APP_NAME

RUN apk update && apk add --no-cache curl

RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

# Create non-root user with UID >= 10000 for security
# UIDs below 10000 can conflict with host system users if container escapes
RUN addgroup -g 10001 -S appgroup && \
    adduser -u 10000 -S appuser -G appgroup

# Copy only necessary files
COPY --from=builder --chown=appuser:appgroup /app/apps/${APP_NAME}/ /app/apps/${APP_NAME}/
COPY --from=builder --chown=appuser:appgroup /app/libs/ts/db/ /app/libs/ts/db/
COPY --from=builder --chown=appuser:appgroup /app/libs/ts/emails/ /app/libs/ts/emails/
COPY --from=builder --chown=appuser:appgroup /app/node_modules/ /app/node_modules/
COPY --from=builder --chown=appuser:appgroup /app/package.json /app/
COPY --from=builder --chown=appuser:appgroup /app/pnpm-lock.yaml /app/
COPY --from=builder --chown=appuser:appgroup /app/.npmrc /app/
COPY --from=builder --chown=appuser:appgroup /app/pnpm-workspace.yaml /app/

ENV NODE_ENV=production

# Switch to non-root user
USER appuser:appgroup

# Expose health server port
EXPOSE 3000

# Set the default command
CMD ["pnpm", "start-email-service"]
