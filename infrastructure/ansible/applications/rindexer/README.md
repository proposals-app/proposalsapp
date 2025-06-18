# Rindexer Deployment

Rindexer is the blockchain indexer service that monitors governance contracts across multiple chains.

## Prerequisites

Environment variables must be set in Consul KV (handled by setup)

## Deployment

```bash
# Complete deployment: setup and deploy
./deploy-application.sh rindexer

# Or individual steps:
./deploy-application.sh rindexer setup    # Configure Consul KV
./deploy-application.sh rindexer deploy   # Deploy to Nomad
```

## Configuration

The service reads configuration from Consul KV:
- Database connection: `pgcat/connection_string/local`
- RPC endpoints: `rindexer/<chain>_node_url`
- API keys: `rindexer/<service>_api_key`

These are managed by Ansible Vault and deployed during setup.

## Monitoring

- Metrics endpoint: `http://rindexer-metrics.service.consul:9090/metrics`
- Logs: Available via Nomad UI or `nomad alloc logs`

## Architecture

- Single instance deployment (count=1)
- Indexes all chains from one central location
- Prefers dc1 but can run in any datacenter
- Auto-restarts on failure with exponential backoff
- 4GB RAM with burst to 6GB during peak loads