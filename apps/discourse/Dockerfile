# syntax=docker/dockerfile:1
ARG APP_NAME=discourse
# Rust 1.88+ required for alloy dependency
ARG RUST_VERSION=1.92

# Stage 1: Planner - generates recipe.json for dependency caching
FROM dhi.io/rust:${RUST_VERSION}-debian13-dev AS planner
ARG APP_NAME
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev git \
    && rm -rf /var/lib/apt/lists/*

RUN cargo install cargo-chef@0.1.73 --locked

COPY . .
RUN cargo chef prepare --recipe-path recipe.json --bin ${APP_NAME}

# Stage 2: Builder - compiles dependencies and application
FROM dhi.io/rust:${RUST_VERSION}-debian13-dev AS builder
ARG APP_NAME
WORKDIR /app

# Install all build dependencies once
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config libssl-dev libunwind-dev libdw-dev \
    build-essential clang lld python3 git curl \
    && rm -rf /var/lib/apt/lists/*

# Install cargo-chef and sccache for caching
RUN cargo install cargo-chef@0.1.73 sccache --locked

# Configure sccache and build environment
ENV RUSTC_WRAPPER=/root/.cargo/bin/sccache \
    SCCACHE_DIR=/sccache \
    CARGO_TARGET_DIR=/app/target \
    CARGO_NET_GIT_FETCH_WITH_CLI=true \
    CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse \
    RUSTFLAGS="-C link-arg=-fuse-ld=lld" \
    PATH="/root/.cargo/bin:${PATH}"

# Copy recipe and cook dependencies (cached layer)
COPY --from=planner /app/recipe.json recipe.json
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    --mount=type=cache,target=/usr/local/cargo/git,sharing=locked \
    --mount=type=cache,id=cargo-target-discourse,target=/app/target,sharing=locked \
    --mount=type=cache,target=/sccache,sharing=locked \
    cargo chef cook --release --recipe-path recipe.json --bin ${APP_NAME}

# Copy source and build application
COPY . .
RUN --mount=type=cache,target=/usr/local/cargo/registry,sharing=locked \
    --mount=type=cache,target=/usr/local/cargo/git,sharing=locked \
    --mount=type=cache,id=cargo-target-discourse,target=/app/target,sharing=locked \
    --mount=type=cache,target=/sccache,sharing=locked \
    cargo build --release --bin ${APP_NAME} \
    && cp /app/target/release/${APP_NAME} /usr/local/bin/${APP_NAME}

# Stage 3: Runtime - minimal production image
FROM debian:trixie-slim AS runtime
ARG APP_NAME
WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates libssl3t64 libunwind8 libdw1t64 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user with stable UID/GID
RUN groupadd -g 10001 appgroup && \
    useradd -u 10000 -g appgroup -s /bin/false appuser && \
    chown -R appuser:appgroup /app

# Copy binary from builder
COPY --from=builder --chown=appuser:appgroup /usr/local/bin/${APP_NAME} /usr/local/bin/${APP_NAME}

USER appuser:appgroup
EXPOSE 3000
CMD ["discourse"]
