ARG APP_NAME=email-service

# Stage 1: Builder
FROM node:22-alpine AS builder
WORKDIR /app
ARG APP_NAME

# Install and enable Corepack
RUN corepack enable && corepack prepare yarn@4 --activate

# Copy package-related files
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/${APP_NAME}/package.json ./apps/${APP_NAME}/
COPY libs/ts/db/package.json ./libs/ts/db/
COPY libs/ts/emails/package.json ./libs/ts/emails/

# Install dependencies
RUN yarn workspaces focus @proposalsapp/${APP_NAME}

# Copy the remaining project files
COPY apps/${APP_NAME}/ ./apps/${APP_NAME}/
COPY libs/ts/db/ ./libs/ts/db/
COPY libs/ts/emails/ ./libs/ts/emails/

# Build the project
RUN yarn build-${APP_NAME}

# Stage 2: Final
FROM node:22-alpine
WORKDIR /app
ARG APP_NAME

RUN corepack enable && corepack prepare yarn@4 --activate

# Copy only necessary files
COPY --from=builder /app/apps/${APP_NAME}/ /app/apps/${APP_NAME}/
COPY --from=builder /app/libs/ts/db/ /app/libs/ts/db/
COPY --from=builder /app/libs/ts/emails/ /app/libs/ts/emails/
COPY --from=builder /app/node_modules/ /app/node_modules/
COPY --from=builder /app/package.json /app/
COPY --from=builder /app/yarn.lock /app/
COPY --from=builder /app/.yarnrc.yml /app/

ENV NODE_ENV=production

# Set the default command
CMD ["yarn", "start-email-service"]
