ARG APP_NAME=proposalsapp-rindexer

# Stage 1: Planner
FROM rust:slim-bookworm AS planner
ARG APP_NAME
WORKDIR /app

# Install build dependencies for the planner stage
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

RUN cargo install cargo-chef
COPY . .
RUN cargo chef prepare --recipe-path recipe.json --bin ${APP_NAME}

# Stage 2: Cacher
FROM rust:slim-bookworm AS cacher
WORKDIR /app
ARG APP_NAME

# Install only essential build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    python3 \
    build-essential \
    clang \
    lld \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN cargo install cargo-chef
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json --bin ${APP_NAME}

# Stage 3: Builder
FROM rust:slim-bookworm AS builder
WORKDIR /app
ARG APP_NAME

# Install build dependencies BEFORE copying cached dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    libunwind-dev \
    libdw-dev \
    build-essential \
    clang \
    lld \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=cacher /app/target target
COPY --from=cacher /usr/local/cargo /usr/local/cargo
COPY . .

# Build the project
RUN cargo build --release --bin ${APP_NAME}

# Stage 4: Final
FROM debian:bookworm-slim
WORKDIR /app
ARG APP_NAME

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    libunwind-dev \
    libdw-dev \
    build-essential \
    python3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy the built binary from the builder stage
COPY --from=builder /app/target/release/${APP_NAME} /usr/local/bin/${APP_NAME}
COPY --from=builder /app/apps/rindexer/abis /app/abis
COPY --from=builder /app/apps/rindexer/rindexer.yaml /app/rindexer.yaml

# Set the default command
CMD ["proposalsapp-rindexer"]
