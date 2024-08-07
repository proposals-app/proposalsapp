# Use the Railway Nixpacks image for the build stage
FROM node:latest as builder

# Set the working directory
WORKDIR /app

# Copy only the specified files for the setup phase
COPY package.json .yarnrc.yml ./
COPY .yarn .yarn/
COPY apps/push/quorum/package.json apps/push/quorum/package.json
COPY libs/ts/db/package.json libs/ts/db/package.json

# Install dependencies
RUN npm install -g corepack@latest && corepack enable
RUN yarn install --mode=update-lockfile
RUN yarn install

# Define build argument
ARG DATABASE_URL
ARG HYPERDX_ENDPOINT
ARG HYPERDX_KEY
ARG NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY
ARG POSTMARK_API_KEY
ARG WEB_PUSH_EMAIL
ARG WEB_PUSH_PRIVATE_KEY
ARG WEB_URL

# Set the environment variable for the build phase
ENV DATABASE_URL=${DATABASE_URL}
ENV HYPERDX_ENDPOINT=${HYPERDX_ENDPOINT}
ENV HYPERDX_KEY=${HYPERDX_KEY}
ENV NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY=${NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY}
ENV POSTMARK_API_KEY=${POSTMARK_API_KEY}
ENV WEB_PUSH_EMAIL=${WEB_PUSH_EMAIL}
ENV WEB_PUSH_PRIVATE_KEY=${WEB_PUSH_PRIVATE_KEY}
ENV WEB_URL=${WEB_URL}

# Copy the remaining files required for the build phase
COPY apps/push/quorum apps/push/quorum
COPY libs/ts/db libs/ts/db

# Build the project
RUN yarn build-push-quorum

# Use the official Node.js image for the final stage
FROM node:latest

# Set the working directory
WORKDIR /app

# Copy the built project and required files from the builder stage
COPY --from=builder /app/apps/push/quorum /app/apps/push/quorum
COPY --from=builder /app/libs/ts/db /app/libs/ts/db
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/yarn.lock /app/yarn.lock
COPY --from=builder /app/.yarnrc.yml /app/.yarnrc.yml
COPY --from=builder /app/.yarn /app/.yarn

# Set the environment variable
ENV PROPOSALS_BIN=push-quorum

# Set the default command
CMD ["yarn", "start-push-quorum"]
