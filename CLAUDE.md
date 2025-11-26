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

### Shared Libraries

- **libs/ts/db**: Kysely-based TypeScript database client with migrations (`@proposalsapp/db`)
- **libs/ts/emails**: React Email templates for notifications (`@proposalsapp/emails`)
- **libs/ts/visual-dom-diff**: DOM diffing utility for tracking content changes
- **libs/rust/db**: Sea-ORM models and entities for Rust services
- **libs/rust/utils**: Shared Rust utilities

### Database Design

- PostgreSQL with multi-schema architecture
- `public` schema: shared governance data (proposals, votes, discourse content)
- DAO-specific schemas (e.g., `arbitrum`, `uniswap`): user accounts and preferences
- TypeScript migrations in `libs/ts/db/migrations/`
- Type-safe access via Kysely (TypeScript) and Sea-ORM (Rust)

### Technology Stack

- **Backend**: Rust (Tokio, Axum, Sea-ORM, Alloy for blockchain)
- **Frontend**: Next.js 15, React 19, TailwindCSS, Viem/Wagmi for Web3
- **Database**: PostgreSQL accessed via Kysely (TypeScript) and Sea-ORM (Rust)
- **Deployment**: Coolify

## Development Commands

### Building & Running

```bash
# Build specific services
pnpm build-web              # Build Next.js frontend
pnpm build-email-service    # Build email service
pnpm build-emails           # Build email templates

# Start services locally
pnpm start-web              # Start Next.js (port 3000)
pnpm start-email-service    # Start email notifications

# Web development
cd apps/web
pnpm dev                    # Development server with turbopack
pnpm storybook              # Component development environment
```

### Code Quality

```bash
# Lint and format all code
pnpm check                  # Run all linting and formatting checks
pnpm fix                    # Auto-fix all issues

# TypeScript/JavaScript
pnpm lint                   # ESLint check
pnpm lint:fix               # ESLint with auto-fix
pnpm format                 # Prettier check
pnpm format:fix             # Prettier auto-fix

# Rust
pnpm lint:rust              # Cargo clippy
pnpm format:rust            # Cargo format
pnpm format:rust:check      # Check Rust formatting
```

### Testing

```bash
# Web E2E testing (requires local blockchain)
cd apps/web
pnpm anvil                  # Start local Arbitrum fork
pnpm e2e:ui                 # Run E2E tests with Playwright UI
pnpm synpress-setup         # Setup MetaMask for testing

# Email service testing
cd apps/email-service
pnpm test                   # Vitest unit tests
pnpm test:coverage          # Test with coverage
```

### Rust Development

```bash
cargo build                 # Build all Rust crates
cargo check                 # Fast compilation check
cargo test                  # Run tests

# Individual services
cargo run --bin discourse   # Run discourse indexer
cargo run --bin mapper      # Run mapping engine
cargo run --bin rindexer    # Run blockchain indexer
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
- DAO-specific data goes in named schemas, shared data in `public`

### Frontend Development

- Components follow Radix UI patterns with TailwindCSS
- Use `nuqs` for URL state management
- Wallet interactions via Wagmi hooks
- Vote submissions require signature confirmation

### Testing Guidelines

- E2E tests use real wallet interactions via Synpress
- Test all vote types: basic, approval, quadratic, ranked-choice, weighted
- Database tests in Rust use `serial_test` to prevent conflicts
- Mock external APIs in tests (Snapshot, Discourse)
