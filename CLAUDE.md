# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this
repository.

## Project Overview

ProposalsApp is a comprehensive DAO governance aggregation platform that consolidates on-chain
voting, off-chain Snapshot proposals, and community discussions from Discourse forums into a unified
interface. The system supports multiple blockchains and provides real-time governance data for major
DAOs.

## Architecture

### Core Applications

- **rindexer**: Rust-based blockchain indexer for governance contracts (Arbitrum, Ethereum, etc.)
- **discourse**: Rust service that indexes Discourse forum discussions and tracks revisions
- **mapper**: Data relationship engine that groups proposals and calculates user karma scores
- **web**: Next.js 15 frontend with wallet integration and voting capabilities
- **email-service**: Node.js notification service for proposal updates

### Database Design

- PostgreSQL with multi-schema architecture
- `public` schema: shared governance data (proposals, votes, discourse content)
- DAO-specific schemas (e.g., `arbitrum`, `uniswap`): user accounts and preferences
- Type-safe access via Kysely query builder with TypeScript

### Technology Stack

- **Backend**: Rust (Tokio, Axum, Sea-ORM, Alloy for blockchain)
- **Frontend**: Next.js 15, React 19, TailwindCSS, Viem/Wagmi for Web3
- **Database**: PostgreSQL accessed via Kysely (TypeScript) and Sea-ORM (Rust)
- **Observability**: OpenTelemetry stack (Prometheus, Grafana, Loki, Tempo)

## Development Commands

### Building & Running

```bash
# Build specific services
yarn build-web              # Build Next.js frontend
yarn build-email-service    # Build email service
yarn build-emails          # Build email templates

# Start services locally
yarn start-web              # Start Next.js (port 3000)
yarn start-email-service    # Start email notifications

# Web development
cd apps/web
yarn dev                    # Development server with turbopack
yarn ladle                  # Component development environment
```

### Code Quality

```bash
# Lint and format all code
yarn check                  # Run all linting and formatting checks
yarn fix                   # Auto-fix all issues

# TypeScript/JavaScript
yarn lint                  # ESLint check
yarn lint:fix              # ESLint with auto-fix
yarn format               # Prettier check
yarn format:fix           # Prettier auto-fix

# Rust
yarn lint:rust            # Cargo clippy
yarn format:rust          # Cargo format
yarn format:rust:check    # Check Rust formatting

# Setup verification
./scripts/verify-setup.sh  # Verify development environment
```

### Testing

```bash
# Web E2E testing (requires local blockchain)
cd apps/web
yarn anvil                         # Start local Arbitrum fork
yarn e2e:ui                       # Run E2E tests with Playwright UI
yarn synpress-setup              # Setup MetaMask for testing
yarn test-ui                     # Playwright test UI

# Email service testing
cd apps/email-service
yarn test                        # Vitest unit tests
yarn test:coverage              # Test with coverage
```

### Rust Development

```bash
# Build and check
cargo build                     # Build all Rust crates
cargo check                     # Fast compilation check
cargo test                      # Run tests

# Individual services
cargo run --bin discourse       # Run discourse indexer
cargo run --bin mapper          # Run mapping engine
cargo run --bin rindexer        # Run blockchain indexer
```

## Key Development Patterns

### Multi-DAO Support

- Services are configured per DAO via environment variables
- Database schemas are DAO-specific for user data
- Frontend uses subdomain routing (arbitrum.proposals.app, uniswap.proposals.app)

### Real-time Data Flow

1. **rindexer** monitors blockchain events and updates proposals
2. **discourse** indexes forum discussions every minute
3. **mapper** groups related content and calculates karma scores
4. **email-service** sends notifications based on user preferences

### Database Access

- Use `@proposalsapp/db` package for consistent TypeScript database access
- Rust services use Sea-ORM with shared models in `libs/rust/db`
- Always use prepared statements and proper error handling
- DAO-specific data goes in named schemas, shared data in `public`

### Frontend Development

- Components follow Radix UI patterns with TailwindCSS
- Use `nuqs` for URL state management
- Wallet interactions via Wagmi hooks
- Vote submissions require signature confirmation
- PWA-ready with service worker

### Testing Guidelines

- E2E tests use real wallet interactions via Synpress
- Test all vote types: basic, approval, quadratic, ranked-choice, weighted
- Database tests in Rust use `serial_test` to prevent conflicts
- Mock external APIs in tests (Snapshot, Discourse)

### Observability

- All services include OpenTelemetry instrumentation
- Use structured logging with correlation IDs
- Performance monitoring for blockchain indexing
- Health check endpoints for all services

## Deployment Notes

- Services are containerized with multi-stage Docker builds
- Environment-specific configuration via `.env` files
- Database migrations managed via Kysely (TypeScript) and Sea-ORM (Rust)
- Observability stack available via `apps/observe/docker-compose.yml`
