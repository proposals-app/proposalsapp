# Observability Stack Migration

This document summarizes the changes made to migrate from OpenTelemetry to a simpler stdout logging approach with Grafana stack.

## Changes Made

### 1. Replaced OpenTelemetry with Standard Logging

**Rust Applications (rindexer, discourse, mapper)**:
- Removed all OpenTelemetry dependencies
- Removed Pyroscope profiling
- Switched to simple JSON stdout logging using `tracing-subscriber`
- Log level controlled via `RUST_LOG` environment variable

**Before**:
```rust
let _otel = setup_otel().await?;
```

**After**:
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
            .with_thread_ids(true)
    )
    .init();
```

### 2. Replaced Promtail with Grafana Alloy

**Why**: Promtail is deprecated and will reach EOL in March 2026. Grafana Alloy is the modern replacement that supports OpenTelemetry natively.

**Key Benefits**:
- Built-in UI at port 12345
- Visual pipeline editor
- Native OpenTelemetry support
- More powerful processing capabilities

### 3. Deployed Observability Stack

Created Nomad job definitions for:
- **Loki**: Log aggregation (port 3100)
- **Grafana Alloy**: Log collection (port 12345)
- **Prometheus**: Metrics collection (port 9090)
- **Grafana**: Visualization (port 3000)

### 4. Removed OTEL Environment Variables

Removed from all Nomad jobs and Consul KV:
- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_SERVICE_NAME`
- `NEXT_OTEL_VERBOSE`

### 5. Updated Infrastructure

- Added host volumes for persistent storage in Nomad client config
- Created Ansible playbook for deployment
- Created deployment script for easy setup

## Service Identification

The service name is now derived from the Nomad task name automatically by Alloy:
- `task_name` label is extracted from the log file path
- `service_name` is set to the same value as `task_name`
- No need for environment variables

## Deployment

```bash
cd infrastructure/ansible
./deploy-observability.sh
```

## Accessing Logs

In Grafana, use queries like:
```logql
# All logs from rindexer
{task_name="rindexer"}

# Error logs from discourse
{task_name="discourse"} |= "ERROR"

# Parse JSON and filter by level
{task_name="mapper"} | json | level="error"
```

## Next Steps

1. **Add Prometheus Metrics**: Consider adding `/metrics` endpoints to Rust apps
2. **Create Dashboards**: Build service-specific dashboards in Grafana
3. **Configure Alerts**: Set up alerting rules for critical errors
4. **Add Tracing**: Could add OpenTelemetry traces via Alloy if needed

## Rollback Plan

If needed, the old OTEL setup can be restored by:
1. Reverting the Rust application changes
2. Re-adding OTEL dependencies to Cargo.toml
3. Restoring the `tracing.rs` module
4. Re-adding OTEL environment variables to Nomad jobs