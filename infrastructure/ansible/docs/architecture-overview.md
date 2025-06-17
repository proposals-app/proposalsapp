# ProposalsApp Infrastructure Architecture

## Overview

This is a 3-datacenter setup where each datacenter is literally one physical Proxmox server. Each server contains 3 LXC containers that work together as a complete unit. All communication between datacenters happens over Tailscale VPN.

## Physical Layout

**Three Proxmox servers in different locations:**
- `sib-01` in Sibiu (DC1) - Primary datacenter
- `sib-03` in Sibiu (DC2) - Different building/network
- `fsn-01` in Falkenstein, Germany (DC3) - Geographic redundancy

**Each Proxmox server runs exactly 3 LXC containers:**
1. **consul-nomad-XXX**: Control plane (Consul + Nomad servers)
2. **apps-XXX**: Application layer (Nomad client + PgCat proxy)
3. **db-XXX**: Database layer (PostgreSQL + Patroni)

## How Components Work Together

### Consul (Service Discovery & Health Checking)

**Setup:** Each datacenter has ONE Consul server (`bootstrap_expect = 1`). They form independent clusters per DC but federate via WAN gossip.

**How it works:**
- Each Consul server is the leader of its own datacenter
- WAN federation connects the three datacenters
- Clients (apps and db containers) register services locally
- Service information is shared across DCs via WAN gossip

**Key points:**
- No automatic failover between DCs (each DC is independent)
- If a DC dies, only that DC loses Consul functionality
- Other DCs continue operating normally

### Nomad (Workload Orchestration)

**Setup:** Three servers form ONE cluster across all datacenters (`bootstrap_expect = 3`).

**How it works:**
- Single Raft cluster with servers in different DCs
- All servers are in region "global"
- Can schedule jobs to any datacenter
- Maintains quorum with 2/3 servers

**What happens on failure:**
- If one DC fails, Nomad continues with 2/3 servers
- Jobs on failed DC get rescheduled to surviving DCs
- Automatic workload redistribution

### PostgreSQL + Patroni (Database Layer)

**Setup:** One primary (DC1) and two synchronous standbys (DC2, DC3).

**Configuration details:**
```yaml
synchronous_mode: true
synchronous_mode_strict: true  # Database becomes read-only if no sync replicas
synchronous_node_count: 1      # At least 1 replica must acknowledge writes
```

**How replication works:**
1. Application writes to primary (db-sib-01)
2. Primary waits for at least one standby to acknowledge
3. Only then does it confirm the write to the application
4. If no standbys available, database becomes read-only

**Patroni's role:**
- Manages PostgreSQL lifecycle
- Handles automatic failover
- Registers nodes in Consul with tags (primary/replica)
- Uses Consul for leader election

### PgCat (Connection Proxy)

**Setup:** Runs on each app node, listens on localhost:5432.

**How it routes queries:**
- **SELECT queries** → Local datacenter replica (low latency reads)
- **INSERT/UPDATE/DELETE** → Primary (wherever it is)
- **Transactions with writes** → Entire transaction to primary

**Service discovery flow:**
1. Patroni registers PostgreSQL nodes in Consul as service "proposalsapp"
2. Tags them as "primary" or "replica"
3. Consul Template watches these services
4. Updates PgCat config when topology changes
5. PgCat reloads and routes to new topology

## Network Flow Example

**When an app in DC2 wants to read data:**
```
App (DC2) → PgCat (localhost:5432) → db-sib-03 (local replica)
```

**When the same app needs to write:**
```
App (DC2) → PgCat (localhost:5432) → db-sib-01 (primary in DC1)
```

**All traffic flows over Tailscale IPs (100.x.x.x network).**

## Failure Scenarios Explained

### Scenario 1: Entire DC3 (fsn-01) Dies

**What happens:**
- **Consul**: DC3 has no Consul (but DC1 & DC2 continue fine)
- **Nomad**: Cluster continues with 2/3 servers, reschedules DC3 workloads
- **PostgreSQL**: Primary unaffected, continues with one standby
- **Apps**: DC3 apps are down until Nomad reschedules them

**Why this is OK:** The entire datacenter failed as a unit. No split-brain, no confusion.

### Scenario 2: Network Split (DC3 Isolated)

**What happens:**
- **Consul**: DC3 operates standalone, can't sync with others
- **Nomad**: DC3 server is marked failed after timeout
- **PostgreSQL**: DC3 replica stops receiving updates
- **Apps**: DC3 apps work but with increasingly stale data

### Scenario 3: Primary Database Fails

**What happens:**
1. Patroni (via Consul) detects failure in ~10 seconds
2. Holds election between remaining standbys
3. Promotes one to primary
4. Updates Consul service tags
5. PgCat sees the change and reroutes writes

**Important:** With `synchronous_mode_strict: true`, if you lose BOTH standbys, the primary becomes read-only to prevent data loss.

## Why This Architecture Makes Sense

1. **Simple failure domains**: When a Proxmox server dies, everything on it dies. No partial failures to debug.

2. **Real redundancy**: Three physically separate locations. Not pretending to have HA by running multiple instances on same hardware.

3. **Efficient**: One Consul server per physical server is enough. More would be false redundancy.

4. **Clear mental model**: Each DC is a complete unit with all three layers (control, app, data).

## Critical Configuration Details

### Consul
- `bootstrap_expect = 1` per DC (not 3!)
- Each DC has independent Raft
- WAN federation for cross-DC communication
- No `retry_join` across DCs (only WAN join)

### Nomad
- `bootstrap_expect = 3` (forms single cluster)
- Single region "global"
- Can `retry_join` across DCs (uses Raft, not Consul-style federation)

### PostgreSQL
- Static role assignment in inventory (primary/standby)
- Patroni handles dynamic failover
- Synchronous replication with strict mode
- Uses Consul for service registration

### PgCat
- Installed on app nodes only
- Consul Template updates config dynamically
- Prefers local reads, all writes to primary
- Single connection string for apps

## Operational Notes

- **Tailscale must be up** before anything else starts
- **Consul must be up** before Patroni/Nomad
- **Manual intervention needed** if Consul server dies
- **Automatic failover** for Nomad and PostgreSQL
- **No shared storage** - each DC is independent

This architecture prioritizes **simplicity and clarity** over complex HA setups. It's easy to reason about because each physical server is a complete, independent datacenter.