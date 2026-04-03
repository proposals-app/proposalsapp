# syntax=docker/dockerfile:1

# Stage 1: Builder (use -dev variant for build tools)
FROM node:22-bookworm AS builder

WORKDIR /app

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

# Build the project (no secrets baked into image)
# Ensure an empty .env exists to satisfy any optional checks
RUN touch apps/web/.env \
  && pnpm build-web

# Stage 2: Runtime (use minimal runtime image - no shell, no package manager)
FROM node:22-bookworm-slim

WORKDIR /app

# Copy the standalone server output and required runtime assets
COPY --from=builder --chown=node:node /app/apps/web/.next/standalone/ /app/
COPY --from=builder --chown=node:node /app/apps/web/.next/static/ /app/apps/web/.next/static/
COPY --from=builder --chown=node:node /app/apps/web/public/ /app/apps/web/public/

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# Set sharp path for Next.js image optimization
ENV NEXT_SHARP_PATH=/app/node_modules/sharp

# Switch to non-root user (node is provided by the base image)
USER node

# Expose Next.js default port
EXPOSE 3000

# Run the generated standalone server directly
CMD ["node", "apps/web/server.js"]
