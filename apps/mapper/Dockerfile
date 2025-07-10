ARG APP_NAME=mapper
# Default to latest stable Rust version - update this when Rust releases new stable versions
# Can be overridden in build command with --build-arg RUST_VERSION=1.XX
ARG RUST_VERSION=1.88

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

# Switch to nightly Rust for f16 feature support
RUN rustup default nightly

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
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Switch to nightly Rust for f16 feature support
RUN rustup default nightly

# Set environment variables for faster builds
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
ENV CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse
ENV CARGO_PROFILE_RELEASE_INCREMENTAL=true
ENV CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16
ENV RUSTFLAGS="-C link-arg=-fuse-ld=lld"

# Configure llama.cpp build for Docker/container compatibility
# CRITICAL: Disable GGML_NATIVE to prevent CPU-specific optimizations
# This ensures the binary works across different environments (GitHub runners -> LXC containers)
ENV CMAKE_ARGS="-DGGML_NATIVE=OFF -DBUILD_SHARED_LIBS=OFF -DCMAKE_POSITION_INDEPENDENT_CODE=ON"
# Also set environment variables that llm_client might use
ENV GGML_NO_NATIVE=1
ENV LLAMA_NO_NATIVE=1
# Use portable CPU flags that work everywhere
# x86-64-v2 includes SSE3, SSSE3, SSE4.1, SSE4.2 which are available on all modern CPUs
ENV CFLAGS="-march=x86-64-v2 -mtune=generic -fPIC"
ENV CXXFLAGS="-march=x86-64-v2 -mtune=generic -fPIC"

RUN cargo install cargo-chef --locked
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json --bin ${APP_NAME}

# Stage 3: Builder
FROM rust:${RUST_VERSION}-slim-bookworm AS builder
WORKDIR /app
ARG APP_NAME
ARG RUST_VERSION

# Install build dependencies including cmake for llama.cpp
RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    build-essential \
    clang \
    lld \
    libunwind-dev \
    libdw-dev \
    git \
    curl \
    cmake \
    && rm -rf /var/lib/apt/lists/*

# Switch to nightly Rust for f16 feature support
RUN rustup default nightly

# Set environment variables for faster builds
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
ENV CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse
ENV CARGO_PROFILE_RELEASE_INCREMENTAL=true
ENV CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16
ENV RUSTFLAGS="-C link-arg=-fuse-ld=lld"

# Configure llama.cpp build for Docker/container compatibility
# CRITICAL: Disable GGML_NATIVE to prevent CPU-specific optimizations
# This ensures the binary works across different environments (GitHub runners -> LXC containers)
ENV CMAKE_ARGS="-DGGML_NATIVE=OFF -DBUILD_SHARED_LIBS=OFF -DCMAKE_POSITION_INDEPENDENT_CODE=ON"
# Also set environment variables that llm_client might use
ENV GGML_NO_NATIVE=1
ENV LLAMA_NO_NATIVE=1
# Use portable CPU flags that work everywhere
# x86-64-v2 includes SSE3, SSSE3, SSE4.1, SSE4.2 which are available on all modern CPUs
ENV CFLAGS="-march=x86-64-v2 -mtune=generic -fPIC"
ENV CXXFLAGS="-march=x86-64-v2 -mtune=generic -fPIC"

# Copy cached dependencies first
COPY --from=cacher /app/target target
COPY --from=cacher /usr/local/cargo /usr/local/cargo
# Then copy source code
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
    libunwind-dev \
    libdw-dev \
    build-essential \
    python3 \
    curl \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Copy the built binary from the builder stage
COPY --from=builder /app/target/release/${APP_NAME} /usr/local/bin/${APP_NAME}

# Copy llama-server binary and create expected directory structure
RUN mkdir -p /app/target/llama_cpp
COPY --from=builder /app/target/llama_cpp/llama-server /app/target/llama_cpp/llama-server
RUN chmod +x /app/target/llama_cpp/llama-server

# Set the default command
CMD ["mapper"]