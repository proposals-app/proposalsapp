#!/bin/bash
# Quick database verification on hosts with PostgreSQL client

cd "$(dirname "$0")"

echo "Running database verification on application and database nodes..."
echo "(These hosts have PostgreSQL client installed)"
echo ""

# Run only on nodes that have PostgreSQL client
ansible-playbook -i inventory.yml playbooks/infrastructure/07-verify-database-connections.yml \
  --limit "nomad_clients:postgres_nodes" "$@"