#!/bin/bash
set -e

# This script deploys Redis with HA to the infrastructure

echo "=== Deploying Redis HA ==="

# Check for ACL tokens (optional if ACLs are not enabled)
if [ -z "$CONSUL_HTTP_TOKEN" ]; then
    echo "Note: CONSUL_HTTP_TOKEN not set - assuming Consul ACLs are not enabled"
fi

if [ -z "$NOMAD_TOKEN" ]; then
    echo "Note: NOMAD_TOKEN not set - assuming Nomad ACLs are not enabled"
fi

# Set up Consul KV configuration
echo "Setting up Consul KV configuration..."
ansible-playbook -i ../../inventory.yml setup-consul-kv.yml

# Deploy Redis via Nomad
echo "Deploying Redis to Nomad..."
nomad job run redis.nomad

# Wait for Redis to be healthy
echo "Waiting for Redis deployment to complete..."
sleep 10

# Check deployment status
nomad job status redis

echo "=== Redis deployment complete ==="
echo ""
echo "Applications can now connect to Redis via:"
echo "  - Host: localhost"
echo "  - Port: 6380 (via HAProxy)"
echo "  - Connection string: redis://:password@localhost:6380/0"
echo ""
echo "HAProxy stats available at: http://localhost:8404/stats"
echo ""
echo "To test the connection:"
echo "  redis-cli -h localhost -p 6380 -a <password> ping"