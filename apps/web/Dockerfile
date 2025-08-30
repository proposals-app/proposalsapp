FROM node:22-alpine AS builder

# Set the working directory
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

# Build the project
ARG DATABASE_URL=postgres://user:password@host:5432/database
ARG REDIS_URL=redis://default:default@100.100.100.100:6379
ARG RESEND_API_KEY=re_dummy_key_for_build
ARG BETTER_AUTH_SECRET=dummy_secret_for_build

# Create a dummy .env file for build
RUN echo "DATABASE_URL=${DATABASE_URL}" > apps/web/.env && \
    echo "REDIS_URL=${REDIS_URL}" >> apps/web/.env && \
    echo "RESEND_API_KEY=${RESEND_API_KEY}" >> apps/web/.env && \
    echo "BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}" >> apps/web/.env && \
    echo "NEXT_PUBLIC_MAINTENANCE_MODE=false" >> apps/web/.env && \
    echo "NEXT_PUBLIC_ROOT_DOMAIN=proposals.app" >> apps/web/.env

ENV DATABASE_URL=${DATABASE_URL}
ENV REDIS_URL=${REDIS_URL}
ENV RESEND_API_KEY=${RESEND_API_KEY}
ENV BETTER_AUTH_SECRET=${BETTER_AUTH_SECRET}
RUN pnpm build-web

# Use Debian Bookworm for the final stage
FROM debian:bookworm

# Set the working directory
WORKDIR /app

# Install Node.js and pnpm
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    corepack enable && \
    corepack prepare pnpm@10.15.0 --activate && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy the built project and required files from the builder stage
COPY --from=builder /app/apps/web/ /app/apps/web/
COPY --from=builder /app/libs/ts/db/ /app/libs/ts/db/
COPY --from=builder /app/libs/ts/emails/ /app/libs/ts/emails/
COPY --from=builder /app/libs/ts/visual-dom-diff/ /app/libs/ts/visual-dom-diff/
COPY --from=builder /app/node_modules/ /app/node_modules/
COPY --from=builder /app/package.json /app/
COPY --from=builder /app/pnpm-lock.yaml /app/
COPY --from=builder /app/.npmrc /app/
COPY --from=builder /app/pnpm-workspace.yaml /app/

ENV NODE_ENV=production

# Set the default command
CMD ["pnpm", "start-web"]
