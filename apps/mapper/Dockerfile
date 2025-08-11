ARG APP_NAME=mapper
# Default to latest stable Rust version - update this when Rust releases new stable versions
# Can be overridden in build command with --build-arg RUST_VERSION=1.XX
ARG RUST_VERSION=1.89

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

# Stage 2: Cacher with CUDA support
FROM nvidia/cuda:12.6.2-devel-ubuntu22.04 AS cacher
WORKDIR /app
ARG APP_NAME
ARG RUST_VERSION

# Install build dependencies - CUDA is already available in the base image
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

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain ${RUST_VERSION}
ENV PATH="/root/.cargo/bin:${PATH}"

# Switch to nightly Rust for f16 feature support
RUN rustup default nightly

# Set environment variables for faster builds
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
ENV CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse
ENV CARGO_PROFILE_RELEASE_INCREMENTAL=true
ENV CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16
ENV RUSTFLAGS="-C link-arg=-fuse-ld=lld"

# Configure llama.cpp build for Docker/container compatibility with GPU support
# CRITICAL: Disable GGML_NATIVE to prevent CPU-specific optimizations
# This ensures the binary works across different environments (GitHub runners -> LXC containers)
# Enable CUDA support - the base image provides CUDA toolkit
ENV CUDACXX=/usr/local/cuda/bin/nvcc
ENV CMAKE_ARGS="-DGGML_NATIVE=OFF -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=all-major -DBUILD_SHARED_LIBS=OFF -DCMAKE_POSITION_INDEPENDENT_CODE=ON"
# Enable CUDA support
ENV GGML_CUDA=1
ENV CUDA_DOCKER_ARCH=all-major
ENV FORCE_CMAKE=1
# Use portable CPU flags that work everywhere
# x86-64-v2 includes SSE3, SSSE3, SSE4.1, SSE4.2 which are available on all modern CPUs
ENV CFLAGS="-march=x86-64-v2 -mtune=generic -fPIC"
ENV CXXFLAGS="-march=x86-64-v2 -mtune=generic -fPIC"

# Create symlink for libnvidia-ml.so from CUDA stubs for build-time detection
# This allows llm_devices to detect CUDA availability during compilation
RUN ln -sf /usr/local/cuda/lib64/stubs/libnvidia-ml.so /usr/lib/x86_64-linux-gnu/libnvidia-ml.so.1 && \
    ln -sf /usr/lib/x86_64-linux-gnu/libnvidia-ml.so.1 /usr/lib/x86_64-linux-gnu/libnvidia-ml.so && \
    echo "/usr/local/cuda/lib64/stubs" > /etc/ld.so.conf.d/cuda-stubs.conf && \
    ldconfig

RUN cargo install cargo-chef --locked
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json --bin ${APP_NAME}

# Stage 3: Builder with CUDA support
FROM nvidia/cuda:12.6.2-devel-ubuntu22.04 AS builder
WORKDIR /app
ARG APP_NAME
ARG RUST_VERSION

# Install build dependencies - CUDA is already available in the base image
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

# Install Rust
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain ${RUST_VERSION}
ENV PATH="/root/.cargo/bin:${PATH}"

# Switch to nightly Rust for f16 feature support
RUN rustup default nightly

# Set environment variables for faster builds
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
ENV CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse
ENV CARGO_PROFILE_RELEASE_INCREMENTAL=true
ENV CARGO_PROFILE_RELEASE_CODEGEN_UNITS=16
ENV RUSTFLAGS="-C link-arg=-fuse-ld=lld"

# Configure llama.cpp build for Docker/container compatibility with GPU support
# CRITICAL: Disable GGML_NATIVE to prevent CPU-specific optimizations
# This ensures the binary works across different environments (GitHub runners -> LXC containers)
# Enable CUDA support - the base image provides CUDA toolkit
ENV CUDACXX=/usr/local/cuda/bin/nvcc
ENV CMAKE_ARGS="-DGGML_NATIVE=OFF -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=all-major -DBUILD_SHARED_LIBS=OFF -DCMAKE_POSITION_INDEPENDENT_CODE=ON"
# Enable CUDA support
ENV GGML_CUDA=1
ENV CUDA_DOCKER_ARCH=all-major
ENV FORCE_CMAKE=1
# Use portable CPU flags that work everywhere
# x86-64-v2 includes SSE3, SSSE3, SSE4.1, SSE4.2 which are available on all modern CPUs
ENV CFLAGS="-march=x86-64-v2 -mtune=generic -fPIC"
ENV CXXFLAGS="-march=x86-64-v2 -mtune=generic -fPIC"

# Create symlink for libnvidia-ml.so from CUDA stubs for build-time detection
# This allows llm_devices to detect CUDA availability during compilation
RUN ln -sf /usr/local/cuda/lib64/stubs/libnvidia-ml.so /usr/lib/x86_64-linux-gnu/libnvidia-ml.so.1 && \
    ln -sf /usr/lib/x86_64-linux-gnu/libnvidia-ml.so.1 /usr/lib/x86_64-linux-gnu/libnvidia-ml.so && \
    echo "/usr/local/cuda/lib64/stubs" > /etc/ld.so.conf.d/cuda-stubs.conf && \
    ldconfig

# Copy cached dependencies first
COPY --from=cacher /app/target target
COPY --from=cacher /root/.cargo /root/.cargo
# Then copy source code
COPY . .

# Build the project with parallel jobs
RUN cargo build --release --bin ${APP_NAME} --jobs $(nproc)

# Stage 4: Final runtime with CUDA
FROM nvidia/cuda:12.6.2-runtime-ubuntu22.04
WORKDIR /app
ARG APP_NAME

# Install runtime dependencies INCLUDING build tools for llama.cpp compilation
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    libunwind-dev \
    libdw-dev \
    build-essential \
    cmake \
    git \
    python3 \
    curl \
    libcurl4-openssl-dev \
    procps \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for NVIDIA runtime
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility

# Copy the built binary from the builder stage
COPY --from=builder /app/target/release/${APP_NAME} /usr/local/bin/${APP_NAME}

# Copy the llama_cpp directory with the compatible llama-server built by llm_client
COPY --from=builder /app/target/llama_cpp /app/target/llama_cpp

# Set the default command
CMD ["mapper"]
