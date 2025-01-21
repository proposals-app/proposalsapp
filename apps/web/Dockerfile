FROM node:22-alpine AS builder

# Set the working directory
WORKDIR /app

# Install and enable Corepack
RUN corepack enable && corepack prepare yarn@4 --activate

# Copy package-related files
COPY package.json yarn.lock .yarnrc.yml ./

# Copy project-specific package files
COPY apps/web/package.json apps/web/
COPY libs/ts/db/package.json libs/ts/db/
COPY libs/ts/emails/package.json libs/ts/emails/

# Update lockfile and install dependencies
RUN yarn install --mode=update-lockfile
RUN yarn install

# Copy the remaining project files
COPY apps/web/ apps/web/
COPY libs/ts/db/ libs/ts/db/
COPY libs/ts/emails/ libs/ts/emails/

# Build the project
ARG DATABASE_URL=postgresql://user:password@host:5432/database

ENV DATABASE_URL=${DATABASE_URL}
RUN yarn build-web

# Use Debian Bookworm for the final stage
FROM debian:bookworm

# Set the working directory
WORKDIR /app

# Install Node.js and yarn
RUN apt-get update && apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g corepack && \
    corepack enable && \
    corepack prepare yarn@4 --activate && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Copy the built project and required files from the builder stage
COPY --from=builder /app/apps/web/ /app/apps/web/
COPY --from=builder /app/libs/ts/db/ /app/libs/ts/db/
COPY --from=builder /app/libs/ts/emails/ /app/libs/ts/emails/
COPY --from=builder /app/node_modules/ /app/node_modules/
COPY --from=builder /app/package.json /app/
COPY --from=builder /app/yarn.lock /app/
COPY --from=builder /app/.yarnrc.yml /app/

ENV NODE_ENV=production

# Set the default command
CMD ["yarn", "start-web"]
