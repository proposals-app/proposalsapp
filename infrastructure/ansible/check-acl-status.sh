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

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}ACL Status Check${NC}"
echo -e "${CYAN}========================================${NC}"

# Function to check service ACL status
check_acl_status() {
    local service=$1
    local host=$2
    local port=$3
    
    echo -e "\n${BLUE}Checking ${service} ACLs on ${host}...${NC}"
    
    # Check if bootstrap token exists
    if ansible "$host" -i inventory.yml -m stat -a "path=/root/${service}-bootstrap.json" --become | grep -q "exists.*true"; then
        echo -e "  ${GREEN}✓ Bootstrap token exists${NC}"
        
        # Extract token and check ACL status
        if [ "$service" = "consul" ]; then
            # Check Consul ACL status
            token=$(ansible "$host" -i inventory.yml -m shell -a "cat /root/consul-bootstrap.json | python3 -c \"import sys, json; print(json.load(sys.stdin)['SecretID'])\"" --become -o | grep -oP '(?<=stdout": ")[^"]+' | head -1)
            
            if [ -n "$token" ]; then
                # Check ACL system status
                acl_status=$(ansible "$host" -i inventory.yml -m uri -a "url=http://localhost:${port}/v1/acl/list headers={'X-Consul-Token':'${token}'}" --become | grep -c "status.*200" || true)
                if [ "$acl_status" -gt 0 ]; then
                    echo -e "  ${GREEN}✓ ACL system is active and accessible${NC}"
                else
                    echo -e "  ${RED}✗ ACL system not responding properly${NC}"
                fi
            fi
        elif [ "$service" = "nomad" ]; then
            # Check Nomad ACL status
            token=$(ansible "$host" -i inventory.yml -m shell -a "cat /root/nomad-bootstrap.json | python3 -c \"import sys, json; print(json.load(sys.stdin)['SecretID'])\"" --become -o | grep -oP '(?<=stdout": ")[^"]+' | head -1)
            
            if [ -n "$token" ]; then
                # Check ACL system status
                acl_status=$(ansible "$host" -i inventory.yml -m uri -a "url=http://localhost:${port}/v1/acl/tokens headers={'X-Nomad-Token':'${token}'}" --become | grep -c "status.*200" || true)
                if [ "$acl_status" -gt 0 ]; then
                    echo -e "  ${GREEN}✓ ACL system is active and accessible${NC}"
                else
                    echo -e "  ${RED}✗ ACL system not responding properly${NC}"
                fi
            fi
        fi
    else
        echo -e "  ${YELLOW}⚠ No bootstrap token found${NC}"
    fi
}

# Check Consul ACLs
echo -e "\n${CYAN}=== Consul ACL Status ===${NC}"
for host in $(ansible consul_servers -i inventory.yml --list-hosts | grep -v "hosts" | sed 's/^[[:space:]]*//'); do
    check_acl_status "consul" "$host" "8500"
done

# Check Nomad ACLs
echo -e "\n${CYAN}=== Nomad ACL Status ===${NC}"
for host in $(ansible nomad_servers -i inventory.yml --list-hosts | grep -v "hosts" | sed 's/^[[:space:]]*//'); do
    check_acl_status "nomad" "$host" "4646"
done

# Check token distribution
echo -e "\n${CYAN}=== Token Distribution Status ===${NC}"

# Count nodes with Consul tokens
consul_token_count=$(ansible all -i inventory.yml -m stat -a "path=/etc/consul.d/agent-token.json" --become -o | grep -c "exists.*true" || true)
total_nodes=$(ansible all -i inventory.yml --list-hosts | grep -v "hosts" | wc -l)

echo -e "Consul agent tokens: ${consul_token_count}/${total_nodes} nodes"

# Count Nomad server tokens
nomad_token_count=$(ansible nomad_servers -i inventory.yml -m stat -a "path=/etc/nomad.d/agent-token.json" --become -o | grep -c "exists.*true" || true)
nomad_server_count=$(ansible nomad_servers -i inventory.yml --list-hosts | grep -v "hosts" | wc -l)

echo -e "Nomad agent tokens: ${nomad_token_count}/${nomad_server_count} servers"

echo -e "\n${CYAN}========================================${NC}"
echo -e "${CYAN}Summary${NC}"
echo -e "${CYAN}========================================${NC}"

if [ "$consul_token_count" -eq "$total_nodes" ] && [ "$nomad_token_count" -eq "$nomad_server_count" ]; then
    echo -e "${GREEN}✓ All ACL tokens have been distributed successfully${NC}"
else
    echo -e "${YELLOW}⚠ Some tokens may be missing. Run the token distribution playbook:${NC}"
    echo -e "  ansible-playbook -i inventory.yml playbooks/02b-distribute-tokens.yml"
fi

echo -e "\n${BLUE}To access services with ACLs:${NC}"
echo -e "  Consul: export CONSUL_HTTP_TOKEN=\$(ansible consul_servers[0] -i inventory.yml -m shell -a \"cat /root/consul-bootstrap.json | jq -r .SecretID\" --become -o | grep -oP '(?<=stdout\": \")[^\"]+' | head -1)"
echo -e "  Nomad:  export NOMAD_TOKEN=\$(ansible nomad_servers[0] -i inventory.yml -m shell -a \"cat /root/nomad-bootstrap.json | jq -r .SecretID\" --become -o | grep -oP '(?<=stdout\": \")[^\"]+' | head -1)"

echo -e "\n${BLUE}Done!${NC}"