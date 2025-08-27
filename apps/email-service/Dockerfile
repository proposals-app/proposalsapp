ARG APP_NAME=email-service

# Stage 1: Builder
FROM node:22-alpine AS builder
WORKDIR /app
ARG APP_NAME

# Install and enable Corepack
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

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

# Build the project
ARG DATABASE_URL=postgres://user:password@host:5432/database
ARG ARBITRUM_DATABASE_URL=postgres://user:password@host:5432/database   
ARG UNISWAP_DATABASE_URL=postgres://user:password@host:5432/database
ARG RESEND_API_KEY=re_dummy_key_for_build

ENV DATABASE_URL=${DATABASE_URL}
ENV ARBITRUM_DATABASE_URL=${ARBITRUM_DATABASE_URL}
ENV UNISWAP_DATABASE_URL=${UNISWAP_DATABASE_URL}
ENV RESEND_API_KEY=${RESEND_API_KEY}
RUN pnpm build-${APP_NAME}

# Stage 2: Final
FROM node:22-alpine
WORKDIR /app
ARG APP_NAME

RUN apk update && apk add --no-cache curl

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Copy only necessary files
COPY --from=builder /app/apps/${APP_NAME}/ /app/apps/${APP_NAME}/
COPY --from=builder /app/libs/ts/db/ /app/libs/ts/db/
COPY --from=builder /app/libs/ts/emails/ /app/libs/ts/emails/
COPY --from=builder /app/node_modules/ /app/node_modules/
COPY --from=builder /app/package.json /app/
COPY --from=builder /app/pnpm-lock.yaml /app/
COPY --from=builder /app/.npmrc /app/
COPY --from=builder /app/pnpm-workspace.yaml /app/

ENV NODE_ENV=production

# Set the default command
CMD ["pnpm", "start-email-service"]
