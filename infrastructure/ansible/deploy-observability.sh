#!/bin/bash
set -e

echo "========================================"
echo "Deploying Observability Stack (Clean)"
echo "========================================"

# Check if we have the required tools
command -v ansible-playbook >/dev/null 2>&1 || { echo "ansible-playbook is required but not installed. Aborting." >&2; exit 1; }
command -v nomad >/dev/null 2>&1 || { echo "nomad CLI is required but not installed. Aborting." >&2; exit 1; }

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Function to get the first available Nomad server
get_nomad_server() {
    # Try to get Nomad server IPs from inventory
    local servers=(
        "100.125.71.27"  # consul-nomad-sib-01
        "100.92.177.11"  # consul-nomad-sib-03
        "100.69.93.109"  # consul-nomad-fsn-01
    )

    for server in "${servers[@]}"; do
        if curl -s -f "http://${server}:4646/v1/status/leader" >/dev/null 2>&1; then
            echo "http://${server}:4646"
            return 0
        fi
    done

    echo "Error: Could not find any accessible Nomad server" >&2
    echo "Please set NOMAD_ADDR environment variable manually" >&2
    return 1
}

# Set NOMAD_ADDR if not already set
if [ -z "$NOMAD_ADDR" ]; then
    echo "Detecting Nomad server..."
    NOMAD_ADDR=$(get_nomad_server)
    if [ $? -ne 0 ]; then
        exit 1
    fi
    echo "Using Nomad server: $NOMAD_ADDR"
    export NOMAD_ADDR
fi

# Function to stop and purge a job
stop_and_purge_job() {
    local job_name=$1
    echo "Checking if job '${job_name}' exists..."

    if nomad job status "${job_name}" >/dev/null 2>&1; then
        echo "Stopping job '${job_name}'..."
        nomad job stop -purge "${job_name}" || true

        # Wait for job to be fully stopped
        echo "Waiting for '${job_name}' to be fully stopped..."
        local attempts=0
        while [ $attempts -lt 30 ]; do
            if ! nomad job status "${job_name}" >/dev/null 2>&1; then
                echo "Job '${job_name}' has been stopped and purged."
                break
            fi
            sleep 2
            attempts=$((attempts + 1))
        done

        if [ $attempts -eq 30 ]; then
            echo "Warning: Job '${job_name}' may not have been fully stopped."
        fi
    else
        echo "Job '${job_name}' does not exist, skipping..."
    fi
}

# Function to wait for job to be healthy
wait_for_job_healthy() {
    local job_name=$1
    local max_wait=${2:-120}  # Default 2 minutes

    echo "Waiting for job '${job_name}' to be healthy..."
    local attempts=0
    while [ $attempts -lt $max_wait ]; do
        # Simply check if job has running allocations
        local running_count=$(nomad job status "${job_name}" 2>/dev/null | \
            grep -A 20 "Allocations" | \
            grep -c "running" || echo "0")
        
        if [ "$running_count" -gt "0" ]; then
            # Additional check - ensure the allocation is actually healthy
            local healthy=$(nomad job status "${job_name}" 2>/dev/null | \
                grep -A 20 "Allocations" | \
                grep "running" | \
                head -n 1)
            
            if [ -n "$healthy" ]; then
                echo "Job '${job_name}' is healthy!"
                return 0
            fi
        fi
        
        sleep 5
        attempts=$((attempts + 5))
        echo -n "."
    done

    echo ""
    echo "Warning: Job '${job_name}' did not become healthy within ${max_wait} seconds"
    return 1
}

echo ""
echo "========================================"
echo "Step 1: Removing existing observability stack"
echo "========================================"

# Stop all observability jobs in reverse order
stop_and_purge_job "grafana"
stop_and_purge_job "prometheus"
stop_and_purge_job "alloy"
stop_and_purge_job "loki"

echo ""
echo "========================================"
echo "Step 2: Setting up Consul KV values"
echo "========================================"

# Check if setup-consul-kv.yml exists
if [ -f "$SCRIPT_DIR/applications/observability/setup-consul-kv.yml" ]; then
    ansible-playbook -i "$SCRIPT_DIR/inventory.yml" "$SCRIPT_DIR/applications/observability/setup-consul-kv.yml" --vault-password-file "$SCRIPT_DIR/.vault_pass" || {
        echo "Warning: Could not set up Consul KV values. Continuing anyway..."
    }
else
    echo "No Consul KV setup file found, skipping..."
fi

echo ""
echo "========================================"
echo "Step 3: Deploying fresh observability stack"
echo "========================================"

# Deploy Loki
echo ""
echo "Deploying Loki (log aggregation)..."
if ! nomad job run "$SCRIPT_DIR/applications/observability/loki.nomad"; then
    echo "Error: Failed to deploy Loki"
    exit 1
fi
wait_for_job_healthy "loki" 120

# Give Loki time to fully initialize
echo "Waiting for Loki to fully initialize..."
sleep 15

# Deploy Alloy (on all nodes)
echo ""
echo "Deploying Alloy (log & metrics collection)..."
echo "Note: Alloy configuration has been simplified for better JSON log parsing"
if ! nomad job run "$SCRIPT_DIR/applications/observability/alloy.nomad"; then
    echo "Error: Failed to deploy Alloy"
    exit 1
fi
# Alloy is a system job, so we just wait a bit for it to start on all nodes
echo "Waiting for Alloy to start on all nodes..."
sleep 20

# Deploy Prometheus
echo ""
echo "Deploying Prometheus (metrics collection)..."
if ! nomad job run "$SCRIPT_DIR/applications/observability/prometheus.nomad"; then
    echo "Error: Failed to deploy Prometheus"
    exit 1
fi
wait_for_job_healthy "prometheus" 120

# Deploy Grafana
echo ""
echo "Deploying Grafana (visualization)..."
echo "Note: Grafana includes a new 'ProposalsApp Logs Overview' dashboard"
if ! nomad job run "$SCRIPT_DIR/applications/observability/grafana.nomad"; then
    echo "Error: Failed to deploy Grafana"
    exit 1
fi
wait_for_job_healthy "grafana" 180  # Grafana takes longer due to plugin installation

echo ""
echo "========================================"
echo "Observability Stack Deployment Complete!"
echo "========================================"
echo ""
echo "Final deployment status:"
echo ""

# Function to get job allocations with IP addresses
show_job_status() {
    local job_name=$1
    echo "=== ${job_name} ==="

    if nomad job status "${job_name}" >/dev/null 2>&1; then
        # Get allocation details
        nomad job status "${job_name}" | grep -A 5 "Allocations" | tail -n +2 | head -n 5

        # Get the running allocation IP
        local alloc_id=$(nomad job status "${job_name}" | grep -A 5 "Allocations" | grep "running" | awk '{print $1}' | head -n 1)
        if [ -n "$alloc_id" ]; then
            local node_id=$(nomad alloc status "$alloc_id" | grep "Node ID" | awk '{print $4}')
            local ip=$(nomad node status "$node_id" | grep -E "dc[0-9]" | awk '{print $2}')
            echo "Access: http://${ip}:$(get_job_port ${job_name})"
        fi
    else
        echo "Not deployed"
    fi
    echo ""
}

# Function to get port for each service
get_job_port() {
    case $1 in
        grafana) echo "3000" ;;
        prometheus) echo "9090" ;;
        loki) echo "3100" ;;
        alloy) echo "12345" ;;
        *) echo "unknown" ;;
    esac
}

show_job_status "loki"
show_job_status "alloy"
show_job_status "prometheus"
show_job_status "grafana"

echo "========================================"
echo "Access Points:"
echo "========================================"

# Get actual IPs for services
GRAFANA_IP=$(nomad job status grafana 2>/dev/null | grep -A 5 "Allocations" | grep "running" | awk '{print $2}' | head -n 1)
PROMETHEUS_IP=$(nomad job status prometheus 2>/dev/null | grep -A 5 "Allocations" | grep "running" | awk '{print $2}' | head -n 1)
LOKI_IP=$(nomad job status loki 2>/dev/null | grep -A 5 "Allocations" | grep "running" | awk '{print $2}' | head -n 1)

# Map node IDs to IPs
if [ -n "$GRAFANA_IP" ]; then
    GRAFANA_IP=$(nomad node status "$GRAFANA_IP" 2>/dev/null | grep -E "dc[0-9]" | awk '{print $2}')
fi
if [ -n "$PROMETHEUS_IP" ]; then
    PROMETHEUS_IP=$(nomad node status "$PROMETHEUS_IP" 2>/dev/null | grep -E "dc[0-9]" | awk '{print $2}')
fi
if [ -n "$LOKI_IP" ]; then
    LOKI_IP=$(nomad node status "$LOKI_IP" 2>/dev/null | grep -E "dc[0-9]" | awk '{print $2}')
fi

echo "- Grafana: http://${GRAFANA_IP:-<not-deployed>}:3000"
echo "- Prometheus: http://${PROMETHEUS_IP:-<not-deployed>}:9090"
echo "- Loki: http://${LOKI_IP:-<not-deployed>}:3100"
echo "- Alloy: http://<any-node>:12345 (running on all nodes)"
echo ""
echo "Default Grafana credentials:"
echo "- Username: admin"
echo "- Password: admin"
echo ""
echo "Key improvements in this deployment:"
echo "- Simplified Alloy log processing pipeline"
echo "- Better JSON log parsing for Rust services"
echo "- Normalized log level labels (error, warn, info, debug, trace)"
echo "- Improved Grafana dashboard with better visualizations"
echo "- Optimized Loki configuration for performance"
echo ""
echo "Logs are being collected from all Nomad allocations automatically."
echo "Services detected: rindexer, discourse, mapper, web, email-service"
echo ""
echo "To see the actual access URLs, run:"
echo "  ./show-observability-urls.sh"
echo ""
echo "To view logs in Grafana:"
echo "1. Open Grafana at the URL above"
echo "2. Navigate to 'Dashboards' → 'ProposalsApp Logs Overview'"
echo "3. Use the service and level filters to explore logs"
echo "========================================"
