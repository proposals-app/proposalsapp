#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR/../.."

echo "=========================================="
echo "Deploying Cloudflared Zero Trust Tunnel"
echo "=========================================="

# Check if we have the vault password file
if [ ! -f ".vault_pass" ]; then
    echo "Error: .vault_pass file not found!"
    echo "Please create it with your Ansible vault password."
    exit 1
fi

# Setup Consul KV values
echo "Setting up Consul KV values..."
ansible-playbook -i inventory.yml applications/cloudflared/setup-consul-kv.yml --vault-password-file .vault_pass

# Deploy the Nomad job
echo ""
echo "Deploying Cloudflared to Nomad..."
./deploy-application.sh cloudflared deploy

echo ""
echo "=========================================="
echo "Deployment complete!"
echo "=========================================="
echo ""
echo "Check the status with:"
echo "  nomad job status cloudflared"
echo ""
echo "View logs with:"
echo "  nomad alloc logs <alloc-id>"
echo ""
echo "The tunnel will connect to Cloudflare and enable Zero Trust access."