ARG APP_NAME=mapper
ARG RUST_VERSION=1.88
# Use CUDA 12.4.1 for better driver compatibility
ARG CUDA_VERSION=12.4.1
ARG UBUNTU_VERSION=22.04

# Stage 1: Planner
FROM rust:${RUST_VERSION}-slim-bookworm AS planner
ARG APP_NAME
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    git \
    && rm -rf /var/lib/apt/lists/*

RUN rustup default nightly
RUN cargo install cargo-chef --locked
COPY . .
RUN cargo chef prepare --recipe-path recipe.json --bin ${APP_NAME}

# Stage 2: Cacher with CUDA support
FROM nvidia/cuda:${CUDA_VERSION}-devel-ubuntu${UBUNTU_VERSION} AS cacher
WORKDIR /app
ARG APP_NAME
ARG RUST_VERSION

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

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain ${RUST_VERSION}
ENV PATH="/root/.cargo/bin:${PATH}"

RUN rustup default nightly

ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
ENV CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse
ENV RUSTFLAGS="-C link-arg=-fuse-ld=lld"

# Critical: Configure llama.cpp build for CUDA
ENV CUDACXX=/usr/local/cuda/bin/nvcc
ENV CMAKE_ARGS="-DGGML_NATIVE=OFF -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=all-major"
ENV GGML_CUDA=1
ENV LLAMA_CUDA=1
ENV CUDA_DOCKER_ARCH=all-major
ENV FORCE_CMAKE=1

# Create symlinks for build-time detection
RUN ln -sf /usr/local/cuda/lib64/stubs/libnvidia-ml.so /usr/lib/x86_64-linux-gnu/libnvidia-ml.so.1 && \
    ln -sf /usr/local/cuda/lib64/stubs/libcuda.so /usr/lib/x86_64-linux-gnu/libcuda.so.1 && \
    echo "/usr/local/cuda/lib64/stubs" > /etc/ld.so.conf.d/cuda-stubs.conf && \
    ldconfig

RUN cargo install cargo-chef --locked
COPY --from=planner /app/recipe.json recipe.json
RUN cargo chef cook --release --recipe-path recipe.json --bin ${APP_NAME}

# Stage 3: Builder with CUDA support
FROM nvidia/cuda:${CUDA_VERSION}-devel-ubuntu${UBUNTU_VERSION} AS builder
WORKDIR /app
ARG APP_NAME
ARG RUST_VERSION

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

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain ${RUST_VERSION}
ENV PATH="/root/.cargo/bin:${PATH}"

RUN rustup default nightly

ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
ENV CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse
ENV RUSTFLAGS="-C link-arg=-fuse-ld=lld"

# Critical: Configure llama.cpp build for CUDA
ENV CUDACXX=/usr/local/cuda/bin/nvcc
ENV CMAKE_ARGS="-DGGML_NATIVE=OFF -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=all-major"
ENV GGML_CUDA=1
ENV LLAMA_CUDA=1
ENV CUDA_DOCKER_ARCH=all-major
ENV FORCE_CMAKE=1

# Create symlinks for build-time detection
RUN ln -sf /usr/local/cuda/lib64/stubs/libnvidia-ml.so /usr/lib/x86_64-linux-gnu/libnvidia-ml.so.1 && \
    ln -sf /usr/local/cuda/lib64/stubs/libcuda.so /usr/lib/x86_64-linux-gnu/libcuda.so.1 && \
    echo "/usr/local/cuda/lib64/stubs" > /etc/ld.so.conf.d/cuda-stubs.conf && \
    ldconfig

COPY --from=cacher /app/target target
COPY --from=cacher /root/.cargo /root/.cargo
COPY . .

RUN cargo build --release --bin ${APP_NAME} --jobs $(nproc)

# Stage 4: Runtime with CUDA runtime (not devel)
FROM nvidia/cuda:${CUDA_VERSION}-runtime-ubuntu${UBUNTU_VERSION}
WORKDIR /app
ARG APP_NAME

# Install only runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    libunwind8 \
    libdw1 \
    libcurl4 \
    && rm -rf /var/lib/apt/lists/*

# CRITICAL: These environment variables tell the NVIDIA Container Runtime what to inject
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility
ENV NVIDIA_REQUIRE_CUDA="cuda>=12.4"

# Runtime library paths
ENV LD_LIBRARY_PATH=/usr/local/cuda/lib64:/usr/local/nvidia/lib:/usr/local/nvidia/lib64:${LD_LIBRARY_PATH}

# Copy the built binary
COPY --from=builder /app/target/release/${APP_NAME} /usr/local/bin/${APP_NAME}

# Simple entrypoint - no setup script needed with proper runtime image
ENTRYPOINT ["/usr/local/bin/mapper"]
