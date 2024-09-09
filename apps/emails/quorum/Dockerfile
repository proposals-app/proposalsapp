FROM node:20 as builder

# Set the working directory
WORKDIR /app

# Copy package-related files
COPY package.json yarn.lock .yarnrc.yml ./

# Copy project-specific package files
COPY apps/emails/quorum/package.json apps/emails/quorum/
COPY libs/ts/db/package.json libs/ts/db/
COPY libs/ts/emails/package.json libs/ts/emails/

# Install dependencies
RUN npm install -g corepack@latest && corepack enable
RUN yarn install --mode=update-lockfile
RUN yarn install

# Define build argument
ARG DATABASE_URL

# Set the environment variable for the build phase
ENV DATABASE_URL=${DATABASE_URL}

# Copy the remaining project files
COPY apps/emails/quorum/ apps/emails/quorum/
COPY libs/ts/db/ libs/ts/db/
COPY libs/ts/emails/ libs/ts/emails/

# Build the project
RUN yarn build-email-quorum

FROM node:20

# Set the working directory
WORKDIR /app

# Copy the built project and required files from the builder stage
COPY --from=builder /app/apps/emails/quorum/ /app/apps/emails/quorum/
COPY --from=builder /app/libs/ts/db/ /app/libs/ts/db/
COPY --from=builder /app/libs/ts/emails/ /app/libs/ts/emails/
COPY --from=builder /app/node_modules/ /app/node_modules/
COPY --from=builder /app/package.json /app/
COPY --from=builder /app/yarn.lock /app/
COPY --from=builder /app/.yarnrc.yml /app/

# Set the environment variable
ENV PROPOSALS_BIN=email-quorum

# Set the default command
CMD ["yarn", "start-email-quorum"]
