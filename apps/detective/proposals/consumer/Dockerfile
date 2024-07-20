# Use the latest version of Rust
FROM rust:latest as builder

# Set the working directory
WORKDIR /app

# Copy only the specified files for the setup phase
COPY Cargo.toml Cargo.toml
COPY apps/detective apps/detective
COPY libs/rust libs/rust

# Build the project for the specified target
RUN cargo build --release --package proposals-consumer

# Use a minimal Debian image for the final stage
FROM debian:latest

# Set the working directory
WORKDIR /app

# Copy the built binary from the builder stage
COPY --from=builder /app/target/release/proposals-consumer .

# Set the environment variable
ENV PROPOSALS_BIN=proposals-consumer

# Set the default command
CMD ["./proposals-consumer"]