ARG APP_NAME=detective

# Stage 1: Planner
FROM rust:slim-bookworm AS planner
WORKDIR /app
RUN cargo install cargo-chef
COPY . .
RUN cargo chef prepare --recipe-path recipe.json

# Stage 2: Cacher
FROM rust:slim-bookworm AS cacher
WORKDIR /app
ARG APP_NAME

RUN cargo install cargo-chef
COPY --from=planner /app/recipe.json recipe.json

# Install only essential build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN cargo chef cook --release --recipe-path recipe.json

# Stage 3: Builder
FROM rust:slim-bookworm AS builder
WORKDIR /app
ARG APP_NAME

COPY --from=cacher /app/target target
COPY --from=cacher /usr/local/cargo /usr/local/cargo
COPY . .

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Build the project
RUN cargo build --release --package ${APP_NAME}

# Stage 4: Final
FROM debian:bookworm-slim
WORKDIR /app
ARG APP_NAME

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

# Copy the built binary from the builder stage
COPY --from=builder /app/target/release/${APP_NAME} /usr/local/bin/${APP_NAME}

# Set the environment variable
ENV PROPOSALS_BIN=${APP_NAME}

# Set the default command
CMD ["sh", "-c", "${APP_NAME}"]
