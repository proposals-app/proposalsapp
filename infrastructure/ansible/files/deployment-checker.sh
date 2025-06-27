#!/bin/bash
# Simplified deployment checker that runs periodically

set -e

# Configuration
LOG_FILE="/var/log/deployment-checker.log"
STATE_FILE="/var/run/deployment-checker.state"
CONSUL_ADDR="${CONSUL_ADDR:-http://localhost:8500}"
NOMAD_ADDR="${NOMAD_ADDR:-http://localhost:4646}"

# Applications to check
APPS="web rindexer discourse mapper email-service"

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
        if output=$(/opt/deployment/deploy-application.sh "$app" "$new_image" 2>&1); then
            save_state "$app" "$new_image"
            log "Successfully deployed $app with image $new_image"
        else
            log "ERROR: Failed to deploy $app: $output"
        fi
    fi
}

# Script to deploy an application
cat > /opt/deployment/deploy-application.sh << 'EOF'
#!/bin/bash
set -e

APP=$1
IMAGE=$2

# Validate inputs
if [ -z "$APP" ] || [ -z "$IMAGE" ]; then
    echo "Error: APP and IMAGE are required"
    echo "Usage: $0 <app-name> <image-url>"
    exit 1
fi

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] deploy-application: $*"
}

log "Starting deployment of $APP with image $IMAGE"

# Get current job
JOB_JSON=$(curl -s "http://localhost:4646/v1/job/${APP}")
if [ -z "$JOB_JSON" ] || echo "$JOB_JSON" | grep -q "not found"; then
    echo "Error: Job $APP not found in Nomad"
    exit 1
fi

# Extract job structure
JOB_NAME=$(echo "$JOB_JSON" | jq -r '.ID // empty')
if [ -z "$JOB_NAME" ]; then
    echo "Error: Could not extract job name from response"
    exit 1
fi

# Update all tasks in all task groups with the new image
# This handles jobs with multiple task groups and tasks
UPDATED_JOB=$(echo "$JOB_JSON" | jq --arg img "$IMAGE" '
  .Job.TaskGroups[]?.Tasks[]? |= 
  if .Config.image then 
    .Config.image = $img 
  else . end
')

# Ensure we have a valid job structure
if [ -z "$UPDATED_JOB" ] || [ "$UPDATED_JOB" = "null" ]; then
    echo "Error: Failed to update job structure"
    exit 1
fi

# Prepare the job submission
JOB_SUBMISSION=$(echo "$UPDATED_JOB" | jq '{Job: .Job}')

# Submit updated job
log "Submitting updated job to Nomad"
RESPONSE=$(echo "$JOB_SUBMISSION" | curl -s -X POST \
  -H "Content-Type: application/json" \
  -d @- "http://localhost:4646/v1/job/${APP}")

# Check response
if echo "$RESPONSE" | jq -e '.EvalID' >/dev/null 2>&1; then
    EVAL_ID=$(echo "$RESPONSE" | jq -r '.EvalID')
    log "Deployment triggered successfully (Eval ID: $EVAL_ID)"
    
    # Wait briefly and check evaluation status
    sleep 2
    EVAL_STATUS=$(curl -s "http://localhost:4646/v1/evaluation/${EVAL_ID}" | jq -r '.Status // "unknown"')
    log "Evaluation status: $EVAL_STATUS"
    
    echo "Deployment triggered successfully (Eval ID: $EVAL_ID, Status: $EVAL_STATUS)"
    exit 0
else
    ERROR_MSG=$(echo "$RESPONSE" | jq -r '.error // "Unknown error"' 2>/dev/null || echo "$RESPONSE")
    echo "Error: Deployment failed - $ERROR_MSG"
    log "Deployment failed: $RESPONSE"
    exit 1
fi
EOF

chmod +x /opt/deployment/deploy-application.sh

# Main execution
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$(dirname "$STATE_FILE")"

log "Starting deployment check run"

# Check if we can reach Consul and Nomad
if ! curl -s "${CONSUL_ADDR}/v1/status/leader" >/dev/null 2>&1; then
    log "WARNING: Cannot reach Consul at ${CONSUL_ADDR}"
fi

if ! curl -s "${NOMAD_ADDR}/v1/status/leader" >/dev/null 2>&1; then
    log "WARNING: Cannot reach Nomad at ${NOMAD_ADDR}"
fi

# Check each application
for app in $APPS; do
    check_and_deploy "$app"
done

log "Deployment check run complete"