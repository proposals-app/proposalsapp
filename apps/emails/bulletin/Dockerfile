# Build stage
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install build dependencies
RUN apk add --no-cache python3 make g++

# Copy package.json and yarn.lock files
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/emails/bulletin/package.json ./apps/emails/bulletin/
COPY libs/ts/db/package.json ./libs/ts/db/
COPY libs/ts/emails/package.json ./libs/ts/emails/

# Install dependencies
RUN npm install -g corepack@latest && corepack enable
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
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install and enable Corepack
RUN apk add --no-cache npm && \
    npm install -g corepack && \
    corepack enable

# Copy built artifacts and node_modules
COPY --from=builder /app/apps/emails/bulletin/dist ./apps/emails/bulletin/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json /app/yarn.lock /app/.yarnrc.yml ./

# Activate the correct Yarn version
RUN corepack prepare yarn@$(node -p "require('./package.json').packageManager.split('@')[1]") --activate

# Set environment variables
ENV NODE_ENV=production
ENV PROPOSALS_BIN=email-bulletin

# Create non-root user and set permissions
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs && \
    chown -R nodejs:nodejs /app

# Ensure .yarn directory exists with correct permissions
RUN mkdir -p /app/.yarn && chown -R nodejs:nodejs /app/.yarn

# Switch to non-root user
USER nodejs

# Set the default command
CMD ["yarn", "start-email-bulletin"]
