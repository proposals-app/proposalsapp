# Stage 1: Build the application
FROM node:22-alpine AS builder

# Set the working directory
WORKDIR /app

# Install and enable Corepack
RUN corepack enable && corepack prepare yarn@4 --activate

# Copy package-related files
COPY package.json yarn.lock .yarnrc.yml ./
COPY apps/web-arbitrum/package.json apps/web-arbitrum/
COPY libs/ts/db/package.json libs/ts/db/
COPY libs/ts/emails/package.json libs/ts/emails/
COPY libs/ts/visual-dom-diff/package.json libs/ts/visual-dom-diff/

# Install dependencies
RUN yarn install --mode=update-lockfile && yarn install

# Copy the remaining project files
COPY apps/web-arbitrum/ apps/web-arbitrum/
COPY libs/ts/db/ libs/ts/db/
COPY libs/ts/emails/ libs/ts/emails/
COPY libs/ts/visual-dom-diff/ libs/ts/visual-dom-diff/

ARG DATABASE_URL
ENV DATABASE_URL=${DATABASE_URL}

# Build the project
RUN yarn build-web-arbitrum

# Stage 2: Create the final image
FROM node:22-alpine

RUN corepack enable && corepack prepare yarn@4 --activate

# Set the working directory
WORKDIR /app

# Copy the built project and required files from the builder stage
COPY --from=builder /app/apps/web-arbitrum/ /app/apps/web-arbitrum/
COPY --from=builder /app/libs/ts/db/ /app/libs/ts/db/
COPY --from=builder /app/libs/ts/emails/ /app/libs/ts/emails/
COPY --from=builder /app/libs/ts/visual-dom-diff/ /app/libs/ts/visual-dom-diff/
COPY --from=builder /app/node_modules/ /app/node_modules/
COPY --from=builder /app/package.json /app/
COPY --from=builder /app/yarn.lock /app/
COPY --from=builder /app/.yarnrc.yml /app/

# Set the environment variables
ENV PROPOSALS_BIN=web-arbitrum
ENV NEXT_OTEL_VERBOSE=1

EXPOSE 3000

# Set the default command
CMD ["yarn", "start-web-arbitrum"]
