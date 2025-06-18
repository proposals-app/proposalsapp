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
│   ├── pgpool-II (PostgreSQL pooler with local-first load balancing)
│   ├── Confd (Dynamic configuration from etcd)
│   └── Application workloads
└── db-xxx (Database Layer)
    ├── PostgreSQL 17
    ├── Patroni (HA orchestrator)
    └── etcd (Distributed configuration store for Patroni)
```

## Network Architecture

All inter-datacenter communication happens over Tailscale VPN (100.x.x.x network). This provides:
- Encrypted communication
- Direct peer-to-peer connectivity
- Stable IPs regardless of physical network changes

## Component Architecture

### Division of Responsibilities: Consul vs etcd

The infrastructure uses both Consul and etcd, each serving distinct purposes:

**Consul Responsibilities**:
- **Service Discovery**: All services register with Consul (databases, pgpool, applications)
- **Health Checking**: Monitors service health and removes failed instances
- **Dynamic Configuration**: Stores configuration in KV store for services like pgpool
- **WAN Federation**: Connects services across datacenters
- **DNS Interface**: Provides service discovery via DNS queries
- **Template Rendering**: Updates configuration files when services change (via consul-template)

**etcd Responsibilities**:
- **Patroni DCS (Distributed Configuration Store)**: Stores PostgreSQL cluster state
- **Leader Election**: Manages which PostgreSQL node is primary
- **Configuration Consensus**: Ensures all Patroni nodes agree on cluster topology
- **Failover Coordination**: Orchestrates automatic database failover
- **Strong Consistency**: Provides ACID guarantees for critical cluster state

**Why Both?**
- **Separation of Concerns**: Database HA (etcd) is separate from service discovery (Consul)
- **Best Tool for Each Job**: etcd excels at distributed consensus, Consul at service mesh
- **Reliability**: Failure of one system doesn't affect the other
- **Flexibility**: Can scale and tune each system independently

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

### etcd - Distributed Configuration Store

**Purpose**: 
- Provides distributed consensus for Patroni's high availability configuration
- Stores PostgreSQL cluster topology for dynamic pgpool configuration via Confd

**Configuration**:
- Three-node etcd cluster spanning all datacenters
- Native WAN federation without additional replication tools
- Strong consistency guarantees for critical configuration data
- Optimized for cross-DC communication:
  - Heartbeat interval: 100ms (handles up to 50ms RTT)
  - Election timeout: 500ms (5x heartbeat as recommended)
  - Snapshot count: 5000 (more frequent snapshots)
  - WAL flush: 100ms (stability over WAN)
  - gRPC keepalive: 10s (faster failure detection)

**Expected Latencies**:
- Romania DC1 ↔ DC2: ~10-20ms
- Romania ↔ Germany: ~30-50ms
- Configuration tuned for worst-case 50ms RTT with jitter

**Benefits**:
- Native multi-DC support without external replication
- Strong consistency for Patroni leader election
- Simplified architecture (no consul-replicate needed)
- Built-in support for network partitions
- I/O and CPU scheduling optimized for consistent performance

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
2. Uses etcd for distributed configuration and leader election
3. Handles automatic failover with etcd's consistent key-value store
4. Configures replication topology dynamically
5. **Multi-DC Coordination via etcd**:
   - All Patroni nodes connect to the federated etcd cluster
   - etcd provides strong consistency across all datacenters
   - No replication delay - immediate consistency
   - Native support for WAN federation

### Confd - Dynamic Configuration Management

**Purpose**: Bridges the gap between etcd (where Patroni stores cluster state) and pgpool-II (which needs to know the current topology).

**Design Decision**: Use Confd instead of Consul Template for direct etcd integration.

**Why Confd?**
- **Direct etcd integration**: No need for intermediate synchronization
- **Simpler architecture**: Fewer moving parts than syncing etcd→Consul→Consul Template
- **Native etcd watch**: Built specifically for watching etcd keys
- **Proven reliability**: Widely used for Kubernetes configurations

**How it works**:
1. **Watches etcd keys**: 
   - `/service/proposalsapp/leader` - Current primary information
   - `/service/proposalsapp/members/*` - All cluster members and their states
2. **Generates pgpool config**: Uses Go templates to create properly ordered server lists with appropriate weights
3. **Triggers reload**: Sends reload command to pgpool for zero-downtime configuration updates
4. **Maintains local-first ordering**: Configures local datacenter servers with higher weights (10x)

**Configuration**:
```toml
# Confd configuration
backend = "etcdv3"
nodes = ["http://100.x.x.x:2379", ...]  # All etcd nodes
prefix = "/service/proposalsapp"
interval = 10  # Check every 10 seconds
```

### pgpool-II - PostgreSQL Connection Pooler with Load Balancing

**Design Decision**: Connection pooler with query parsing for automatic read/write split and weight-based load balancing.

**What is pgpool-II?**
pgpool-II is a PostgreSQL middleware that provides:
- **Connection pooling** to reduce overhead of creating new database connections
- **Query parsing** to intelligently route queries based on their type
- **Automatic failover** handling without application changes
- **Load balancing** across multiple database replicas with configurable weights
- **Transaction pooling** for better resource utilization
- **Native PostgreSQL protocol** support - appears as a regular PostgreSQL server

**Placement**: Runs on each application node, not database nodes.

**How it routes (Weight-Based Local-First Strategy)**:
- **Writes** (INSERT/UPDATE/DELETE) → Primary (wherever it is)
- **Reads** (SELECT) → Distributed based on backend weights (local servers have 10x weight)
- **Transactions with writes** → Entire transaction to primary
- **Fallback behavior** → If local DB is down, uses remote databases

**Key Features**: pgpool-II uses weight-based load balancing where local servers are configured with much higher weights (10) compared to remote servers (1). This ensures that approximately 83% of read queries go to the local database, minimizing cross-datacenter latency while maintaining failover capability.

**Dynamic Configuration via Confd**:

**How it works**:
1. **Patroni stores state in etcd**: Leader election, member status, and connection information
2. **Confd watches etcd**: Monitors `/service/proposalsapp/leader` and `/service/proposalsapp/members/*`
3. **Automatic configuration generation**: When topology changes, Confd regenerates pgpool backend config
4. **Zero-downtime reload**: pgpool receives reload command and updates without dropping connections

**Critical Settings for Optimal Routing**:
- `load_balance_mode = on` - Enables read query distribution
- `master_slave_mode = on` - Enables streaming replication mode
- `statement_level_load_balance = on` - Better distribution of queries
- `pool_mode = 'transaction'` - Transaction-level pooling for better concurrency
- `backend_weight0 = 10` - Much higher weight for local server
- `backend_weight1 = 1` - Lower weight for remote servers

```conf
# Auto-generated by Confd with environment-based local detection
# Example for apps-sib-01 (dc1): local database gets weight 10
backend_hostname0 = '100.77.231.17'    # db-sib-01 (local)
backend_port0 = 5432
backend_weight0 = 10  # 10x weight for local server
backend_flag0 = 'ALLOW_TO_FAILOVER'

# Remote datacenter servers (weight 1 each)
backend_hostname1 = '100.95.245.81'    # db-sib-03 
backend_port1 = 5432
backend_weight1 = 1
backend_flag1 = 'ALLOW_TO_FAILOVER'

backend_hostname2 = '100.104.174.33'   # db-fsn-01
backend_port2 = 5432
backend_weight2 = 1
backend_flag2 = 'ALLOW_TO_FAILOVER'
```

**Connection Methods**:
1. **Through pgpool-II (Recommended for applications)**:
   - `postgresql://user:pass@localhost:5432/db` - Always connects to local pgpool
   - pgpool automatically routes to the correct database based on query type
   - When primary fails over, pgpool's configuration is automatically updated by Confd watching etcd
   - Applications don't need to know which node is primary

2. **Direct Database Access (For admin/maintenance)**:
   - Can use Tailscale hostnames: `db-sib-01`, `db-sib-03`, `db-fsn-01`
   - These provide direct access bypassing pgpool
   - Useful for maintenance tasks or when you need to connect to a specific node

**Benefits**:
- Single connection string for applications: `postgresql://user:pass@localhost:5432/db`
- Zero application changes needed during failover
- Automatic failover handling - pgpool configuration updates when primary changes
- **Strong local preference** - ~83% of reads stay within datacenter
- **Mature and stable** - pgpool-II has been production-tested for over a decade
- **Rich monitoring** - built-in statistics and prometheus exporter
- Connection pooling reduces database load
- **Native PostgreSQL protocol** - full compatibility with PostgreSQL clients
- **Dynamic weight configuration** - Uses LOCAL_DATACENTER environment variable for proper routing

## Data Flow Examples

### Read Query from App in DC2 (Local is Replica)
```
1. App connects to localhost:5432 (pgpool-II)
2. pgpool parses: "SELECT * FROM users"
3. Weight-based algorithm: local replica has weight=10, remote servers weight=1 each
4. ~83% chance routes to local replica (db-sib-03)
5. Minimal latency for vast majority of reads
```

### Read Query from App in DC1 (Local is Primary)
```
1. App connects to localhost:5432 (pgpool-II)
2. pgpool parses: "SELECT * FROM users"
3. Weight-based algorithm: local primary has weight=10, remote servers weight=1 each
4. ~83% chance routes to local primary (db-sib-01)
5. Optimal performance - no cross-DC latency for most reads
```

### Write Query from App in Any DC
```
1. App connects to localhost:5432 (pgpool-II)
2. pgpool parses: "INSERT INTO users..."
3. Identifies write query via pattern matching
4. Routes to primary (wherever it is)
5. Primary replicates to at least one standby
6. Confirms write to application
```

## Failure Scenarios

### Complete Datacenter Failure (Any DC)

**Impact**:
- **Consul**: Failed DC's services become unavailable locally
- **etcd**: Maintains quorum with 2/3 nodes operational
- **Patroni**: Can still perform all operations via etcd quorum
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
- etcd cluster automatically rebalances when failed node returns

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
2. Initiates election between remaining nodes via etcd consensus
3. Promotes winner to leader (could be in any DC)
4. Updates leader information in etcd
5. Confd detects change in etcd keys
6. Regenerates pgpool backend configuration with new topology
7. pgpool reloads configuration
8. Writes now route to new leader

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
2. **Consul** - Service discovery and KV store
3. **Nomad** - Orchestration layer
4. **etcd + Confd** - Distributed configuration store and dynamic config management
5. **PostgreSQL/Patroni** - Database layer with etcd DCS
6. **pgpool-II** - Application connectivity with dynamic configuration
7. **Applications** - Via Nomad jobs

### Monitoring Checklist
- [ ] Consul WAN federation: `consul members -wan`
- [ ] etcd cluster health: `etcdctl endpoint health --endpoints=<all-nodes>`
- [ ] Patroni cluster: `patronictl list`
- [ ] etcd member list: `etcdctl member list`
- [ ] Replication lag: Check pg_stat_replication
- [ ] pgpool routing: Verify weight-based distribution
- [ ] Nomad jobs: All healthy and placed

### Backup Strategy (To Be Implemented)
1. Continuous WAL archiving to S3-compatible storage
2. Daily base backups via pgBackRest
3. Point-in-time recovery testing
4. Cross-region backup replication

## Configuration Management

### Ansible Playbooks
- `01-provision-and-prepare-lxcs.yml` - Container provisioning and Tailscale setup
- `02-install-consul.yml` - Service discovery
- `03-install-nomad.yml` - Orchestration
- `04-install-etcd.yml` - etcd cluster for Patroni DCS + Confd installation
- `05-install-postgres.yml` - Database with Patroni
- `06-install-pgpool.yml` - Connection pooler with dynamic configuration

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
2. **etcd quorum** - Requires 2/3 nodes operational for writes (reads can continue with single node)
3. **No shared storage** - Each DC has independent storage
4. **Cross-DC latency** - Writes may cross DC boundaries depending on leader location
5. **Quorum requirements** - Need 2/3 DCs operational for etcd, Nomad, and PostgreSQL
6. **Network partitions** - etcd will prioritize consistency over availability during splits
7. **WAN performance** - etcd consensus operations add ~100-200ms latency for cross-DC writes
8. **Database size** - etcd performs best with database size under 2GB (monitored via health checks)

This architecture achieves high availability through geographic distribution and intelligent routing while maintaining operational simplicity. The design philosophy prioritizes clarity and debuggability over complex automation.