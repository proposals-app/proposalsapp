FROM node:22-alpine AS builder

# Set the working directory
WORKDIR /app

# Install and enable Corepack
RUN corepack enable && corepack prepare yarn@4 --activate

# Copy package-related files
COPY package.json yarn.lock .yarnrc.yml ./

# Copy project-specific package files
COPY apps/web-arbitrum/package.json apps/web-arbitrum/
COPY libs/ts/db/package.json libs/ts/db/
COPY libs/ts/emails/package.json libs/ts/emails/
COPY libs/ts/visual-dom-diff/package.json libs/ts/visual-dom-diff/

# Update lockfile and install dependencies
RUN yarn install --mode=update-lockfile
RUN yarn install

# Copy the remaining project files
COPY apps/web-arbitrum/ apps/web-arbitrum/
COPY libs/ts/db/ libs/ts/db/
COPY libs/ts/emails/ libs/ts/emails/
COPY libs/ts/visual-dom-diff/ libs/ts/visual-dom-diff/

# Build the project
ARG DATABASE_URL=postgresql://user:password@host:5432/database

ENV DATABASE_URL=${DATABASE_URL}
RUN yarn build-web-arbitrum

# Use Debian Bookworm for the final stage
FROM debian:bookworm

# Set the working directory
WORKDIR /app

# Install Node.js, yarn, and PM2
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g corepack pm2 && \
    corepack enable && \
    corepack prepare yarn@4 --activate && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy the built project and required files from the builder stage
COPY --from=builder /app/apps/web-arbitrum/ /app/apps/web-arbitrum/
COPY --from=builder /app/libs/ts/db/ /app/libs/ts/db/
COPY --from=builder /app/libs/ts/emails/ /app/libs/ts/emails/
COPY --from=builder /app/libs/ts/visual-dom-diff/ /app/libs/ts/visual-dom-diff/
COPY --from=builder /app/node_modules/ /app/node_modules/
COPY --from=builder /app/package.json /app/
COPY --from=builder /app/yarn.lock /app/
COPY --from=builder /app/.yarnrc.yml /app/

# Copy PM2 configuration file
COPY ecosystem.config.js /app/

# Set the environment variables
ENV PROPOSALS_BIN=web-arbitrum
ENV NEXT_OTEL_VERBOSE=1

# Set the default command to start the application with PM2 in cluster mode
CMD ["pm2-runtime", "start", "ecosystem.config.js"]
