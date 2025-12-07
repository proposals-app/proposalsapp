FROM node:22-alpine AS builder

# Set the working directory
WORKDIR /app

# Install libc6-compat for sharp compatibility on Alpine
RUN apk add --no-cache libc6-compat

# Install and enable Corepack
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

# Copy package-related files
COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./

# Copy project-specific package files
COPY apps/web/package.json apps/web/
COPY libs/ts/db/package.json libs/ts/db/
COPY libs/ts/emails/package.json libs/ts/emails/
COPY libs/ts/visual-dom-diff/package.json libs/ts/visual-dom-diff/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy the remaining project files
COPY apps/web/ apps/web/
COPY libs/ts/db/ libs/ts/db/
COPY libs/ts/emails/ libs/ts/emails/
COPY libs/ts/visual-dom-diff/ libs/ts/visual-dom-diff/

## Build the project (no secrets baked into image)
# Ensure an empty .env exists to satisfy any optional checks
RUN touch apps/web/.env \
  && pnpm build-web \
  && CI=true pnpm prune --prod

# Final stage
FROM node:22-alpine

# Set the working directory
WORKDIR /app

# Install libc6-compat for sharp compatibility on Alpine
RUN apk add --no-cache libc6-compat

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@10.15.0 --activate

# Create non-root user with UID >= 10000 for security
# UIDs below 10000 can conflict with host system users if container escapes
RUN addgroup -g 10001 -S appgroup && \
    adduser -u 10000 -S appuser -G appgroup

# Copy the built project and required files from the builder stage
COPY --from=builder --chown=appuser:appgroup /app/apps/web/ /app/apps/web/
COPY --from=builder --chown=appuser:appgroup /app/libs/ts/db/ /app/libs/ts/db/
COPY --from=builder --chown=appuser:appgroup /app/libs/ts/emails/ /app/libs/ts/emails/
COPY --from=builder --chown=appuser:appgroup /app/libs/ts/visual-dom-diff/ /app/libs/ts/visual-dom-diff/
COPY --from=builder --chown=appuser:appgroup /app/node_modules/ /app/node_modules/
COPY --from=builder --chown=appuser:appgroup /app/package.json /app/
COPY --from=builder --chown=appuser:appgroup /app/pnpm-lock.yaml /app/
COPY --from=builder --chown=appuser:appgroup /app/.npmrc /app/
COPY --from=builder --chown=appuser:appgroup /app/pnpm-workspace.yaml /app/

ENV NODE_ENV=production
# Set sharp path for Next.js image optimization
ENV NEXT_SHARP_PATH=/app/node_modules/sharp

# Switch to non-root user
USER appuser:appgroup

# Expose Next.js default port
EXPOSE 3000

# Set the default command
CMD ["pnpm", "start-web"]
