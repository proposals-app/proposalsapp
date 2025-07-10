#!/bin/bash
# Script to check GPU status across the infrastructure

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
cd "$SCRIPT_DIR/.."

echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}GPU Infrastructure Status Check${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Check prerequisites
if [ ! -f "inventory.yml" ]; then
    echo -e "${RED}Error: inventory.yml not found${NC}"
    exit 1
fi

if [ ! -f ".vault_pass" ]; then
    echo -e "${RED}Error: .vault_pass not found${NC}"
    exit 1
fi

# Function to check GPU status on hosts
check_host_gpus() {
    echo -e "${BLUE}Checking GPU-enabled Proxmox hosts...${NC}"
    echo ""
    
    ansible gpu_hosts -i inventory.yml -m shell -a '
        echo "=== Host: $(hostname) ==="
        echo "GPUs detected:"
        lspci | grep -i nvidia || echo "No NVIDIA GPUs found"
        echo ""
        echo "NVIDIA driver status:"
        if command -v nvidia-smi &>/dev/null; then
            nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv || echo "nvidia-smi failed"
        else
            echo "NVIDIA driver not installed"
        fi
        echo ""
        echo "GPU device files:"
        ls -la /dev/nvidia* 2>/dev/null | head -5 || echo "No NVIDIA device files"
        echo "==============================="
    ' 2>/dev/null || echo -e "${YELLOW}No GPU hosts found or accessible${NC}"
}

# Function to check GPU status in containers
check_container_gpus() {
    echo -e "\n${BLUE}Checking GPU-enabled containers...${NC}"
    echo ""
    
    # First, check which containers should have GPUs
    GPU_CONTAINERS=$(ansible-inventory -i inventory.yml --list 2>/dev/null | jq -r '.gpu_passthrough_containers[]' 2>/dev/null || echo "")
    
    if [ -z "$GPU_CONTAINERS" ]; then
        echo -e "${YELLOW}No GPU-enabled containers configured${NC}"
        return
    fi
    
    echo "GPU-enabled containers: $GPU_CONTAINERS"
    echo ""
    
    for container in $GPU_CONTAINERS; do
        echo -e "${CYAN}Checking $container...${NC}"
        
        ansible "$container" -i inventory.yml -m shell -a '
            echo "Container: {{ inventory_hostname }}"
            echo "---"
            echo "NVIDIA devices:"
            ls -la /dev/nvidia* 2>/dev/null | head -5 || echo "No NVIDIA devices found"
            echo ""
            echo "nvidia-smi output:"
            if command -v nvidia-smi &>/dev/null; then
                nvidia-smi --query-gpu=name,memory.free,memory.used,utilization.gpu --format=csv,noheader || echo "nvidia-smi failed"
            else
                echo "nvidia-smi not installed"
            fi
            echo ""
            echo "Docker GPU test:"
            if command -v docker &>/dev/null; then
                docker run --rm --gpus all nvidia/cuda:12.0-base nvidia-smi &>/dev/null && echo "Docker GPU: Working" || echo "Docker GPU: Failed"
            else
                echo "Docker not installed"
            fi
            echo "==============================="
        ' 2>&1 || echo -e "${RED}Failed to check $container${NC}"
        
        echo ""
    done
}

# Function to check GPU health in Consul
check_consul_gpu_health() {
    echo -e "\n${BLUE}Checking GPU health status in Consul...${NC}"
    echo ""
    
    # Try to get GPU health from any Consul server
    CONSUL_SERVER=$(ansible consul_servers -i inventory.yml --list-hosts 2>/dev/null | grep -v "hosts" | head -1 | tr -d ' ')
    
    if [ -n "$CONSUL_SERVER" ]; then
        ansible "$CONSUL_SERVER" -i inventory.yml -m shell -a '
            echo "GPU Health Status in Consul KV:"
            consul kv get -recurse health/gpu/ 2>/dev/null | grep -E "(status|last_check)" || echo "No GPU health data found"
        ' 2>&1 || echo -e "${YELLOW}Could not retrieve Consul health data${NC}"
    else
        echo -e "${YELLOW}No Consul servers accessible${NC}"
    fi
}

# Function to show GPU utilization
show_gpu_utilization() {
    echo -e "\n${BLUE}Current GPU Utilization...${NC}"
    echo ""
    
    GPU_CONTAINERS=$(ansible-inventory -i inventory.yml --list 2>/dev/null | jq -r '.gpu_passthrough_containers[]' 2>/dev/null || echo "")
    
    for container in $GPU_CONTAINERS; do
        echo -e "${CYAN}$container GPU utilization:${NC}"
        
        ansible "$container" -i inventory.yml -m shell -a '
            nvidia-smi --query-gpu=index,name,utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu --format=csv 2>/dev/null || echo "Unable to query GPU utilization"
        ' 2>&1 || echo -e "${RED}Failed to check $container${NC}"
        
        echo ""
    done
}

# Main execution
echo -e "${GREEN}1. Checking Proxmox hosts with GPUs...${NC}"
check_host_gpus

echo -e "\n${GREEN}2. Checking containers with GPU access...${NC}"
check_container_gpus

echo -e "\n${GREEN}3. Checking GPU health monitoring...${NC}"
check_consul_gpu_health

echo -e "\n${GREEN}4. Checking current GPU utilization...${NC}"
show_gpu_utilization

echo -e "\n${CYAN}========================================${NC}"
echo -e "${CYAN}GPU Status Check Complete${NC}"
echo -e "${CYAN}========================================${NC}"

echo -e "\n${YELLOW}Troubleshooting tips:${NC}"
echo "• If GPUs not detected on host: Check BIOS settings and hardware installation"
echo "• If nvidia-smi not working on host: Run playbook 00-prepare-gpu-hosts.yml"
echo "• If devices missing in container: Check LXC config and restart container"
echo "• If nvidia-smi fails in container: Run playbook 01a-install-nvidia-container.yml"
echo "• For detailed logs: journalctl -u gpu-health-check -f"

# Create inventory group for GPU hosts if needed
echo -e "\n${YELLOW}Note:${NC} To use this script, ensure you have a 'gpu_hosts' group in inventory.yml:"
echo "gpu_hosts:"
echo "  hosts:"
echo "    sib-03: null"