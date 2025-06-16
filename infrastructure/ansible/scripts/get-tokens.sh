#!/bin/bash

# Script to retrieve Consul and Nomad management tokens from the infrastructure

echo "========================================="
echo "Retrieving Management Tokens"
echo "========================================="

# Get inventory file
INVENTORY="${1:-inventory.yml}"

# Find primary Consul server (dc1)
PRIMARY_SERVER=$(ansible-inventory -i "$INVENTORY" --list | jq -r '.consul_servers.hosts[] as $host | .["_meta"]["hostvars"][$host] | select(.datacenter == "dc1") | $host' | head -1)

if [ -z "$PRIMARY_SERVER" ]; then
    echo "Error: Could not find primary Consul server (dc1)"
    exit 1
fi

echo "Primary server: $PRIMARY_SERVER"
echo

# Get Consul token
echo "Consul Management Token:"
CONSUL_TOKEN=$(ansible "$PRIMARY_SERVER" -i "$INVENTORY" -m shell -a "cat /root/consul-bootstrap.json 2>/dev/null | jq -r .SecretID" 2>/dev/null | tail -1)
if [ -n "$CONSUL_TOKEN" ] && [ "$CONSUL_TOKEN" != "null" ]; then
    echo "  Token: $CONSUL_TOKEN"
    echo "  Export: export CONSUL_HTTP_TOKEN=$CONSUL_TOKEN"
else
    echo "  Not found - ACLs may not be bootstrapped yet"
fi
echo

# Get Nomad token
echo "Nomad Management Token:"
NOMAD_TOKEN=$(ansible "$PRIMARY_SERVER" -i "$INVENTORY" -m shell -a "cat /root/nomad-bootstrap.json 2>/dev/null | jq -r .SecretID" 2>/dev/null | tail -1)
if [ -n "$NOMAD_TOKEN" ] && [ "$NOMAD_TOKEN" != "null" ]; then
    echo "  Token: $NOMAD_TOKEN"
    echo "  Export: export NOMAD_TOKEN=$NOMAD_TOKEN"
else
    echo "  Not found - ACLs may not be bootstrapped yet"
fi
echo

echo "========================================="
echo "Usage:"
echo "  - Set environment variables using the export commands above"
echo "  - Or use tokens directly with -token flag"
echo "  - Consul UI: http://<consul-server>:8500/ui"
echo "  - Nomad UI: http://<nomad-server>:4646/ui"
echo "========================================="