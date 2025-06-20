# Observability Stack

This directory contains the deployment configuration for the ProposalsApp observability stack using Loki, Grafana Alloy, Prometheus, and Grafana.

## Architecture

```
Applications → stdout/stderr → Nomad → Alloy → Loki → Grafana
                                   ↓
                              Prometheus ← Alloy
                                   ↓
                               Grafana
```

## Components

### Loki
- **Purpose**: Log aggregation and storage
- **Port**: 3100
- **Features**: 
  - 30-day retention
  - TSDB storage format
  - Filesystem-based storage on host volumes

### Grafana Alloy
- **Purpose**: Log and metrics collection from Nomad allocations
- **Type**: System job (runs on every node)
- **Port**: 12345 (UI)
- **Features**:
  - Collects logs from `/opt/nomad/alloc/*/alloc/logs/`
  - Parses JSON logs automatically
  - Adds metadata labels (task_name, alloc_id, datacenter, node)
  - Uses task_name as service_name for service identification
  - Built-in UI for monitoring collection status
  - Native OpenTelemetry support
  - Can collect metrics from applications

### Prometheus
- **Purpose**: Metrics collection and storage
- **Port**: 9090
- **Features**:
  - 15-day retention
  - Service discovery via Consul
  - Collects metrics from applications with /metrics endpoints
  - Basic alerting rules included

### Grafana
- **Purpose**: Visualization and dashboards
- **Port**: 3000
- **Features**:
  - Pre-configured data sources (Loki, Prometheus)
  - Basic ProposalsApp dashboard included
  - Authentication enabled

## Deployment

### Prerequisites

1. Ensure host volumes are created on all app nodes:
```bash
ansible-playbook -i inventory.yml applications/observability/setup-consul-kv.yml
```

2. Ensure Nomad client configuration includes the host volumes (already done in the template).

### Deploy the Stack

Use the deployment script:
```bash
cd infrastructure/ansible
./deploy-observability.sh
```

Or deploy manually:
```bash
# 1. Setup Consul KV and host volumes
ansible-playbook -i inventory.yml applications/observability/setup-consul-kv.yml

# 2. Deploy components in order
nomad job run applications/observability/loki.nomad
nomad job run applications/observability/alloy.nomad
nomad job run applications/observability/prometheus.nomad
nomad job run applications/observability/grafana.nomad
```

## Application Configuration

### Rust Applications

The Rust applications (rindexer, discourse, mapper) have been updated to use simple stdout JSON logging:

```rust
// Initialize JSON logging for stdout
let env_filter = EnvFilter::try_from_default_env()
    .unwrap_or_else(|_| EnvFilter::new("info"));

tracing_subscriber::registry()
    .with(env_filter)
    .with(
        fmt::layer()
            .json()
            .with_target(true)
            .with_file(true)
            .with_line_number(true)
    )
    .init();
```

### Log Levels

Control log levels via the `RUST_LOG` environment variable:
- `RUST_LOG=info` (default)
- `RUST_LOG=debug`
- `RUST_LOG=trace`
- `RUST_LOG=warn`
- `RUST_LOG=error`

## Accessing the Stack

### Grafana
- URL: Configure in Traefik/Cloudflare to point to `http://grafana.service.consul:3000`
- Default credentials: admin/admin (or check Consul KV)

### Alloy
- URL: `http://<any-node>:12345`
- Features:
  - `/graph` - Visual pipeline editor
  - `/-/ready` - Health check
  - View live log collection status

### Prometheus
- URL: `http://<any-node>:9090`
- Useful endpoints:
  - `/targets` - View all scraped targets
  - `/config` - View current configuration
  - `/alerts` - View active alerts

### Loki
- URL: `http://<any-node>:3100`
- Useful endpoints:
  - `/ready` - Health check
  - `/metrics` - Loki's own metrics

## Querying Logs

### In Grafana

1. Go to Explore
2. Select Loki data source
3. Example queries:

```logql
# All logs from a specific service
{task_name="rindexer"}

# Error logs only
{task_name="discourse"} |= "ERROR"

# JSON parsing
{task_name="mapper"} | json | level="error"

# Rate of errors
rate({task_name=~"rindexer|discourse|mapper"} |= "ERROR" [5m])
```

### Labels Available

- `job`: Always "nomad-alloc-logs"
- `task_name`: The Nomad task name (e.g., "rindexer", "discourse")
- `service_name`: Same as task_name
- `alloc_id`: Nomad allocation ID
- `stream`: "stdout" or "stderr"
- `datacenter`: The datacenter (dc1, dc2, dc3)
- `node`: The Nomad client node name
- `level`: Log level (when JSON parsed)

## Monitoring

### Key Metrics to Watch

1. **Loki**:
   - `loki_ingester_streams_created_total` - Rate of new log streams
   - `loki_ingester_chunks_stored_total` - Storage growth

2. **Alloy**:
   - `loki_source_file_read_bytes_total` - Bytes read from log files
   - `loki_process_dropped_entries_total` - Dropped logs (should be 0)
   - `alloy_build_info` - Alloy version and build info

3. **Application Metrics**:
   - Once applications add `/metrics` endpoints, they'll be auto-discovered

## Troubleshooting

### Logs Not Appearing

1. Check Alloy is running on all nodes:
   ```bash
   nomad job status alloy
   ```

2. Check Alloy status via UI:
   ```bash
   # Open in browser
   http://<alloy-node>:12345/graph
   ```

3. Check Alloy can reach Loki:
   ```bash
   curl http://<alloy-node>:12345/metrics | grep loki_write_sent
   ```

3. Check log file permissions:
   ```bash
   ls -la /opt/nomad/alloc/*/alloc/logs/
   ```

### High Memory Usage

1. Check Loki retention settings
2. Reduce `ingestion_rate_mb` if needed
3. Check for cardinality issues (too many unique label combinations)

### Grafana Can't Connect

1. Verify services are registered in Consul:
   ```bash
   consul catalog services
   ```

2. Check network connectivity between services