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

# Stage 4: Final runtime with CUDA development tools
# Use devel image instead of runtime to have CUDA toolkit for llm_client compilation
FROM nvidia/cuda:12.6.2-devel-ubuntu22.04
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
    clang \
    lld \
    nvidia-utils-535 \
    && rm -rf /var/lib/apt/lists/*

# Set environment variables for NVIDIA runtime
ENV NVIDIA_VISIBLE_DEVICES=all
ENV NVIDIA_DRIVER_CAPABILITIES=compute,utility

# Configure environment for llm_client to build llama.cpp with CUDA at runtime
ENV CUDACXX=/usr/local/cuda/bin/nvcc
ENV CMAKE_ARGS="-DGGML_NATIVE=OFF -DGGML_CUDA=ON -DCMAKE_CUDA_ARCHITECTURES=all-major -DBUILD_SHARED_LIBS=OFF -DCMAKE_POSITION_INDEPENDENT_CODE=ON"
ENV GGML_CUDA=1
ENV CUDA_DOCKER_ARCH=all-major
ENV FORCE_CMAKE=1
# Use portable CPU flags
ENV CFLAGS="-march=x86-64-v2 -mtune=generic -fPIC"
ENV CXXFLAGS="-march=x86-64-v2 -mtune=generic -fPIC"
ENV RUSTFLAGS="-C link-arg=-fuse-ld=lld"

# Fix CUDA library paths for runtime
# Ensure both build and runtime libraries are accessible
ENV LD_LIBRARY_PATH=/usr/local/cuda/lib64:/usr/local/cuda/compat:/usr/local/cuda-12.6/compat:/usr/local/nvidia/lib:/usr/local/nvidia/lib64:${LD_LIBRARY_PATH}
ENV LIBRARY_PATH=/usr/local/cuda/lib64:/usr/local/cuda/lib64/stubs:${LIBRARY_PATH}

# Setup CUDA stub libraries for build-time linking
# These will be replaced by real driver libraries at runtime via nvidia-container-runtime
RUN ln -sf /usr/local/cuda/lib64/stubs/libcuda.so /usr/local/cuda/lib64/stubs/libcuda.so.1 && \
    ln -sf /usr/local/cuda/lib64/stubs/libnvidia-ml.so /usr/local/cuda/lib64/stubs/libnvidia-ml.so.1 && \
    echo "/usr/local/cuda/lib64/stubs" > /etc/ld.so.conf.d/cuda-stubs.conf && \
    ldconfig

# Create a startup script that will handle CUDA library detection at runtime
# nvidia-container-runtime injects real driver libraries at /usr/lib/x86_64-linux-gnu/
RUN cat > /usr/local/bin/setup-cuda.sh << 'EOF'
#!/bin/bash
set -e

echo "Setting up CUDA libraries for llm_client..."

# Wait for nvidia-container-runtime to inject driver libraries
sleep 2

# Check multiple locations where nvidia-container-runtime might inject libraries
if [ -f /usr/lib/x86_64-linux-gnu/libcuda.so.1 ] || [ -f /usr/local/nvidia/lib64/libcuda.so.1 ]; then
    echo "✓ NVIDIA driver libraries detected"
    
    # Remove any existing stub symlinks in cuda lib directory
    rm -f /usr/local/cuda/lib64/libcuda.so* 2>/dev/null || true
    
    # Find the actual libcuda.so.1 location
    if [ -f /usr/lib/x86_64-linux-gnu/libcuda.so.1 ]; then
        LIBCUDA_PATH="/usr/lib/x86_64-linux-gnu/libcuda.so.1"
    elif [ -f /usr/local/nvidia/lib64/libcuda.so.1 ]; then
        LIBCUDA_PATH="/usr/local/nvidia/lib64/libcuda.so.1"
    fi
    
    echo "  Found libcuda.so.1 at: $LIBCUDA_PATH"
    
    # Create symlinks to the real driver library for llama.cpp compilation
    ln -sf "$LIBCUDA_PATH" /usr/local/cuda/lib64/libcuda.so.1
    ln -sf /usr/local/cuda/lib64/libcuda.so.1 /usr/local/cuda/lib64/libcuda.so
    
    # Also ensure libnvidia-ml is accessible
    if [ -f /usr/lib/x86_64-linux-gnu/libnvidia-ml.so.1 ]; then
        ln -sf /usr/lib/x86_64-linux-gnu/libnvidia-ml.so.1 /usr/local/cuda/lib64/libnvidia-ml.so.1
        ln -sf /usr/local/cuda/lib64/libnvidia-ml.so.1 /usr/local/cuda/lib64/libnvidia-ml.so
    fi
    
    # Test GPU accessibility
    if command -v nvidia-smi &> /dev/null; then
        echo "  GPU Status:"
        nvidia-smi --query-gpu=name,memory.total --format=csv,noheader || true
    fi
else
    echo "⚠ WARNING: NVIDIA driver libraries not found, using stub libraries"
    echo "  This means llama.cpp will be built without real GPU support"
    
    # Ensure stub libraries are available for compilation
    ln -sf /usr/local/cuda/lib64/stubs/libcuda.so /usr/local/cuda/lib64/libcuda.so
    ln -sf /usr/local/cuda/lib64/stubs/libcuda.so /usr/local/cuda/lib64/libcuda.so.1
    ln -sf /usr/local/cuda/lib64/stubs/libnvidia-ml.so /usr/local/cuda/lib64/libnvidia-ml.so
    ln -sf /usr/local/cuda/lib64/stubs/libnvidia-ml.so /usr/local/cuda/lib64/libnvidia-ml.so.1
fi

# Update library cache
ldconfig 2>/dev/null || true

echo "CUDA setup complete. Starting mapper..."
echo ""

# Execute the main command
exec "$@"
EOF
RUN chmod +x /usr/local/bin/setup-cuda.sh

# Copy the built binary from the builder stage
COPY --from=builder /app/target/release/${APP_NAME} /usr/local/bin/${APP_NAME}

# Note: llm_client will build llama.cpp at runtime with proper GPU detection
# No need to copy pre-built llama_cpp directory

# Use the setup script as entrypoint to ensure CUDA libraries are properly configured
ENTRYPOINT ["/usr/local/bin/setup-cuda.sh"]
CMD ["mapper"]