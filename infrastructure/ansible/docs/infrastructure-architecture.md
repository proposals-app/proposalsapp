# ProposalsApp Infrastructure Architecture

## Overview

This infrastructure implements a highly available, geographically distributed system using three physical Proxmox servers as independent datacenters. Each datacenter operates as a complete, self-contained unit with all necessary components. The design prioritizes simplicity, clarity, and true redundancy over complex configurations.

## Physical Architecture

### Three Datacenters
- **DC1** (`sib-01`) - Sibiu, Romania - Primary datacenter
- **DC2** (`sib-03`) - Sibiu, Romania - Different building/network  
- **DC3** (`fsn-01`) - Falkenstein, Germany - Geographic redundancy

### Container Layout per Datacenter
Each Proxmox server runs exactly 3 LXC containers:

```
Proxmox Server (Physical Host)
├── consul-nomad-xxx (Control Plane)
│   ├── Consul Server (single per DC)
│   └── Nomad Server (part of 3-node cluster)
├── apps-xxx (Application Layer)
│   ├── Nomad Client
│   ├── PgCat (PostgreSQL proxy)
│   └── Application workloads
└── db-xxx (Database Layer)
    ├── PostgreSQL 17
    └── Patroni (HA orchestrator)
```

## Network Architecture

All inter-datacenter communication happens over Tailscale VPN (100.x.x.x network). This provides:
- Encrypted communication
- Direct peer-to-peer connectivity
- Stable IPs regardless of physical network changes

## Component Architecture

### Consul - Service Discovery & Configuration

**Design Decision**: Single Consul server per datacenter with WAN federation.

**Why**: 
- Each DC has only 2 LXC containers - clustering within DC provides no real redundancy
- If physical server fails, both containers fail together
- WAN federation provides cross-DC service discovery

**Configuration**:
```hcl
bootstrap_expect = 1        # Single server per DC
datacenter = "dc1"          # Unique per location
primary_datacenter = "dc1"  # For ACL/CA root
retry_join_wan = [...]      # Connect to other DCs
# NO retry_join - no other servers in same DC!
```

**How it works**:
1. Each Consul server is independent leader of its datacenter
2. WAN gossip protocol federates the three datacenters
3. Service registrations are DC-local but queryable globally
4. Failure of one DC doesn't affect others' Consul operation

### Nomad - Workload Orchestration

**Design Decision**: Single 3-node cluster spanning all datacenters.

**Configuration**:
```hcl
bootstrap_expect = 3     # Forms single Raft cluster
region = "global"        # All servers in same region
datacenter = "dc1"       # Scheduling constraint
```

**Key Behaviors**:
- Maintains quorum with 2/3 servers operational
- Can schedule jobs to any datacenter
- Automatic rescheduling if a datacenter fails
- Single control plane for all workloads

### PostgreSQL + Patroni - Database Layer

**Design Decision**: One primary with two synchronous replicas using quorum commit.

**Architecture**:
```
db-sib-01 (Primary) 
    ├── Synchronous replication → db-sib-03 (Standby)
    └── Synchronous replication → db-fsn-01 (Standby)

Quorum: ANY 1 (db-sib-03, db-fsn-01)
```

**Key Configuration**:
```yaml
# Patroni settings
synchronous_mode: true
synchronous_mode_strict: false  # Don't halt on replica loss
synchronous_node_count: 1       # Need 1 of 2 replicas
synchronous_standby_names: 'ANY 1 (db-sib-03,db-fsn-01)'

# PostgreSQL settings  
synchronous_commit: remote_apply  # Full durability
shared_buffers: 2GB              # 25% of RAM (configurable)
effective_cache_size: 6GB        # 75% of RAM (configurable)
password_encryption: scram-sha-256

# Security - Tailscale network only
pg_hba:
  - host all all 100.64.0.0/10 scram-sha-256
  - host all all 0.0.0.0/0 reject
```

**How Patroni works**:
1. Manages PostgreSQL lifecycle (start/stop/promote)
2. Registers in Consul with role tags (primary/replica)
3. Handles automatic failover using Consul for consensus
4. Configures replication topology dynamically

### PgCat - Intelligent PostgreSQL Proxy

**Design Decision**: Connection pooler with query parsing for automatic read/write split.

**Placement**: Runs on each application node, not database nodes.

**How it routes (Local-First Strategy)**:
- **Writes** (INSERT/UPDATE/DELETE) → Primary (wherever it is)
- **Reads** (SELECT) → Local DC database FIRST (whether primary or replica)
- **Transactions with writes** → Entire transaction to primary
- **Fallback behavior** → If local DB is down, uses remote databases

**Key Innovation**: PgCat is configured to always try the local database first, regardless of whether it's primary or replica. This ensures minimal latency for reads while maintaining write consistency.

**Dynamic Configuration via Consul Template**:
```toml
# Auto-generated with local-first server ordering
[pools.proposalsapp.shards.0]
servers = [
  # Local database ALWAYS listed first (dc2 example)
  ["100.84.130.3", 5432, "replica"],  # Local DB in dc2
  
  # Remote databases as fallbacks
  ["100.66.57.51", 5432, "primary"],  # Primary in dc1
  ["100.125.126.113", 5432, "replica"],  # Replica in dc3
]

# Critical settings for local-first reads
query_parser_enabled = true
query_parser_read_write_splitting = true
primary_reads_enabled = true  # Allows reading from primary when it's local
```

**Benefits**:
- Single connection string for applications: `postgresql://user:pass@localhost:5432/db`
- Zero application changes needed
- Automatic failover handling
- Optimized read latency (local reads)

## Data Flow Examples

### Read Query from App in DC2 (Local is Replica)
```
1. App connects to localhost:5432 (PgCat)
2. PgCat parses: "SELECT * FROM users"
3. Checks first server in list (local db-sib-03)
4. Routes to local replica with minimal latency
```

### Read Query from App in DC1 (Local is Primary)
```
1. App connects to localhost:5432 (PgCat)
2. PgCat parses: "SELECT * FROM users"
3. Checks first server in list (local db-sib-01)
4. Routes to local primary (optimal - no cross-DC latency!)
```

### Write Query from App in Any DC
```
1. App connects to localhost:5432 (PgCat)
2. PgCat parses: "INSERT INTO users..."
3. Identifies write query, finds primary in server list
4. Routes to primary (wherever it is)
5. Primary replicates to at least one standby
6. Confirms write to application
```

## Failure Scenarios

### Complete Datacenter Failure (e.g., DC3 power loss)

**Impact**:
- **Consul**: DC3 loses service discovery (DC1 & DC2 unaffected)
- **Nomad**: Continues with 2/3 quorum, reschedules DC3 workloads
- **PostgreSQL**: Continues with one replica (still has quorum)
- **Applications**: DC3 apps down until rescheduled

**Recovery**: Automatic except for Consul (manual restart needed)

### Network Partition (DC3 isolated)

**Impact**:
- **Consul**: DC3 operates standalone, can't sync services
- **Nomad**: DC3 server marked failed, workloads rescheduled
- **PostgreSQL**: DC3 replica becomes stale (read-only)
- **Applications**: Continue with stale reads in DC3

**Recovery**: Automatic healing when network restored

### Primary Database Failure

**Process**:
1. Patroni detects failure (~10 seconds)
2. Initiates election between db-sib-03 and db-fsn-01
3. Promotes winner to primary
4. Updates Consul service registration
5. Consul Template sees change
6. Updates PgCat configuration
7. Writes now route to new primary

**Time to recovery**: ~30-45 seconds total

### Loss of Both Replicas

**With current settings**:
- Primary continues accepting writes (synchronous_mode_strict: false)
- No synchronous replication (potential data loss on primary failure)
- Alert should trigger for manual intervention

## Why This Architecture?

### 1. Real Redundancy
- Three physically separate locations
- Independent power and network
- True disaster recovery capability

### 2. Simple Failure Domains  
- Each Proxmox server = one datacenter
- Container failure = datacenter failure
- No complex partial failure scenarios

### 3. Cost Effective
- Only 3 physical servers total
- Efficient resource utilization
- No unnecessary redundancy within DCs

### 4. Operational Clarity
- Each component has a clear role
- Predictable failure modes
- Easy to reason about state

## Operational Procedures

### Deployment Order
1. **Tailscale** - Network connectivity first
2. **Consul** - Service discovery infrastructure
3. **PostgreSQL/Patroni** - Database layer
4. **Nomad** - Orchestration layer
5. **PgCat** - Application connectivity
6. **Applications** - Via Nomad jobs

### Monitoring Checklist
- [ ] Consul WAN federation: `consul members -wan`
- [ ] Patroni cluster: `patronictl list`
- [ ] Replication lag: Check pg_stat_replication
- [ ] PgCat routing: Verify local reads
- [ ] Nomad jobs: All healthy and placed

### Backup Strategy (To Be Implemented)
1. Continuous WAL archiving to S3-compatible storage
2. Daily base backups via pgBackRest
3. Point-in-time recovery testing
4. Cross-region backup replication

## Configuration Management

### Ansible Playbooks
- `01-configure-tailscale.yml` - VPN setup
- `02-install-consul.yml` - Service discovery
- `03-install-nomad.yml` - Orchestration
- `04-install-postgres.yml` - Database with Patroni
- `05-install-pgcat.yml` - Proxy layer

### Key Variables
```yaml
# Resource tuning (in inventory/group_vars)
postgres_shared_buffers: "2GB"      # Adjust per RAM
postgres_effective_cache_size: "6GB"
postgres_work_mem: "16MB"

# Network settings
tailscale_network: "100.64.0.0/10"
consul_wan_port: 8302
```

## Security Considerations

1. **Network**: All traffic over Tailscale VPN
2. **Authentication**: SCRAM-SHA-256 for PostgreSQL
3. **Authorization**: Network-level restrictions (no 0.0.0.0/0)
4. **Secrets**: Stored in Ansible Vault
5. **Encryption**: TLS for all service communication

## Limitations & Trade-offs

1. **Manual Consul recovery** - No automatic Consul server restart
2. **Static primary assignment** - Initial primary is predetermined
3. **No shared storage** - Each DC has independent storage
4. **Cross-DC latency** - Writes always cross DC boundaries
5. **Quorum requirements** - Need 2/3 DCs operational

This architecture achieves high availability through geographic distribution and intelligent routing while maintaining operational simplicity. The design philosophy prioritizes clarity and debuggability over complex automation.