# Use the latest Node.js version for the build stage
FROM node:latest as builder

# Set the working directory
WORKDIR /app

# Copy package-related files
COPY package.json yarn.lock .yarnrc.yml ./
COPY .yarn .yarn/

# Copy project-specific package files
COPY apps/web/package.json apps/web/
COPY libs/ts/db/package.json libs/ts/db/
COPY libs/ts/emails/package.json libs/ts/emails/

# Install dependencies
RUN npm install -g corepack@latest && corepack enable
RUN yarn install --mode=update-lockfile
RUN yarn install

# Define build arguments
ARG DATABASE_URL
ARG POSTMARK_API_KEY
ARG NEXT_PUBLIC_POSTHOG_KEY

# Set environment variables for the build phase
ENV DATABASE_URL=${DATABASE_URL}
ENV POSTMARK_API_KEY=${POSTMARK_API_KEY}
ENV NEXT_PUBLIC_POSTHOG_KEY=${NEXT_PUBLIC_POSTHOG_KEY}

# Copy the remaining project files
COPY apps/web/ apps/web/
COPY libs/ts/db/ libs/ts/db/
COPY libs/ts/emails/ libs/ts/emails/

# Build the project
RUN yarn build-web

# Use a minimal Node.js image for the final stage
FROM node:alpine

# Set the working directory
WORKDIR /app

# Copy the built project and required files from the builder stage
COPY --from=builder /app/apps/web/ /app/apps/web/
COPY --from=builder /app/libs/ts/db/ /app/libs/ts/db/
COPY --from=builder /app/libs/ts/emails/ /app/libs/ts/emails/
COPY --from=builder /app/node_modules/ /app/node_modules/
COPY --from=builder /app/package.json /app/
COPY --from=builder /app/yarn.lock /app/
COPY --from=builder /app/.yarnrc.yml /app/
COPY --from=builder /app/.yarn /app/.yarn

# Set the environment variable
ENV PROPOSALS_BIN=web

# Expose the application port
EXPOSE 3000

# Set the default command
CMD ["yarn", "start-web"]
