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

### consul-replicate - Cross-DC KV Synchronization

**Purpose**: Synchronizes Patroni's distributed configuration across datacenters.

**Configuration**:
- Each DC runs consul-replicate daemon
- Pulls `/service/proposalsapp` prefix from other DCs
- Provides eventual consistency (~1-2 second delay)
- Best-effort replication with automatic retry

**Benefits**:
- No single point of failure for Patroni DCS
- Each DC can operate independently
- Automatic conflict resolution (last-write-wins)
- Minimal performance impact

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

**Design Decision**: Single Patroni cluster across all datacenters with dynamic leader election.

**Architecture**:
```
Single Patroni Cluster (coordinated via dc1's Consul KV)
├── Leader (dynamically elected - any DC)
├── Synchronous Replica 1 (different DC)
└── Synchronous Replica 2 (different DC)

Quorum: ANY 1 (two replicas)
Initial roles are suggestions only - Patroni handles actual role assignment
```

**Key Configuration**:
```yaml
# Patroni settings
scope: proposalsapp              # Cluster name
namespace: /service/             # Consul KV namespace
synchronous_mode: true
synchronous_mode_strict: false   # Don't halt on replica loss
synchronous_node_count: 1        # Need 1 of 2 replicas

# Consul integration
consul:
  # Each node uses local DC - consul-replicate handles sync
  consistency: stale             # Allow stale reads for performance
  register_service: true         # Local service registration

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
5. **Multi-DC Coordination via consul-replicate**:
   - Each Patroni node uses its local datacenter's Consul
   - consul-replicate synchronizes `/service/proposalsapp` KV prefix across all DCs
   - Provides eventual consistency with ~1-2 second replication delay
   - Ensures single cluster while maintaining DC independence

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

### Complete Datacenter Failure (Any DC)

**Impact**:
- **Consul**: Failed DC's services become unavailable locally
- **consul-replicate**: Stops syncing from failed DC (other DCs continue)
- **Patroni**: Can still perform all operations via remaining DCs
  - Leader elections work (if leader was in failed DC)
  - Configuration changes possible
  - Automatic failover functions normally
- **PostgreSQL**: Loses one replica but maintains quorum
- **Nomad**: Maintains quorum with 2/3 servers (DC1/DC2 failures) or full operation (DC3 failure)
- **Applications**: Failed DC's apps down until rescheduled

**Recovery**: Fully automatic
- Consul service configured with `Restart=on-failure` and Tailscale dependency
- WAN federation health check automatically repairs connectivity issues
- If DC3 is down >72 hours, manual Consul restart required after power restoration

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
2. Initiates election between remaining nodes via dc1's Consul
3. Promotes winner to leader (could be in any DC)
4. Updates Consul service registration locally
5. Consul Template sees change
6. Updates PgCat configuration
7. Writes now route to new leader

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
2. **Consul + consul-replicate** - Service discovery and KV replication
3. **Nomad** - Orchestration layer
4. **PostgreSQL/Patroni** - Database layer with replicated DCS
5. **PgCat** - Application connectivity
6. **Applications** - Via Nomad jobs

### Monitoring Checklist
- [ ] Consul WAN federation: `consul members -wan`
- [ ] consul-replicate status: `systemctl status consul-replicate`
- [ ] Patroni cluster: `patronictl list`
- [ ] DCS replication: Check KV consistency across DCs
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

## Consul WAN Federation Health Check

A critical component of the infrastructure is the automated WAN federation health check service that ensures Consul's cross-datacenter connectivity remains stable. This service is essential because WAN federation can occasionally fail due to network issues, extended outages, or Consul's automatic reaping of inactive members.

### Architecture

The health check is implemented as a systemd service (`consul-wan-health.service`) that runs on each Consul server node:

```
consul-wan-health.service
├── Monitors WAN federation status every 5 minutes
├── Detects missing datacenter members
├── Implements intelligent restart logic with cooldown
└── Logs all actions for troubleshooting
```

### Key Features

1. **Continuous Monitoring**
   - Checks `consul members -wan` output every 5 minutes
   - Verifies all 3 datacenters are present in WAN federation
   - Validates Consul service is running before checking federation

2. **Automatic Repair**
   - Attempts to restart Consul service when federation is broken
   - Waits for Tailscale interface to be ready before starting
   - Verifies repair success after each restart attempt

3. **Restart Protection**
   - Maximum 3 restart attempts within any 10-minute window
   - 10-minute cooldown period between restart attempts
   - Restart counter resets after 20 minutes of stability
   - Prevents service flapping during persistent issues

4. **State Tracking**
   - Maintains state in `/var/lib/consul/health-check/wan-health.state`
   - Tracks restart count and last restart timestamp
   - Persists across service restarts

### Configuration

```bash
# Key parameters (set in consul-wan-health.sh)
EXPECTED_WAN_MEMBERS=3      # One server per datacenter
CHECK_INTERVAL=300          # 5 minutes between checks
MAX_RESTART_ATTEMPTS=3      # Maximum restarts in window
RESTART_COOLDOWN=600        # 10 minutes between attempts
```

### Operation Flow

1. **Startup Phase**
   ```
   Start → Wait for Tailscale → Verify Consul server → Begin monitoring
   ```

2. **Health Check Loop**
   ```
   Every 5 minutes:
   ├── Count WAN members
   ├── If count < 3:
   │   ├── Check cooldown period
   │   ├── Check restart limit
   │   ├── Restart Consul if allowed
   │   └── Verify repair success
   └── If healthy: Reset counters
   ```

3. **Failure Scenarios**
   - **Transient network issue**: Service waits and rechecks
   - **Persistent WAN failure**: Attempts restart with cooldown
   - **Extended outage (>72h)**: Requires manual intervention after Consul reaps the member

### Monitoring and Troubleshooting

1. **View Service Status**
   ```bash
   systemctl status consul-wan-health
   ```

2. **Check Logs**
   ```bash
   # All health check logs
   journalctl -u consul-wan-health -f
   
   # Filter for issues
   journalctl -u consul-wan-health -p warning
   ```

3. **Manual WAN Status Check**
   ```bash
   # On any Consul server
   consul members -wan
   ```

4. **State File Inspection**
   ```bash
   cat /var/lib/consul/health-check/wan-health.state
   ```

### Security Hardening

The service runs with restricted privileges:
- User/Group: `consul`
- No new privileges
- Private tmp directory
- Read-only system access (except state directory)
- Isolated from user home directories

### Integration with Infrastructure

The health check service is automatically deployed as part of the Consul installation:

1. Script deployed to `/usr/local/bin/consul-wan-health.sh`
2. Systemd service configured with proper dependencies
3. Starts automatically after Consul service
4. Restarts if it fails (with 30-second delay)

This automated health check significantly improves infrastructure resilience by detecting and resolving WAN federation issues without manual intervention, ensuring cross-datacenter services remain available even during network disruptions.

## Limitations & Trade-offs

1. **Extended outage recovery** - Consul requires manual restart if DC is down >72 hours (WAN reaping timeout)
2. **Eventual consistency** - consul-replicate provides ~1-2 second delay for DCS state propagation
3. **No shared storage** - Each DC has independent storage
4. **Cross-DC latency** - Writes may cross DC boundaries depending on leader location
5. **Quorum requirements** - Need 2/3 DCs operational for both Nomad and PostgreSQL
6. **Replication conflicts** - Resolved via last-write-wins, potential for brief inconsistencies during network partitions

This architecture achieves high availability through geographic distribution and intelligent routing while maintaining operational simplicity. The design philosophy prioritizes clarity and debuggability over complex automation.