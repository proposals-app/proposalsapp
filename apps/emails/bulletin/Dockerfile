# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies and Yarn 4
RUN apk add --no-cache python3 make g++ && \
    corepack enable && \
    yarn set version 4.4.1

# Copy package.json files for all workspaces
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/emails/bulletin/package.json ./apps/emails/bulletin/
COPY libs/ts/db/package.json ./libs/ts/db/
COPY libs/ts/emails/package.json ./libs/ts/emails/

# Install dependencies
RUN yarn install

# Copy only the necessary source files
COPY apps/emails/bulletin ./apps/emails/bulletin
COPY libs/ts/db ./libs/ts/db
COPY libs/ts/emails ./libs/ts/emails

# Build the project
ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}
RUN yarn build-email-bulletin

# Production stage
FROM node:20-alpine AS production

# Set working directory
WORKDIR /app

# Install production dependencies
RUN apk add --no-cache npm && \
    corepack enable && \
    yarn set version 4.4.1

# Copy built artifacts and yarn files
COPY --from=builder /app/package.json /app/yarn.lock /app/.yarnrc.yml ./
COPY --from=builder /app/.yarn ./.yarn
COPY --from=builder /app/apps/emails/bulletin/dist ./apps/emails/bulletin/dist
COPY --from=builder /app/apps/emails/bulletin/package.json ./apps/emails/bulletin/
COPY --from=builder /app/libs/ts/db/package.json ./libs/ts/db/
COPY --from=builder /app/libs/ts/emails/package.json ./libs/ts/emails/

# Install production dependencies
RUN yarn workspaces focus @proposalsapp/email-bulletin --production

# Set environment variables
ENV NODE_ENV=production
ENV PROPOSALS_BIN=email-bulletin

# Set the default command
CMD ["yarn", "start-email-bulletin"]
