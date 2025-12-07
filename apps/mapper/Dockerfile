ARG APP_NAME=mapper
# Default to latest stable Rust version - update this when Rust releases new stable versions
# Can be overridden in build command with --build-arg RUST_VERSION=1.XX
# Note: Rust 1.91+ required for edition 2024 plus alloy/sol dependencies
ARG RUST_VERSION=1.91

# Stage 1: Planner
FROM rust:${RUST_VERSION}-slim-bookworm AS planner
ARG APP_NAME
WORKDIR /app

# Install build dependencies for the planner stage
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN cargo install cargo-chef --locked
COPY . .
RUN cargo chef prepare --recipe-path recipe.json --bin ${APP_NAME}

# Stage 2: Cacher
FROM rust:${RUST_VERSION}-slim-bookworm AS cacher
WORKDIR /app
ARG APP_NAME
ARG RUST_VERSION

# Install only essential build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    python3 \
    build-essential \
    clang \
    lld \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for faster builds
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
ENV CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse
ENV CARGO_PROFILE_RELEASE_INCREMENTAL=true
ENV CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16
ENV RUSTFLAGS="-C link-arg=-fuse-ld=lld"

RUN cargo install cargo-chef --locked
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json --bin ${APP_NAME}

# Stage 3: Builder
FROM rust:${RUST_VERSION}-slim-bookworm AS builder
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
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for faster builds
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
ENV CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse
ENV CARGO_PROFILE_RELEASE_INCREMENTAL=true
ENV CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16
ENV RUSTFLAGS="-C link-arg=-fuse-ld=lld"

COPY --from=cacher /app/target target
COPY --from=cacher /usr/local/cargo /usr/local/cargo
COPY . .

# Build the project with parallel jobs
RUN cargo build --release --bin ${APP_NAME} --jobs $(nproc)

# Stage 4: Final
FROM debian:bookworm-slim
WORKDIR /app
ARG APP_NAME

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    libunwind8 \
    libdw1 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user with UID >= 10000 for security
# UIDs below 10000 can conflict with host system users if container escapes
RUN groupadd -g 10001 appgroup && \
    useradd -u 10000 -g appgroup -s /bin/false appuser && \
    chown -R appuser:appgroup /app

# Copy the built binary from the builder stage
COPY --from=builder --chown=appuser:appgroup /app/target/release/${APP_NAME} /usr/local/bin/${APP_NAME}

# Switch to non-root user
USER appuser:appgroup

# Expose health server port
EXPOSE 3000

# Set the default command
CMD ["mapper"]
