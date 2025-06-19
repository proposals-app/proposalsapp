# Redis HA Setup for ProposalsApp

This directory contains the configuration for a highly available Redis cache deployment across three datacenters using Redis Sentinel for automatic failover and HAProxy for local-first routing.

## Architecture Overview

### Components

1. **Redis Instances** (3 total, one per datacenter)
   - 1 Master (elected by Sentinel, can be in any DC)
   - 2 Replicas (synchronous replication)
   - Automatic failover in ~5-10 seconds

2. **Redis Sentinel** (3 total, one per datacenter)
   - Monitors Redis health
   - Performs automatic master election
   - Updates etcd with topology changes

3. **HAProxy** (on each app node)
   - Provides local Redis endpoint (localhost:6380)
   - Routes writes to master (wherever it is)
   - Routes reads with local preference (10:1 weight ratio)
   - Dynamic backend discovery via Confd + etcd

4. **Confd** (on each app node)
   - Watches etcd for Redis topology changes
   - Automatically regenerates HAProxy configuration
   - Zero-downtime configuration reloads

### Automatic Service Registration

Redis instances automatically register themselves in etcd on startup:
- Each instance publishes its location, role, and datacenter
- Registration happens via the Redis container's startup script
- Updates are sent every 30 seconds to handle role changes
- Deregistration occurs automatically on shutdown

## Deployment

### Prerequisites

1. Infrastructure must be deployed (Consul, Nomad, etcd)
2. Set environment variables:
   ```bash
   export CONSUL_HTTP_TOKEN=<your-consul-token>
   export NOMAD_TOKEN=<your-nomad-token>
   ```

### Deploy Redis

```bash
# From this directory
./deploy.sh

# Or manually:
ansible-playbook -i ../../inventory.yml setup-consul-kv.yml
nomad job run redis.nomad
```

### Install HAProxy on App Nodes

```bash
# From ansible directory
ansible-playbook -i inventory.yml playbooks/infrastructure/07-install-redis-haproxy.yml
```

## Configuration

### Application Connection

Applications connect to Redis via HAProxy on localhost:
```
redis://:password@localhost:6380/0
```

This connection string:
- Always works regardless of Redis topology
- Automatically handles failovers
- Routes ~90% of reads to local Redis instance
- Routes all writes to current master

### Consul KV Settings

Key | Default | Description
----|---------|------------
`redis/password` | proposalsapp_redis_password | Redis auth password
`redis/maxmemory` | 2gb | Maximum memory per instance
`redis/maxmemory_policy` | allkeys-lru | Eviction policy
`web/redis_url` | redis://... | Connection string for web app

### Environment Variables

The web application uses:
```bash
REDIS_URL=redis://:password@localhost:6380/0
```

## Operations

### Check Status

```bash
# Redis instances
nomad job status redis

# HAProxy backends
curl http://localhost:8404/stats

# Test connection
redis-cli -h localhost -p 6380 -a <password> ping
```

### Manual Failover

```bash
# Connect to Sentinel
redis-cli -h localhost -p 26379

# Trigger failover
SENTINEL FAILOVER proposalsapp-redis
```

### Monitoring

- Redis metrics available via Prometheus exporter
- HAProxy stats at http://localhost:8404/stats
- Consul health checks for all components
- Nomad job status and allocation health

## Local-First Routing

The HAProxy configuration implements intelligent routing:

1. **Write Operations** (SET, DEL, etc.)
   - Always routed to current master
   - Ensures data consistency

2. **Read Operations** (GET, MGET, etc.)
   - Weight-based routing (local: 10, remote: 1)
   - ~90% of reads stay within datacenter
   - Reduces latency and cross-DC traffic

3. **Automatic Failover**
   - Sentinel detects master failure
   - Promotes replica to master
   - Updates etcd with new topology
   - Confd updates HAProxy configuration
   - Applications experience no downtime

## Troubleshooting

### Redis Connection Failures

1. Check HAProxy is running:
   ```bash
   systemctl status haproxy
   ```

2. Check Confd is updating configuration:
   ```bash
   systemctl status confd-redis
   journalctl -u confd-redis -f
   ```

3. Verify etcd has Redis topology:
   ```bash
   etcdctl get /service/redis --prefix
   ```

### Failover Not Working

1. Check Sentinel logs:
   ```bash
   nomad alloc logs <alloc-id> sentinel
   ```

2. Verify Sentinel can see all Redis instances:
   ```bash
   redis-cli -p 26379 SENTINEL MASTERS
   redis-cli -p 26379 SENTINEL REPLICAS proposalsapp-redis
   ```

### Performance Issues

1. Check HAProxy stats for backend distribution
2. Verify local Redis is getting majority of reads
3. Monitor Redis memory usage and eviction rates
4. Check network latency between datacenters

## Security Notes

- Redis password stored in Consul KV (encrypted)
- All Redis instances require authentication
- HAProxy only listens on localhost
- Network traffic between DCs over Tailscale VPN