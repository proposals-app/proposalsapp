FROM node:20 as builder

# Set the working directory
WORKDIR /app

# Install and enable Corepack
RUN corepack enable
RUN corepack prepare yarn@4.4.1 --activate

# Copy package-related files
COPY package.json yarn.lock .yarnrc.yml ./

# Copy project-specific package files
COPY apps/push/quorum/package.json apps/push/quorum/
COPY libs/ts/db/package.json libs/ts/db/
COPY libs/ts/emails/package.json libs/ts/emails/

# Install dependencies
RUN yarn install --mode=update-lockfile
RUN yarn install

# Define build argument
ARG DATABASE_URL

# Set the environment variable for the build phase
ENV DATABASE_URL=${DATABASE_URL}

# Copy the remaining project files
COPY apps/push/quorum/ apps/push/quorum/
COPY libs/ts/db/ libs/ts/db/
COPY libs/ts/emails/ libs/ts/emails/

# Build the project
RUN yarn build-push-quorum

# Use a minimal Node.js image for the final stage
FROM node:alpine

# Install and enable Corepack
RUN corepack enable
RUN corepack prepare yarn@4.4.1 --activate

# Set the working directory
WORKDIR /app

# Copy the built project and required files from the builder stage
COPY --from=builder /app/apps/push/quorum/ /app/apps/push/quorum/
COPY --from=builder /app/libs/ts/db/ /app/libs/ts/db/
COPY --from=builder /app/libs/ts/emails/ /app/libs/ts/emails/
COPY --from=builder /app/node_modules/ /app/node_modules/
COPY --from=builder /app/package.json /app/
COPY --from=builder /app/yarn.lock /app/
COPY --from=builder /app/.yarnrc.yml /app/

# Set the environment variable
ENV PROPOSALS_BIN=push-quorum

# Set the default command
CMD ["yarn", "start-push-quorum"]
