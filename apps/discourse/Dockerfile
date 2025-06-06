ARG APP_NAME=discourse

# Stage 1: Planner
FROM rustlang/rust:nightly-bookworm-slim AS planner
ARG APP_NAME
WORKDIR /app
RUN cargo install cargo-chef
COPY . .
RUN cargo chef prepare --recipe-path recipe.json --bin ${APP_NAME}

# Stage 2: Cacher
FROM rustlang/rust:nightly-bookworm-slim AS cacher
WORKDIR /app
ARG APP_NAME

RUN cargo install cargo-chef

# Install only essential build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    python3 \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json --bin ${APP_NAME}

# Stage 3: Builder
FROM rustlang/rust:nightly-bookworm-slim AS builder
WORKDIR /app
ARG APP_NAME

COPY --from=cacher /app/target target
COPY --from=cacher /usr/local/cargo /usr/local/cargo
COPY . .

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    libunwind-dev \
    libdw-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

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
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy the built binary from the builder stage
COPY --from=builder /app/target/release/${APP_NAME} /usr/local/bin/${APP_NAME}

# Set the default command
CMD ["discourse"]
