# Use the latest version of Rust
FROM rust:latest as builder

# Set the working directory
WORKDIR /app

# Copy only the specified files for the setup phase
COPY Cargo.toml .
COPY apps/detective/ ./apps/detective/
COPY libs/rust/ ./libs/rust/

# Build the project for the specified target
RUN cargo build --release --package votes-producer

# Use a minimal Debian image for the final stage
FROM debian:stable-slim

# Set the working directory
WORKDIR /app

# Install required dependencies (if any)
RUN apt-get update && apt-get install -y \
    libssl-dev \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy the built binary from the builder stage
COPY --from=builder /app/target/release/votes-producer /usr/local/bin/votes-producer

# Set the environment variable
ENV PROPOSALS_BIN=votes-producer

# Set the default command
CMD ["votes-producer"]
