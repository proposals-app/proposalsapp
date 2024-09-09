FROM node:alpine as builder

# Set the working directory
WORKDIR /app

# Install and enable Corepack
RUN corepack enable && corepack prepare yarn@4 --activate

# Copy package-related files
COPY package.json yarn.lock .yarnrc.yml ./

# Copy project-specific package files
COPY apps/emails/timeend/package.json apps/emails/timeend/
COPY libs/ts/db/package.json libs/ts/db/
COPY libs/ts/emails/package.json libs/ts/emails/

# Install dependencies
RUN yarn install --mode=update-lockfile
RUN yarn install

# Copy the remaining project files
COPY apps/emails/timeend/ apps/emails/timeend/
COPY libs/ts/db/ libs/ts/db/
COPY libs/ts/emails/ libs/ts/emails/

# Build the project
ARG DATABASE_URL=postgresql://user:password@host:5432/database
ENV DATABASE_URL=${DATABASE_URL}
RUN yarn build-email-timeend

# Use a minimal Node.js image for the final stage
FROM node:alpine

# Install and enable Corepack
RUN corepack enable && corepack prepare yarn@4 --activate

# Set the working directory
WORKDIR /app

# Copy the built project and required files from the builder stage
COPY --from=builder /app/apps/emails/timeend/ /app/apps/emails/timeend/
COPY --from=builder /app/libs/ts/db/ /app/libs/ts/db/
COPY --from=builder /app/libs/ts/emails/ /app/libs/ts/emails/
COPY --from=builder /app/node_modules/ /app/node_modules/
COPY --from=builder /app/package.json /app/
COPY --from=builder /app/yarn.lock /app/
COPY --from=builder /app/.yarnrc.yml /app/

# Set the environment variable
ENV PROPOSALS_BIN=email-timeend

# Set the default command
CMD ["yarn", "start-email-timeend"]
