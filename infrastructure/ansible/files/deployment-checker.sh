#!/bin/bash
# Simplified deployment checker that runs periodically

set -e

# Configuration
LOG_FILE="/var/log/deployment-checker.log"
STATE_FILE="/var/run/deployment-checker.state"
CONSUL_ADDR="${CONSUL_ADDR:-http://localhost:8500}"
NOMAD_ADDR="${NOMAD_ADDR:-http://localhost:4646}"

# Applications to check
APPS="web rindexer discourse mapper"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE"
}

# Function to get deployment info from Consul
get_deployment_info() {
    local app=$1
    curl -s "${CONSUL_ADDR}/v1/kv/${app}/deployment/main?raw" 2>/dev/null || echo "{}"
}

# Function to load previous state
load_state() {
    local app=$1
    if [ -f "${STATE_FILE}.${app}" ]; then
        cat "${STATE_FILE}.${app}"
    else
        echo ""
    fi
}

# Function to save state
save_state() {
    local app=$1
    local image=$2
    echo "$image" > "${STATE_FILE}.${app}"
}

# Function to check and deploy if needed
check_and_deploy() {
    local app=$1
    
    # Get current deployment info from Consul
    local deployment_json=$(get_deployment_info "$app")
    local new_image=$(echo "$deployment_json" | jq -r '.image // empty' 2>/dev/null)
    
    if [ -z "$new_image" ]; then
        return 0
    fi
    
    # Get previous state
    local previous_image=$(load_state "$app")
    
    # Check if image changed
    if [ "$new_image" != "$previous_image" ]; then
        log "Image change detected for $app: $previous_image -> $new_image"
        
        # Deploy using the deployment script
        if /opt/deployment/deploy-application.sh "$app" "$new_image"; then
            save_state "$app" "$new_image"
            log "Successfully deployed $app with image $new_image"
        else
            log "ERROR: Failed to deploy $app"
        fi
    fi
}

# Script to deploy an application
cat > /opt/deployment/deploy-application.sh << 'EOF'
#!/bin/bash
set -e

APP=$1
IMAGE=$2

# Get current job and update image
JOB_JSON=$(curl -s "http://localhost:4646/v1/job/${APP}")
if [ -z "$JOB_JSON" ] || echo "$JOB_JSON" | grep -q "not found"; then
    echo "Job $APP not found"
    exit 1
fi

# Update image in job spec
UPDATED_JOB=$(echo "$JOB_JSON" | jq --arg img "$IMAGE" '.Job.TaskGroups[0].Tasks[0].Config.image = $img')

# Submit updated job
RESPONSE=$(echo "{\"Job\": $UPDATED_JOB}" | curl -s -X POST -H "Content-Type: application/json" -d @- "http://localhost:4646/v1/job/${APP}")

if echo "$RESPONSE" | jq -e '.EvalID' >/dev/null 2>&1; then
    echo "Deployment triggered successfully"
    exit 0
else
    echo "Deployment failed: $RESPONSE"
    exit 1
fi
EOF

chmod +x /opt/deployment/deploy-application.sh

# Main execution
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$(dirname "$STATE_FILE")"

log "Starting deployment check"

for app in $APPS; do
    check_and_deploy "$app"
done

log "Deployment check complete"