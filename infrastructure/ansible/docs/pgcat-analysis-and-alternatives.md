# PgCat Configuration Analysis and Alternatives

## Executive Summary

This document captures the comprehensive analysis of the current pgcat configuration for ProposalsApp's multi-datacenter PostgreSQL setup. The analysis revealed that pgcat's query parser features are **experimental and unsuitable for production use**, particularly in multi-instance HA deployments.

## Current Configuration Issues

### 1. Query Parser is Experimental

The pgcat query parser features currently in use are:
- Marked as **EXPERIMENTAL** in official documentation
- **NOT designed for multi-instance HA deployments**
- May incorrectly route queries, causing:
  - Writes being sent to read-only replicas (causing errors)
  - Reads being sent to remote primary (causing latency)

### 2. Critical Limitations

- **Single Instance Requirement**: Parser features require single pgcat instance - incompatible with multi-node setup
- **Parser Reliability**: Cannot reliably detect:
  - CTEs with DML (e.g., `WITH updated AS (UPDATE ...) SELECT ...`)
  - Functions with side-effects (e.g., `SELECT perform_write_operation()`)
  - Complex SQL patterns
- **HA Incompatibility**: Features break when using multiple pgcat instances for high availability

### 3. Current Configuration Risks

```toml
# These settings are problematic:
query_parser_enabled = true              # EXPERIMENTAL feature
query_parser_read_write_splitting = true # Requires single instance
primary_reads_enabled = true             # Forces cross-DC reads after writes
```

- **Latency Issues**: `primary_reads_enabled = true` forces ALL reads after any write in a transaction to go to the primary, even if it's in a remote datacenter
- **Aggressive Reloads**: 5-second config reload interval could cause flapping
- **Connection Handling**: Graceful reloads confirmed, but still has a 15-25 second "gray period" during failover

## Infrastructure Requirements

Based on `infrastructure-architecture.md`, the system requires:

1. **Single connection URL**: Applications use `postgresql://user:pass@localhost:5432/db`
2. **Local-first routing**:
   - Reads → Local DC database FIRST (whether primary or replica)
   - Writes → Primary (wherever it is)
   - Transactions with writes → Entire transaction to primary
3. **Automatic failover**: No application changes during primary failover
4. **Connection pooling**: Reduce database connection overhead
5. **Dynamic configuration**: Updates via Consul Template when topology changes

## Recommended Solutions

### Option 1: Disable Query Parser (Immediate Action)

**Most reliable approach** - Remove experimental features and use explicit routing:

```toml
# Disable experimental features
query_parser_enabled = false
query_parser_read_write_splitting = false

# Create two pools with explicit routing
[pools.rw-pool]  # Port 6432 - For writes and consistent reads
users = ["app_user"]
database = "proposalsapp"
servers = [["{{ primary_host }}", 5432, "primary"]]
pool_mode = "transaction"
default_pool_size = 100

[pools.ro-pool]  # Port 6433 - For read-only queries
users = ["app_user"]
database = "proposalsapp"
servers = [
  ["{{ local_replica }}", 5432, "replica"],     # Local first
  ["{{ remote_replica }}", 5432, "replica"],    # Remote fallback
  ["{{ primary_host }}", 5432, "primary"]       # Last resort
]
pool_mode = "transaction"
default_pool_size = 150
primary_reads_enabled = false  # Never read from primary
```

**Pros:**
- Eliminates all experimental features
- Predictable, deterministic routing
- Works with multi-instance deployments
- Clear failure modes

**Cons:**
- Requires application changes to use different ports
- Developers must choose correct connection pool

### Option 2: Replace with Pgpool-II

**Only mature alternative** that meets all requirements:

```yaml
# Pgpool-II can provide:
- Single connection point (localhost:5432)
- Query parsing for read/write splitting
- Load balancing with backend weights for local-first routing
- Connection pooling
- Automatic failover handling
- Production-proven since 2006
```

**Configuration approach:**
```conf
# Backend configuration with local-first weighting
backend_hostname0 = 'local-db'
backend_port0 = 5432
backend_weight0 = 1000  # Heavy weight for local reads

backend_hostname1 = 'remote-primary'
backend_port1 = 5432
backend_weight1 = 1     # Low weight, only if local unavailable

# Enable query routing
load_balance_mode = on
master_slave_mode = on
master_slave_sub_mode = 'stream'

# Connection pooling
num_init_children = 32
max_pool = 4
```

**Pros:**
- Meets all requirements with single connection URL
- Mature, production-tested solution
- Extensive documentation

**Cons:**
- Higher resource usage than pgcat/pgbouncer
- More complex configuration
- Performance overhead from query parsing

### Option 3: PgBouncer + HAProxy (Different Architecture)

**Industry standard** but requires architectural changes:

```yaml
# HAProxy configuration
listen postgres_write
    bind *:5002
    option pgsqlchk user postgres
    server primary {{ primary_host }}:5432 check

listen postgres_read
    bind *:5003
    balance leastconn
    server local {{ local_db }}:5432 weight 100 check
    server remote {{ remote_db }}:5432 weight 1 check backup
```

**Pros:**
- Battle-tested components
- No experimental features
- Clear separation of concerns

**Cons:**
- **Does NOT meet single URL requirement**
- Requires application changes
- No automatic query routing

## Detailed Comparison Against Requirements

### Your Specific Requirements:
1. **Single connection URL** (`localhost:5432`)
2. **Reads go to local DC first** (whether primary or replica)
3. **Writes always go to primary** (wherever it is)
4. **Automatic query routing** based on query type
5. **Dynamic failover** without changing connection strings

### Analysis of Each Option:

#### ❌ **PgBouncer + HAProxy**
- Cannot parse queries to determine read/write
- Would require multiple ports/connection strings
- Cannot implement local-first read strategy with single URL

#### ❌ **PgBouncer alone**
- No query parsing capability
- Cannot route based on query type
- Single pool goes to one destination only

#### ✅ **Pgpool-II**
- **CAN DO IT!** Has query parsing and routing
- Supports "load_balance_mode" with custom weights
- Can detect read/write queries automatically
- Supports "backend_weight" to prefer local nodes
- Single connection point for applications
- **Configuration example:**
  ```
  backend_hostname0 = 'local-db'
  backend_weight0 = 1000  # Heavy weight for local
  backend_hostname1 = 'remote-primary'
  backend_weight1 = 1  # Low weight
  load_balance_mode = on
  master_slave_mode = on
  ```

#### ❌ **Odyssey**
- Multi-threaded pooler like pgcat
- Primarily a connection pooler
- Limited query routing capabilities
- No local-first routing strategy

#### ❌ **Supavisor**
- Designed for cloud scalability
- No query parsing for read/write split
- No local-first routing
- Higher latency than alternatives

#### ❌ **ProxySQL**
- MySQL-only, not for PostgreSQL

#### ✅ **HAProxy with PostgreSQL protocol support**
- Recent versions can parse PostgreSQL protocol
- Can route based on query type with ACLs
- Complex configuration but possible
- Would require extensive custom configuration

#### ❌ **pgagroal**
- Lightweight pooler
- No query routing features
- Cannot meet single URL requirement

## Failover and Reload Considerations

### Current State
- pgcat supports graceful reloads (no connection drops)
- Config auto-reloads every 5 seconds (too aggressive)
- 15-25 second detection window during failover

### Recommendations
1. Add debouncing to Consul Template:
   ```hcl
   debounce = "5s:30s"  # Wait for stable state
   ```

2. Ensure application retry logic:
   - Exponential backoff
   - Connection retry on failure
   - Transaction retry for serialization errors

## Migration Path

### Phase 1: Stabilize Current Setup (Immediate)
1. Disable query parser features
2. Implement dual-pool configuration
3. Add Consul Template debouncing
4. Document connection requirements for developers

### Phase 2: Evaluate Long-term Solution (1-2 months)
1. Test Pgpool-II in staging environment
2. Benchmark performance impact
3. Plan migration strategy

### Phase 3: Implement Chosen Solution (3-4 months)
1. Deploy new solution alongside pgcat
2. Gradual application migration
3. Monitor and tune
4. Decommission pgcat

## Key Decisions Required

1. **Risk Tolerance**: Can we continue using experimental features in production?
2. **Application Impact**: Is modifying applications for dual-pool acceptable?
3. **Performance Requirements**: Can we accept Pgpool-II's overhead for safety?
4. **Timeline**: How quickly must we migrate away from experimental features?

## Monitoring Requirements

Regardless of solution chosen, monitor:
- `pgcat_client_wait_ms` - Pool saturation indicator
- `pgcat_server_connections_active` - Connection usage
- Query routing accuracy (via PostgreSQL logs)
- Cross-datacenter traffic patterns
- Failover detection time

## Conclusion

The current pgcat configuration uses experimental features unsuitable for production multi-datacenter deployments. The recommended immediate action is to disable the query parser and implement explicit routing via dual pools. Long-term, Pgpool-II is the only mature alternative that can provide single-URL access with intelligent query routing, though it comes with performance trade-offs.

The decision ultimately depends on whether the application can be modified to use explicit connection pools (simpler, more reliable) or requires transparent query routing (more complex, potential overhead).

## References

- [PgCat GitHub Repository](https://github.com/postgresml/pgcat)
- [PgCat Configuration Documentation](https://github.com/postgresml/pgcat/blob/main/CONFIG.md)
- [Pgpool-II Documentation](https://www.pgpool.net/docs/latest/en/html/)
- [ProposalsApp Infrastructure Architecture](./infrastructure-architecture.md)
- Analysis performed: 2025-01-17