# PgCat Intelligent Routing Solution

## Overview

This infrastructure uses **PgCat** as an intelligent PostgreSQL proxy that provides:
- **Single connection string**: `postgresql://user:pass@localhost:5432/proposalsapp`
- **Automatic read/write splitting** with zero application changes
- **Local datacenter reads** for optimal performance
- **Automatic failover** through Consul service discovery

## Architecture

```
Application → PgCat → PostgreSQL
     ↓          ↓         ↓
localhost:5432 → Parses → Routes
                Queries   Intelligently
```

### Components

1. **PgCat** (on each app server)
   - Listens on `localhost:5432`
   - Parses SQL queries to determine read vs write
   - Routes reads to local replica, writes to primary
   - Multi-threaded Rust implementation for performance
   - Built-in connection pooling (no PgBouncer needed!)

2. **Consul Template** (on each app server)
   - Watches Consul for PostgreSQL topology changes
   - Updates PgCat configuration dynamically
   - Handles failovers automatically

3. **Patroni + PostgreSQL** (database layer)
   - Manages PostgreSQL replication
   - Handles automatic failover
   - Registers services in Consul

## How It Works

### Query Routing

PgCat automatically detects query types:
- **SELECT queries** → Routed to local datacenter replica
- **INSERT/UPDATE/DELETE** → Routed to primary (any datacenter)
- **Transactions with writes** → Entire transaction goes to primary
- **SELECT FOR UPDATE** → Routed to primary

### Service Discovery

1. Patroni registers PostgreSQL nodes in Consul with tags:
   - `primary` - Current primary node
   - `replica` - Standby nodes
   - Datacenter tags (dc1, dc2, dc3)

2. Consul Template queries these services and generates PgCat config:
   - Primary backend for writes
   - Local replica backend for reads
   - Fallback to other replicas if local unavailable

### Failover Behavior

**Primary Failover:**
1. Patroni detects primary failure (~10 seconds)
2. Promotes replica to new primary
3. Updates Consul service tags
4. Consul Template detects change
5. Updates PgCat configuration
6. PgCat routes writes to new primary

**Replica Failover:**
1. PgCat health checks detect replica failure
2. Routes reads to next available replica
3. Falls back to primary if no replicas available

## Configuration

### PgCat Configuration (`/etc/pgcat/pgcat.toml`)

Generated dynamically by Consul Template:
```toml
[general]
host = "0.0.0.0"
port = 5432
pool_mode = "transaction"
query_parser_enabled = true
query_parser_read_write_splitting = true

[pools.proposalsapp]
database = "proposalsapp"

# Primary shard (for writes)
[[pools.proposalsapp.shards]]
servers = [["10.1.1.10", 5432, "primary"]]
role = "primary"

# Local replica shard (for reads)
[[pools.proposalsapp.shards]]
servers = [["10.1.1.20", 5432, "replica"]]
role = "replica"
```

### Connection String

Applications use a single connection string:
```bash
DATABASE_URL=postgresql://proposalsapp:password@localhost:5432/proposalsapp
```

## Monitoring

### PgCat Metrics
- Prometheus endpoint: `http://localhost:9930/metrics`
- Admin interface: `http://localhost:9931/`
- Health check: `http://localhost:8080/health`

### Useful Commands

```bash
# Check PgCat status
systemctl status pgcat

# View PgCat logs
journalctl -u pgcat -f

# Check Consul Template status
systemctl status consul-template

# View current PgCat configuration
cat /etc/pgcat/pgcat.toml

# Test connection
psql "postgresql://proposalsapp:password@localhost:5432/proposalsapp" -c "SELECT pg_is_in_recovery();"
```

### Monitoring Queries

```sql
-- Check if connected to primary or replica
SELECT pg_is_in_recovery();  -- Returns 'f' for primary, 't' for replica

-- View current connections through PgCat
SELECT * FROM pg_stat_activity WHERE application_name LIKE 'pgcat%';

-- Check replication lag
SELECT pg_wal_lsn_diff(pg_current_wal_lsn(), replay_lsn) AS lag_bytes
FROM pg_stat_replication;
```

## Advantages Over Previous Architecture

| Feature | Old (HAProxy + Retry) | New (PgCat) |
|---------|----------------------|-------------|
| Application complexity | High (retry logic needed) | Zero (transparent) |
| Write latency | High (failed attempt + retry) | Optimal (direct routing) |
| Configuration | Manual HAProxy configs | Dynamic via Consul |
| Query intelligence | None | Full SQL parsing |
| Resource usage | HAProxy + PgBouncer | Just PgCat + PgBouncer |
| Failover speed | Depends on retry | Immediate |

## Troubleshooting

### PgCat Won't Start
1. Check configuration syntax: `pgcat /etc/pgcat/pgcat.toml --check`
2. Verify Consul Template generated valid config
3. Check ports aren't already in use: `ss -tlnp | grep 5432`

### Connections Failing
1. Verify PostgreSQL services in Consul: `consul catalog services`
2. Check Consul health: `consul members`
3. Verify local replica is healthy: `patronictl -c /etc/patroni/patroni.yml list`

### High Latency
1. Check if reads are going to local datacenter
2. Monitor replication lag
3. Verify PgCat is using connection pooling

### Configuration Not Updating
1. Check Consul Template logs: `journalctl -u consul-template`
2. Verify Consul connectivity
3. Check template syntax in `/etc/consul-template/templates/`

## Performance Tuning

### PgCat Settings
- `default_pool_size`: Adjust based on concurrent connections
- `query_parser_read_write_splitting`: Must be enabled
- `primary_reads_enabled`: Keep false for read optimization

### System Settings
```bash
# Increase file descriptors
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# TCP tuning for database connections
sysctl -w net.ipv4.tcp_keepalive_time=600
sysctl -w net.ipv4.tcp_keepalive_intvl=30
sysctl -w net.ipv4.tcp_keepalive_probes=10
```

## Security Considerations

1. **Authentication**: PgCat uses PostgreSQL native authentication
2. **Network**: Binds to localhost only by default
3. **Secrets**: Passwords stored in Consul KV (encrypted)
4. **TLS**: Can be enabled between PgCat and PostgreSQL

## Future Enhancements

1. **Query caching**: PgCat supports query result caching
2. **Sharding**: Can distribute data across multiple primaries
3. **Load balancing**: Weighted distribution across replicas
4. **Prepared statements**: Cached across connections