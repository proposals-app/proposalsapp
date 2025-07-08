#!/bin/bash
# Don't exit on error - we'll handle errors gracefully
set +e

echo "========================================"
echo "Deploying Observability Stack (Clean)"
echo "========================================"

# Check if we have the required tools
if ! command -v ansible-playbook >/dev/null 2>&1; then
    echo "ansible-playbook is required but not installed. Aborting." >&2
    exit 1
fi

if ! command -v nomad >/dev/null 2>&1; then
    echo "nomad CLI is required but not installed. Aborting." >&2
    exit 1
fi

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Function to get the first available Nomad server
get_nomad_server() {
    # Get vault password file path
    local vault_pass_file="${SCRIPT_DIR}/.vault_pass"
    
    # Extract Nomad server IPs from inventory using ansible
    echo "Extracting Nomad server information from inventory..." >&2
    local nomad_servers=$(ansible nomad_servers -i "${SCRIPT_DIR}/inventory.yml" \
        --vault-password-file "${vault_pass_file}" \
        -m debug -a "var=tailscale_ip" 2>/dev/null | \
        grep -o '"tailscale_ip": "[^"]*"' | \
        cut -d'"' -f4 | \
        grep -v '^$' || true)
    
    # If no tailscale IPs found, try ansible_host
    if [ -z "$nomad_servers" ]; then
        nomad_servers=$(ansible nomad_servers -i "${SCRIPT_DIR}/inventory.yml" \
            --vault-password-file "${vault_pass_file}" \
            -m debug -a "var=ansible_host" 2>/dev/null | \
            grep -o '"ansible_host": "[^"]*"' | \
            cut -d'"' -f4 | \
            grep -v '^$' || true)
    fi
    
    # If still no servers found, fall back to known IPs
    if [ -z "$nomad_servers" ]; then
        nomad_servers="100.125.71.27 100.92.177.11 100.69.93.109"
    fi
    
    # Check if we need authentication
    local auth_args=""
    if [ -n "$NOMAD_TOKEN" ]; then
        auth_args="-H X-Nomad-Token:${NOMAD_TOKEN}"
    fi
    
    # Try each server
    for server in $nomad_servers; do
        echo "Trying Nomad server at ${server}..." >&2
        # Use separate curl command to handle auth header properly
        if [ -n "$NOMAD_TOKEN" ]; then
            if curl -s -f -H "X-Nomad-Token:${NOMAD_TOKEN}" "http://${server}:4646/v1/status/leader" >/dev/null 2>&1; then
                echo "http://${server}:4646"
                return 0
            fi
        else
            if curl -s -f "http://${server}:4646/v1/status/leader" >/dev/null 2>&1; then
                echo "http://${server}:4646"
                return 0
            fi
        fi
    done
    
    echo "" >&2
    echo "WARNING: Could not find any accessible Nomad server" >&2
    echo "" >&2
    echo "Troubleshooting steps:" >&2
    echo "1. Ensure you are connected to the Tailscale VPN" >&2
    echo "2. Set NOMAD_ADDR manually: export NOMAD_ADDR=http://<server-ip>:4646" >&2
    echo "3. If ACLs are enabled, set NOMAD_TOKEN: export NOMAD_TOKEN=<your-token>" >&2
    echo "" >&2
    echo "To find Nomad servers manually, run:" >&2
    echo "  ansible nomad_servers -i inventory.yml --list-hosts --vault-password-file .vault_pass" >&2
    echo ""
    # Return empty string to indicate failure
    echo ""
    return 0
}

# Set NOMAD_ADDR if not already set
if [ -z "$NOMAD_ADDR" ]; then
    echo "Detecting Nomad server..."
    NOMAD_ADDR=$(get_nomad_server)
    if [ -z "$NOMAD_ADDR" ]; then
        echo "ERROR: Could not find any accessible Nomad server"
        echo "Cannot proceed with deployment without Nomad access"
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
stop_and_purge_job "alloy"
stop_and_purge_job "prometheus"
stop_and_purge_job "loki"

echo ""
echo "========================================"
echo "Step 2: Setting up Consul KV values"
echo "========================================"

# Check if setup-consul-kv.yml exists
if [ -f "$SCRIPT_DIR/applications/observability/setup-consul-kv.yml" ]; then
    echo "Checking for reachable hosts..."
    
    # Get all hosts and check connectivity
    REACHABLE_HOSTS=""
    ALL_HOSTS=$(ansible-inventory -i "$SCRIPT_DIR/inventory.yml" --list | jq -r '.all.hosts[]' 2>/dev/null || echo "")
    
    for host in $ALL_HOSTS; do
        if ansible $host -i "$SCRIPT_DIR/inventory.yml" -m ping --vault-password-file "$SCRIPT_DIR/.vault_pass" -o >/dev/null 2>&1; then
            REACHABLE_HOSTS="$REACHABLE_HOSTS,$host"
        fi
    done
    
    # Remove leading comma
    REACHABLE_HOSTS=${REACHABLE_HOSTS#,}
    
    if [ -z "$REACHABLE_HOSTS" ]; then
        echo "WARNING: No hosts are reachable for Consul KV setup"
        echo "Continuing without Consul KV configuration..."
    else
        echo "Running Consul KV setup on reachable hosts: $REACHABLE_HOSTS"
        ansible-playbook -i "$SCRIPT_DIR/inventory.yml" "$SCRIPT_DIR/applications/observability/setup-consul-kv.yml" \
            --vault-password-file "$SCRIPT_DIR/.vault_pass" \
            --limit "$REACHABLE_HOSTS" || {
            echo "Warning: Consul KV setup may have partially failed. Continuing anyway..."
        }
    fi
else
    echo "No Consul KV setup file found, skipping..."
fi

echo ""
echo "========================================"
echo "Step 3: Deploying fresh observability stack"
echo "========================================"

# Deploy Loki first
echo ""
echo "Deploying Loki (log aggregation)..."
if ! nomad job run "$SCRIPT_DIR/applications/observability/loki.nomad"; then
    echo "WARNING: Failed to deploy Loki"
    echo "Continuing with other services..."
    LOKI_FAILED=true
else
    wait_for_job_healthy "loki" 120
    LOKI_FAILED=false
fi

# Deploy Prometheus second
echo ""
echo "Deploying Prometheus (metrics collection)..."
if ! nomad job run "$SCRIPT_DIR/applications/observability/prometheus.nomad"; then
    echo "WARNING: Failed to deploy Prometheus"
    echo "Continuing with other services..."
    PROMETHEUS_FAILED=true
else
    wait_for_job_healthy "prometheus" 120
    PROMETHEUS_FAILED=false
fi

# Give core services time to register in Consul
if [ "$LOKI_FAILED" != "true" ] || [ "$PROMETHEUS_FAILED" != "true" ]; then
    echo "Waiting for core services to register in Consul..."
    sleep 15
fi

# Deploy Alloy after core services are up
echo ""
echo "Deploying Alloy (log & metrics collection)..."
echo "Note: Alloy will connect to Loki and Prometheus services"
if ! nomad job run "$SCRIPT_DIR/applications/observability/alloy.nomad"; then
    echo "WARNING: Failed to deploy Alloy"
    echo "Continuing with other services..."
    ALLOY_FAILED=true
else
    # Alloy is a system job, so we just wait a bit for it to start on all nodes
    echo "Waiting for Alloy to start on all nodes..."
    sleep 20
    ALLOY_FAILED=false
fi

# Deploy Grafana
echo ""
echo "Deploying Grafana (visualization)..."
echo "Note: Grafana includes a new 'ProposalsApp Logs Overview' dashboard"
if ! nomad job run "$SCRIPT_DIR/applications/observability/grafana.nomad"; then
    echo "WARNING: Failed to deploy Grafana"
    echo "Continuing with deployment summary..."
    GRAFANA_FAILED=true
else
    wait_for_job_healthy "grafana" 180  # Grafana takes longer due to plugin installation
    GRAFANA_FAILED=false
fi

echo ""
echo "========================================"
echo "Observability Stack Deployment Summary"
echo "========================================"
echo ""

# Count successes and failures
TOTAL_SERVICES=4
FAILED_COUNT=0
FAILED_SERVICES=""

if [ "$LOKI_FAILED" = "true" ]; then
    FAILED_COUNT=$((FAILED_COUNT + 1))
    FAILED_SERVICES="$FAILED_SERVICES Loki"
fi
if [ "$ALLOY_FAILED" = "true" ]; then
    FAILED_COUNT=$((FAILED_COUNT + 1))
    FAILED_SERVICES="$FAILED_SERVICES Alloy"
fi
if [ "$PROMETHEUS_FAILED" = "true" ]; then
    FAILED_COUNT=$((FAILED_COUNT + 1))
    FAILED_SERVICES="$FAILED_SERVICES Prometheus"
fi
if [ "$GRAFANA_FAILED" = "true" ]; then
    FAILED_COUNT=$((FAILED_COUNT + 1))
    FAILED_SERVICES="$FAILED_SERVICES Grafana"
fi

SUCCESS_COUNT=$((TOTAL_SERVICES - FAILED_COUNT))

echo "Deployment Results:"
echo "✅ Successful: $SUCCESS_COUNT/$TOTAL_SERVICES services"
if [ $FAILED_COUNT -gt 0 ]; then
    echo "❌ Failed:$FAILED_SERVICES"
fi

echo ""
echo "Final deployment status:"
echo ""

# Function to get job allocations with IP addresses
show_job_status() {
    local job_name=$1
    echo "=== ${job_name} ==="

    if nomad job status "${job_name}" >/dev/null 2>&1; then
        # Get allocation details
        local alloc_output=$(nomad job status "${job_name}" | grep -A 5 "Allocations" | tail -n +2 | head -n 5)
        if [ -n "$alloc_output" ]; then
            echo "$alloc_output"
            
            # Get the running allocation IP
            local alloc_id=$(nomad job status "${job_name}" | grep -A 5 "Allocations" | grep "running" | awk '{print $1}' | head -n 1)
            if [ -n "$alloc_id" ]; then
                local node_id=$(nomad alloc status "$alloc_id" 2>/dev/null | grep "Node ID" | awk '{print $4}')
                if [ -n "$node_id" ]; then
                    # Get the node's IP address from the node status
                    local ip=$(nomad node status "$node_id" 2>/dev/null | grep "Address" | head -1 | awk '{print $3}')
                    if [ -n "$ip" ]; then
                        echo "Access: http://${ip}:$(get_job_port ${job_name})"
                    fi
                fi
            fi
        else
            echo "No allocations found"
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
GRAFANA_IP=""
PROMETHEUS_IP=""
LOKI_IP=""

# Only get IPs for successfully deployed services
if [ "$GRAFANA_FAILED" != "true" ]; then
    GRAFANA_NODE=$(nomad job status grafana 2>/dev/null | grep -A 5 "Allocations" | grep "running" | awk '{print $2}' | head -n 1)
    if [ -n "$GRAFANA_NODE" ]; then
        GRAFANA_IP=$(nomad node status "$GRAFANA_NODE" 2>/dev/null | grep "Address" | head -1 | awk '{print $3}')
    fi
fi

if [ "$PROMETHEUS_FAILED" != "true" ]; then
    PROMETHEUS_NODE=$(nomad job status prometheus 2>/dev/null | grep -A 5 "Allocations" | grep "running" | awk '{print $2}' | head -n 1)
    if [ -n "$PROMETHEUS_NODE" ]; then
        PROMETHEUS_IP=$(nomad node status "$PROMETHEUS_NODE" 2>/dev/null | grep "Address" | head -1 | awk '{print $3}')
    fi
fi

if [ "$LOKI_FAILED" != "true" ]; then
    LOKI_NODE=$(nomad job status loki 2>/dev/null | grep -A 5 "Allocations" | grep "running" | awk '{print $2}' | head -n 1)
    if [ -n "$LOKI_NODE" ]; then
        LOKI_IP=$(nomad node status "$LOKI_NODE" 2>/dev/null | grep "Address" | head -1 | awk '{print $3}')
    fi
fi

echo "Direct Access (via Tailscale):"
echo "- Grafana: http://${GRAFANA_IP:-<not-deployed>}:3000"
echo "- Prometheus: http://${PROMETHEUS_IP:-<not-deployed>}:9090"
echo "- Loki: http://${LOKI_IP:-<not-deployed>}:3100"
if [ "$ALLOY_FAILED" != "true" ]; then
    echo "- Alloy: http://<any-node>:12345 (running on all nodes)"
else
    echo "- Alloy: <not-deployed>"
fi
echo ""
echo "Public Access (via Traefik):"
if [ "$GRAFANA_FAILED" != "true" ]; then
    echo "- Grafana: https://grafana.proposals.app"
fi
if [ "$PROMETHEUS_FAILED" != "true" ]; then
    echo "- Prometheus: https://prometheus.proposals.app"
fi
echo ""
echo "Note: Public access requires Traefik to be running. Deploy with:"
echo "  ./deploy-application.sh traefik"
echo ""

# Only show Grafana info if it was deployed successfully
if [ "$GRAFANA_FAILED" != "true" ] && [ -n "$GRAFANA_IP" ]; then
    echo "Default Grafana credentials:"
    echo "- Username: admin"
    echo "- Password: admin"
    echo ""
fi

# Show improvements only if at least some services deployed
if [ $SUCCESS_COUNT -gt 0 ]; then
    echo "Key improvements in this deployment:"
    echo "- Simplified Alloy log processing pipeline"
    echo "- Better JSON log parsing for Rust services"
    echo "- Normalized log level labels (error, warn, info, debug, trace)"
    echo "- Improved Grafana dashboard with better visualizations"
    echo "- Optimized Loki configuration for performance"
    echo ""
    
    if [ "$ALLOY_FAILED" != "true" ] && [ "$LOKI_FAILED" != "true" ]; then
        echo "Logs are being collected from all Nomad allocations automatically."
        echo "Services detected: rindexer, discourse, mapper, web, email-service"
        echo ""
    fi
fi

if [ $SUCCESS_COUNT -gt 0 ]; then
    echo "To see the actual access URLs, run:"
    echo "  ./show-observability-urls.sh"
    echo ""
fi

if [ "$GRAFANA_FAILED" != "true" ] && [ "$LOKI_FAILED" != "true" ] && [ -n "$GRAFANA_IP" ]; then
    echo "To view logs in Grafana:"
    echo "1. Open Grafana at the URL above"
    echo "2. Navigate to 'Dashboards' → 'ProposalsApp Logs Overview'"
    echo "3. Use the service and level filters to explore logs"
fi

# Show retry instructions if some services failed
if [ $FAILED_COUNT -gt 0 ]; then
    echo ""
    echo "To retry failed deployments, run this script again."
    echo "The script will clean up and redeploy all services."
fi

echo "========================================"

# Exit with error code if all services failed
if [ $FAILED_COUNT -eq $TOTAL_SERVICES ]; then
    exit 1
fi
