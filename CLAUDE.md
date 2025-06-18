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
yarn storybook              # Component development environment
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

## Infrastructure

### Physical Architecture

ProposalsApp runs on a highly available, geographically distributed infrastructure:

- **DC1** (`sib-01`) - Sibiu, Romania - Primary datacenter
- **DC2** (`sib-03`) - Sibiu, Romania - Different building/network  
- **DC3** (`fsn-01`) - Falkenstein, Germany - Geographic redundancy

Each datacenter runs on Proxmox with 3 LXC containers:
- `consul-nomad-xxx`: Control plane (Consul server, Nomad server)
- `apps-xxx`: Application layer (Nomad client, PgCat proxy, app workloads)
- `db-xxx`: Database layer (PostgreSQL 17, Patroni, etcd)

All inter-datacenter communication happens over Tailscale VPN (100.x.x.x network).

### Service Architecture

#### Consul (Service Discovery)
- Single server per datacenter with WAN federation
- Service registration and health checking
- Dynamic configuration via KV store
- DNS interface for service discovery
- Automatic WAN federation health monitoring

#### etcd (Distributed Configuration)
- Three-node cluster for Patroni consensus
- Leader election for PostgreSQL primary
- Strong consistency across datacenters
- Optimized for 50ms RTT between DCs

#### Nomad (Orchestration)
- Single 3-node cluster spanning all datacenters
- Automatic workload scheduling and rescheduling
- Job definitions in `infrastructure/nomad-jobs/`

#### PostgreSQL + Patroni (Database)
- PostgreSQL 17 with automatic failover
- Single cluster with one primary and two replicas
- Synchronous replication (at least one replica)
- Automatic failover in ~30-45 seconds
- etcd-based distributed configuration

#### PgCat (Database Proxy)
- Connection pooling on each app node
- Intelligent query parsing for read/write splitting
- Single connection URL: `postgresql://user:pass@localhost:5432/db`
- Automatic routing updates via Confd watching etcd
- Uses "least outstanding connections" load balancing for local-first reads

### Deployment Process

#### Infrastructure Provisioning (Ansible)

1. **Initial Setup**
   ```bash
   cd infrastructure/ansible
   # Create vault for secrets
   ansible-vault create group_vars/all/vault.yml --vault-password-file .vault_pass
   ```

2. **Deploy Infrastructure** (in order)
   ```bash
   # 1. Create LXC containers with Tailscale
   ansible-playbook -i inventory.yml playbooks/01-provision-and-prepare-lxcs.yml --vault-password-file .vault_pass
   
   # 2. Install Consul cluster
   ansible-playbook -i inventory.yml playbooks/02-install-consul.yml --vault-password-file .vault_pass
   
   # 3. Install Nomad cluster
   ansible-playbook -i inventory.yml playbooks/03-install-nomad.yml --vault-password-file .vault_pass
   
   # 4. Setup etcd cluster
   ansible-playbook -i inventory.yml playbooks/04-install-etcd.yml --vault-password-file .vault_pass
   
   # 5. Install PostgreSQL with Patroni
   ansible-playbook -i inventory.yml playbooks/05-install-postgres.yml --vault-password-file .vault_pass
   
   # 6. Setup PgCat proxy
   ansible-playbook -i inventory.yml playbooks/06-install-pgcat.yml --vault-password-file .vault_pass
   ```

#### Application Deployment (Nomad)

```bash
# Deploy infrastructure services
nomad job run infrastructure/nomad-jobs/cloudflared.nomad
nomad job run infrastructure/nomad-jobs/traefik.nomad
nomad job run infrastructure/nomad-jobs/redis.nomad

# Deploy applications
nomad job run infrastructure/nomad-jobs/web.nomad
nomad job run infrastructure/nomad-jobs/indexers.nomad
```

### Container Images

All applications use multi-stage Docker builds:
- `apps/web/Dockerfile` - Next.js frontend
- `apps/email-service/Dockerfile` - Email notification service
- `apps/rindexer/Dockerfile` - Blockchain indexer
- `apps/mapper/Dockerfile` - Data relationship engine
- `apps/discourse/Dockerfile` - Forum indexer

### Database Management

#### Migrations
- TypeScript migrations in `libs/ts/db/migrations/`
- Main schema: `000_consolidated.ts`
- DAO-specific: `001_arbitrum.ts`, etc.
- Run via Kysely migration CLI

#### Connection Strings
- Applications: `postgresql://user:pass@localhost:5432/db` (via PgCat)
- Direct access: `postgresql://user:pass@db-sib-01:5432/db` (via Tailscale hostname)

### Monitoring & Operations

#### Service Status
```bash
# Consul (requires token)
consul members
consul members -wan

# Nomad (requires token)
nomad server members
nomad node status
nomad job status

# Database
patronictl -c /etc/patroni/config.yml list

# etcd
etcdctl endpoint health --endpoints=<all-nodes>
```

#### Failure Scenarios
- **Datacenter failure**: Automatic failover, maintains quorum with 2/3 DCs
- **Network partition**: DC3 isolation handled gracefully
- **Database failure**: Patroni promotes new primary in ~30-45 seconds
- **WAN federation issues**: Automatic repair via health check service

### Security
- All traffic encrypted via Tailscale VPN
- PostgreSQL uses SCRAM-SHA-256 authentication
- Network restricted to Tailscale network (100.64.0.0/10)
- Secrets stored in Ansible Vault
- ACLs enabled on Consul and Nomad

## Infrastructure & Deployment

### Physical Architecture

- **Three datacenters**: Sibiu DC1 (Romania), Sibiu DC2 (Romania), Falkenstein (Germany)
- **Virtualization**: Proxmox with LXC containers
- **Networking**: Tailscale VPN for secure inter-datacenter communication
- **Service mesh**: Consul for service discovery and health checking

### Infrastructure Components

1. **Consul**: Service discovery, health checking, KV store
   - Runs on all nodes with automatic WAN federation
   - Provides DNS interface for service resolution

2. **etcd**: Distributed consensus for Patroni and configuration management
   - 3-node cluster for PostgreSQL HA coordination
   - Manages leader election and failover
   - Stores Patroni cluster state for dynamic configuration

3. **PostgreSQL with Patroni**: High-availability database
   - Automatic failover with synchronous replication
   - Multiple standbys across datacenters
   - Managed via Patroni REST API
   - State stored in etcd under `/service/proposalsapp/`

4. **PgCat**: Connection pooling and intelligent query routing
   - Dynamic configuration via Confd watching etcd
   - Automatic primary/replica discovery
   - Query parser for read/write splitting
   - **Least outstanding connections (LOC) load balancing**
   - Automatically favors local databases due to lower latency
   - Automatic configuration reload on topology changes
   - Listens on port 5432 (appears as regular PostgreSQL)

5. **Confd**: Dynamic configuration management
   - Watches etcd for Patroni state changes
   - Automatically regenerates PgCat configuration
   - Ensures write queries always route to current primary
   - Maintains local-first server ordering in configuration
   - Zero-downtime configuration updates via SIGHUP

6. **Nomad**: Container orchestration
   - Manages application deployments
   - Integrated with Consul for service registration

### Deployment Process

```bash
# Infrastructure setup (run in order)
cd infrastructure/ansible
./deploy-infrastructure.sh

# Or run individual infrastructure playbooks:
ansible-playbook -i inventory.yml playbooks/infrastructure/01-provision-and-prepare-lxcs.yml
ansible-playbook -i inventory.yml playbooks/infrastructure/02-install-consul.yml
ansible-playbook -i inventory.yml playbooks/infrastructure/03-install-nomad.yml
ansible-playbook -i inventory.yml playbooks/infrastructure/04-install-etcd.yml
ansible-playbook -i inventory.yml playbooks/infrastructure/05-install-postgres.yml
ansible-playbook -i inventory.yml playbooks/infrastructure/06-install-pgcat.yml

# Deploy applications (setup + deploy)
./deploy-application.sh rindexer
./deploy-application.sh web
./deploy-application.sh redis
./deploy-application.sh traefik

# Or deploy manually:
ansible-playbook -i inventory.yml applications/rindexer/setup-consul-kv.yml
nomad job run applications/rindexer/rindexer.nomad
```

### Container Images

All services use multi-stage Docker builds:
- `apps/rindexer/Dockerfile`
- `apps/discourse/Dockerfile`
- `apps/mapper/Dockerfile`
- `apps/web/Dockerfile`
- `apps/email-service/Dockerfile`

### Database Access

- **Via PgCat** (recommended): `postgresql://user:pass@localhost:5432/dbname`
  - Always connects to local PgCat instance
  - Automatically routes to correct primary/replica based on query type
  - **Reads favor local database** (primary or replica) via LOC algorithm
  - **Writes always go to primary** (wherever it is located)
  - Handles failovers transparently
- **Direct access** (not recommended): 
  - Primary/replica endpoints change during failovers
  - Use only for debugging or special cases

### Monitoring & Operations

```bash
# Check service status
consul members                    # Consul cluster status
etcdctl member list              # etcd cluster health
patronictl -c /etc/patroni.yml list  # PostgreSQL cluster status
nomad status                     # Running jobs

# Database operations
patronictl -c /etc/patroni.yml switchover  # Manual failover
patronictl -c /etc/patroni.yml reinit <node>  # Rebuild replica
```

### Deployment Notes

- Infrastructure as Code via Ansible playbooks
- Zero-downtime deployments with Nomad rolling updates
- Database migrations in `libs/ts/db/migrations` (Kysely) and `libs/rust/db/migration` (Sea-ORM)
- Automatic SSL/TLS for all internal communication
- Observability stack available via `apps/observe/docker-compose.yml`
