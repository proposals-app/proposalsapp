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
        --recreate)
            MODE="recreate"
            SKIP_DESTROY="false"
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --recreate    Destroy existing infrastructure before creating"
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
    ansible-playbook -i inventory.yml playbooks/infrastructure/99-destroy-lxc-containers.yml -e "confirm_destroy=yes-destroy-all" || {
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
    "playbooks/infrastructure/01-provision-and-prepare-lxcs.yml:Provisioning LXC containers and base setup"
    "playbooks/infrastructure/02-install-consul.yml:Installing and configuring Consul"
    "playbooks/infrastructure/03-install-nomad.yml:Installing and configuring Nomad"
    "playbooks/infrastructure/04-install-etcd.yml:Installing etcd for Patroni DCS and Confd"
    "playbooks/infrastructure/05-install-postgres.yml:Installing PostgreSQL with Patroni HA"
    "playbooks/infrastructure/06-install-pgpool.yml:Installing pgpool-II with dynamic configuration via Confd"
    "playbooks/infrastructure/07-install-redis-haproxy.yml:Installing HAProxy for Redis local-first routing"
)

# Setup GitHub runners if PAT is configured
if ansible-vault view group_vars/all/vault.yml --vault-password-file .vault_pass 2>/dev/null | grep -q "vault_github_pat: \"[^\"]\+\""; then
    PLAYBOOKS+=("applications/github-runner/setup-github-runner.yml:Setting up GitHub Actions runners")
    PLAYBOOKS+=("applications/github-runner/setup-docker-registry.yml:Setting up local Docker registry for runners")
    echo -e "${GREEN}GitHub runners will be set up (PAT found in vault)${NC}"
else
    echo -e "${YELLOW}Note: GitHub runners will not be set up (PAT not configured in vault)${NC}"
fi

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

# Optional database verification
if [ $failed -eq 0 ]; then
    echo -e "\n${CYAN}========================================${NC}"
    echo -e "${CYAN}Optional Database Connection Verification${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo -e "${YELLOW}Would you like to run comprehensive database connection verification?${NC}"
    echo ""
    echo "This will verify:"
    echo "  • PostgreSQL cluster health and replication"
    echo "  • etcd cluster consensus and Patroni state"
    echo "  • pgpool-II proxy health and configuration"
    echo "  • Connection strings and query routing"
    echo "  • Read/write distribution and load balancing"
    echo ""
    read -p "Run database verification? (y/N): " run_verification
    
    if [[ "$run_verification" =~ ^[Yy]$ ]]; then
        echo -e "\n${BLUE}Running database connection verification...${NC}"
        if run_playbook "playbooks/infrastructure/07-verify-database-connections.yml" "Database Connection Verification"; then
            echo -e "${GREEN}✓ Database verification completed successfully${NC}"
        else
            echo -e "${YELLOW}⚠ Database verification encountered issues${NC}"
            echo "Check the output above for specific failures"
        fi
    else
        echo -e "${CYAN}Skipping database verification${NC}"
        echo "You can run it later with:"
        echo "ansible-playbook -i inventory.yml playbooks/infrastructure/07-verify-database-connections.yml"
    fi
fi

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
    echo "  • 3 etcd nodes for Patroni distributed configuration"
    echo "  • 3 PostgreSQL nodes with Patroni HA"
    echo "  • pgpool-II connection pooler on application nodes"
    echo "  • Confd for dynamic pgpool-II configuration from etcd"
    echo "  • Local-first load balancing (83% reads to local DB)"
    echo "  • HAProxy for Redis with local-first routing (90% reads to local Redis)"
    echo "  • 3 GitHub Actions self-hosted runners"
    echo ""
    echo -e "${CYAN}Next steps:${NC}"
    echo "1. Verify Consul cluster: consul members"
    echo "2. Verify Nomad cluster: nomad server members"
    echo "3. Check PostgreSQL cluster: patronictl -c /etc/patroni/patroni.yml list"
    echo "4. Test pgpool connection: psql -h localhost -p 5432 -U proposalsapp -d proposalsapp"
    echo "5. Deploy applications: ./deploy-application.sh <app-name>"
    echo ""
    echo -e "${CYAN}Database verification:${NC}"
    echo "• Run comprehensive checks: ansible-playbook -i inventory.yml playbooks/infrastructure/07-verify-database-connections.yml"
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
echo "• Full recreate: $0 --recreate"
echo "• View Consul UI: http://<any-consul-server-ip>:8500"
echo "• View Nomad UI: http://<any-nomad-server-ip>:4646"

echo -e "\n${BLUE}Done!${NC}"
