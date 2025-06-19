#!/bin/bash
# Quick database verification script

cd "$(dirname "$0")"

echo "Running database connection verification..."
echo ""
ansible-playbook -i inventory.yml playbooks/infrastructure/07-verify-database-connections.yml "$@"