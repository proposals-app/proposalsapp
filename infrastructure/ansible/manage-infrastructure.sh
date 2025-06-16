#!/bin/bash
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Default mode
MODE="update"
SKIP_DESTROY="true"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --destroy|--recreate)
            MODE="recreate"
            SKIP_DESTROY="false"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --destroy, --recreate    Destroy existing infrastructure before creating"
            echo "  --help, -h              Show this help message"
            echo ""
            echo "Default behavior (no flags): Update existing infrastructure (idempotent)"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Display mode
echo -e "${CYAN}========================================${NC}"
if [ "$MODE" = "recreate" ]; then
    echo -e "${RED}Infrastructure Recreation Mode${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo -e "${YELLOW}WARNING: This will DESTROY all existing containers and data!${NC}"
    echo -e "${YELLOW}Make sure you have backups of any important data.${NC}"
else
    echo -e "${GREEN}Infrastructure Update Mode${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo -e "${GREEN}This will ensure your infrastructure matches the desired state.${NC}"
    echo -e "${GREEN}Existing containers and data will be preserved.${NC}"
fi
echo ""

# Check prerequisites
echo -e "${BLUE}Checking prerequisites...${NC}"

if [ ! -f "inventory.yml" ]; then
    echo -e "${RED}Error: inventory.yml not found${NC}"
    exit 1
fi

if [ ! -f ".vault_pass" ]; then
    echo -e "${RED}Error: .vault_pass not found${NC}"
    echo "Please ensure your vault password file exists"
    exit 1
fi

if ! command -v ansible-playbook &> /dev/null; then
    echo -e "${RED}Error: ansible-playbook not found${NC}"
    echo "Please install Ansible first"
    exit 1
fi

# Confirmation for destroy mode
if [ "$MODE" = "recreate" ]; then
    echo -e "${RED}This will:${NC}"
    echo "  1. Destroy ALL existing LXC containers"
    echo "  2. Remove all container data"
    echo "  3. Clean up Tailscale devices"
    echo "  4. Recreate everything from scratch"
    echo ""
    read -p "Are you ABSOLUTELY SURE you want to continue? Type 'yes-destroy-all' to confirm: " confirmation
    
    if [ "$confirmation" != "yes-destroy-all" ]; then
        echo -e "${YELLOW}Aborted. No changes were made.${NC}"
        exit 0
    fi
fi

# Function to run playbook with error handling
run_playbook() {
    local playbook=$1
    local description=$2
    
    echo -e "\n${CYAN}========================================${NC}"
    echo -e "${CYAN}${description}${NC}"
    echo -e "${CYAN}========================================${NC}"
    
    if ansible-playbook -i inventory.yml "$playbook"; then
        echo -e "${GREEN}✓ ${description} completed successfully${NC}"
        return 0
    else
        echo -e "${RED}✗ ${description} failed${NC}"
        return 1
    fi
}

# Step 1: Destroy existing infrastructure (only if requested)
if [ "$SKIP_DESTROY" = "false" ]; then
    echo -e "\n${RED}Phase 1: Destroying existing infrastructure${NC}"
    ansible-playbook -i inventory.yml playbooks/99-destroy-lxc-containers.yml -e "confirm_destroy=yes-destroy-all" || {
        echo -e "${YELLOW}Warning: Some containers may not have existed${NC}"
    }
    
    # Wait a bit for cleanup
    echo -e "${YELLOW}Waiting for cleanup to complete...${NC}"
    sleep 10
fi

# Step 2: Create/Update infrastructure
if [ "$MODE" = "recreate" ]; then
    echo -e "\n${GREEN}Phase 2: Recreating infrastructure${NC}"
else
    echo -e "\n${GREEN}Running infrastructure playbooks${NC}"
fi

# Check if we need Tailscale auth key (only for new deployments)
if [ "$MODE" = "recreate" ] && ! grep -q "vault_tailscale_auth_key" group_vars/all/vault.yml 2>/dev/null; then
    echo -e "${YELLOW}Note: You'll need a Tailscale auth key for the containers${NC}"
    echo "Get one from: https://login.tailscale.com/admin/settings/keys"
    echo "Add it to your vault with: ansible-vault edit group_vars/all/vault.yml"
    read -p "Press Enter when ready to continue..."
fi

# Run playbooks in order
PLAYBOOKS=(
    "playbooks/01-provision-and-prepare-lxcs.yml:Provisioning LXC containers and base setup"
    "playbooks/02-install-consul.yml:Installing and configuring Consul"
    "playbooks/03-install-nomad.yml:Installing and configuring Nomad"
    "playbooks/04-install-postgres.yml:Installing PostgreSQL with Patroni HA"
)

failed=0
for playbook_info in "${PLAYBOOKS[@]}"; do
    IFS=':' read -r playbook description <<< "$playbook_info"
    
    if ! run_playbook "$playbook" "$description"; then
        failed=1
        echo -e "${RED}Failed to run $playbook${NC}"
        read -p "Do you want to continue anyway? (y/N): " continue_anyway
        if [[ ! "$continue_anyway" =~ ^[Yy]$ ]]; then
            break
        fi
    fi
    
    # Small delay between playbooks
    sleep 5
done

# Summary
echo -e "\n${BLUE}========================================${NC}"
if [ "$MODE" = "recreate" ]; then
    echo -e "${BLUE}Infrastructure Recreation Summary${NC}"
else
    echo -e "${BLUE}Infrastructure Update Summary${NC}"
fi
echo -e "${BLUE}========================================${NC}"

if [ $failed -eq 0 ]; then
    echo -e "${GREEN}✓ All playbooks completed successfully!${NC}"
    echo ""
    if [ "$MODE" = "recreate" ]; then
        echo -e "${GREEN}Infrastructure has been recreated with:${NC}"
    else
        echo -e "${GREEN}Infrastructure has been updated/verified:${NC}"
    fi
    echo "  • 3 Consul/Nomad servers (one per datacenter)"
    echo "  • 3 Nomad client nodes for applications"
    echo "  • 3 PostgreSQL nodes with Patroni HA"
    echo ""
    echo -e "${CYAN}Next steps:${NC}"
    echo "1. Verify Consul cluster: consul members"
    echo "2. Verify Nomad cluster: nomad server members"
    echo "3. Check PostgreSQL cluster: patronictl -c /etc/patroni/patroni.yml list"
    echo "4. Deploy your applications with Nomad"
else
    echo -e "${RED}✗ Some playbooks failed${NC}"
    echo ""
    echo -e "${YELLOW}Troubleshooting steps:${NC}"
    echo "1. Check container status: ansible proxmox_nodes -i inventory.yml -m shell -a 'pct list'"
    echo "2. Check Tailscale status: ansible lxc_containers -i inventory.yml -m shell -a 'tailscale status'"
    echo "3. Review logs: journalctl -xeu consul.service"
    echo "4. Run individual playbooks to fix issues"
fi

echo ""
echo -e "${CYAN}Useful commands:${NC}"
echo "• Check all hosts: ansible all -i inventory.yml -m ping"
echo "• Update only: $0"
echo "• Full recreate: $0 --destroy"
echo "• View Consul UI: http://<any-consul-server-ip>:8500"
echo "• View Nomad UI: http://<any-nomad-server-ip>:4646"

echo -e "\n${BLUE}Done!${NC}"