# Use the latest version of Rust
FROM rust:latest as chef
WORKDIR /app

# Install cargo-chef
RUN cargo install cargo-chef
COPY . .

# Prepare the build plan
RUN cargo chef prepare --recipe-path recipe.json

# Stage 1: Cacher
FROM rust:latest as cacher
WORKDIR /app

# Install cargo-chef
RUN cargo install cargo-chef

# Copy the build plan
COPY --from=chef /app/recipe.json recipe.json

# Restore the dependencies cache
RUN cargo chef cook --release --recipe-path recipe.json

# Stage 2: Builder
FROM rust:latest as builder
WORKDIR /app

# Copy the source code
COPY . .

# Copy the cached dependencies
COPY --from=cacher /app/target target
COPY --from=cacher /usr/local/cargo /usr/local/cargo

# Build the project
RUN cargo build --release --package discourse

# Stage 3: Final
FROM debian:stable-slim
WORKDIR /app

# Install required dependencies
RUN apt-get update && apt-get install -y \
    libssl-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy the built binary from the builder stage
COPY --from=builder /app/target/release/discourse /usr/local/bin/discourse

# Set the environment variable
ENV PROPOSALS_BIN=discourse

# Set the default command
CMD ["discourse"]
