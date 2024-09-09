FROM node:20 as builder

# Set the working directory
WORKDIR /app

# Copy only the specified files for the setup phase
COPY package.json .yarnrc.yml ./
COPY apps/push/timeend/package.json apps/push/timeend/package.json
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
COPY apps/push/timeend apps/push/timeend
COPY libs/ts/db libs/ts/db

# Build the project
RUN yarn build-push-timeend

FROM node:20

RUN npm install -g corepack@latest && corepack enable

# Set the working directory
WORKDIR /app

# Copy the built project and required files from the builder stage
COPY --from=builder /app/apps/push/timeend /app/apps/push/timeend
COPY --from=builder /app/libs/ts/db /app/libs/ts/db
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/yarn.lock /app/yarn.lock
COPY --from=builder /app/.yarnrc.yml /app/.yarnrc.yml

# Set the environment variable
ENV PROPOSALS_BIN=push-timeend

# Set the default command
CMD ["yarn", "start-push-timeend"]
