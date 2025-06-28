#!/bin/bash
# Deploy pgbackweb backup solution on standalone LXC container

set -e

echo "=== Deploying pgbackweb standalone solution ==="
echo ""

# Check if running from correct directory
if [ ! -f "ansible.cfg" ]; then
    echo "Error: Must run from infrastructure/ansible directory"
    exit 1
fi

# Ensure vault password file exists
if [ ! -f ".vault_pass" ]; then
    echo "Error: .vault_pass file not found"
    exit 1
fi

# Step 1: Run the pgbackweb installation playbook
echo "Installing pgbackweb on dedicated container..."
ansible-playbook -i inventory.yml playbooks/infrastructure/07-install-pgbackweb.yml --vault-password-file .vault_pass

# Step 2: Check service status
echo ""
echo "Checking pgbackweb status..."
ansible pgbackweb-sib-01 -i inventory.yml -m shell -a "docker ps | grep pgbackweb" --vault-password-file .vault_pass || true

# Display access information
echo ""
echo "=== Deployment Complete ==="
echo ""
echo "pgbackweb has been deployed successfully!"
echo ""
echo "Access the UI at: http://pgbackweb-sib-01:8085"
echo "Or via Tailscale: http://100.92.170.6:8085"
echo ""
echo "Manual Configuration Required:"
echo "1. Create an account at http://pgbackweb-sib-01:8085"
echo "2. Add database connections as needed"
echo "3. Configure backup destinations as needed"
echo "4. Set up backup schedules as needed"
echo ""
echo "To view container logs:"
echo "ssh pgbackweb-sib-01 'docker logs -f pgbackweb'"