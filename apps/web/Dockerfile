# syntax=docker/dockerfile:1

# Stage 1: Builder (use -dev variant for build tools)
FROM dhi.io/node:22-debian13-dev AS builder

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
  && pnpm build-web \
  && CI=true pnpm prune --prod

# Stage 2: Runtime (use minimal runtime image - no shell, no package manager)
FROM dhi.io/node:22-debian13

WORKDIR /app

# Copy the built project and required files from the builder stage
# Use the built-in node user in runtime images
COPY --from=builder --chown=node:node /app/apps/web/ /app/apps/web/
COPY --from=builder --chown=node:node /app/libs/ts/db/ /app/libs/ts/db/
COPY --from=builder --chown=node:node /app/libs/ts/emails/ /app/libs/ts/emails/
COPY --from=builder --chown=node:node /app/libs/ts/visual-dom-diff/ /app/libs/ts/visual-dom-diff/
COPY --from=builder --chown=node:node /app/node_modules/ /app/node_modules/
COPY --from=builder --chown=node:node /app/package.json /app/

ENV NODE_ENV=production
# Set sharp path for Next.js image optimization
ENV NEXT_SHARP_PATH=/app/node_modules/sharp

# Switch to non-root user (node is provided by the base image)
USER node

# Expose Next.js default port
EXPOSE 3000

# Run Next.js CLI directly with node (no shell required)
CMD ["node", "node_modules/next/dist/bin/next", "start", "-H", "0.0.0.0", "apps/web"]
