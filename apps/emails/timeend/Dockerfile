# Use the Railway Nixpacks image for the build stage
FROM node:latest as builder

# Set the working directory
WORKDIR /app

# Copy only the specified files for the setup phase
COPY package.json .yarnrc.yml ./
COPY .yarn .yarn/
COPY apps/emails/timeend/package.json apps/emails/timeend/package.json
COPY libs/ts/db/package.json libs/ts/db/package.json
COPY libs/ts/emails/package.json libs/ts/emails/package.json

# Install dependencies
RUN npm install -g corepack@latest && corepack enable
RUN yarn install --mode=update-lockfile
RUN yarn install

# Define build argument
ARG DATABASE_URL

# Set the environment variable for the build phase
ENV DATABASE_URL=${DATABASE_URL}

# Copy the remaining files required for the build phase
COPY apps/emails/timeend apps/emails/timeend
COPY libs/ts/db libs/ts/db
COPY libs/ts/emails libs/ts/emails

# Build the project
RUN yarn build-email-timeend

# Use the official Node.js image for the final stage
FROM node:latest

# Set the working directory
WORKDIR /app

# Copy the built project and required files from the builder stage
COPY --from=builder /app/apps/emails/timeend /app/apps/emails/timeend
COPY --from=builder /app/libs/ts/db /app/libs/ts/db
COPY --from=builder /app/libs/ts/emails /app/libs/ts/emails
COPY --from=builder /app/node_modules /app/node_modules
COPY --from=builder /app/package.json /app/package.json
COPY --from=builder /app/yarn.lock /app/yarn.lock
COPY --from=builder /app/.yarnrc.yml /app/.yarnrc.yml
COPY --from=builder /app/.yarn /app/.yarn

# Set the environment variable
ENV PROPOSALS_BIN=email-timeend

# Set the default command
CMD ["yarn", "start-email-timeend"]
