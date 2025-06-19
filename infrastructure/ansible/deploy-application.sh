#!/bin/bash
# Helper script to deploy applications

set -e

# Function to show usage
show_usage() {
    echo "Usage: $0 <application-name> [action]"
    echo "Actions: setup, deploy, both (default)"
    echo ""
    echo "Available applications:"
    echo "  rindexer         - Blockchain indexer service"
    echo "  discourse        - Discourse forum indexer service"
    echo "  cloudflared      - Cloudflare tunnel daemon for Zero Trust access"
    echo "  traefik          - Edge router and load balancer with automatic HTTPS"
    echo "  web              - Next.js frontend application"
    echo "  redis            - Redis cache with HA and local-first routing"
    echo ""
    echo "Examples:"
    echo "  $0 rindexer"
    echo "  $0 rindexer setup"
    echo "  $0 rindexer deploy"
}

if [ $# -lt 1 ]; then
    show_usage
    exit 1
fi

APP_NAME=$1
ACTION=${2:-both}
APP_DIR="applications/$APP_NAME"

# List of valid applications
VALID_APPS="rindexer discourse cloudflared traefik web redis"

# Check if app is valid
if ! echo "$VALID_APPS" | grep -q "\b$APP_NAME\b"; then
    echo "Error: Invalid application '$APP_NAME'"
    echo "Valid applications: $VALID_APPS"
    exit 1
fi

if [ ! -d "$APP_DIR" ]; then
    echo "Error: Application '$APP_NAME' not found in $APP_DIR"
    exit 1
fi

cd "$(dirname "$0")"

# Function to run setup playbooks
run_setup() {
    echo "Running setup playbooks for $APP_NAME..."

    for playbook in "$APP_DIR"/*.yml; do
        if [ -f "$playbook" ]; then
            echo "Executing: ansible-playbook -i inventory.yml $playbook"
            ansible-playbook -i inventory.yml "$playbook"
        fi
    done
}

# Function to deploy Nomad job
run_deploy() {
    echo "Deploying Nomad job for $APP_NAME..."
    NOMAD_FILE="$APP_DIR/$APP_NAME.nomad"

    if [ ! -f "$NOMAD_FILE" ]; then
        echo "Warning: No Nomad job file found at $NOMAD_FILE"
        return
    fi

    # Initialize FULL_IMAGE variable
    FULL_IMAGE=""
    
    # Check for existing deployment and stop it
    echo "Checking for existing $APP_NAME deployment..."
    if [ -n "$NOMAD_ADDR" ]; then
        # Use direct Nomad connection
        if nomad job status "$APP_NAME" >/dev/null 2>&1; then
            echo "Found existing $APP_NAME deployment. Stopping it..."
            nomad job stop -purge "$APP_NAME" || echo "Warning: Failed to stop existing job"
            echo "Waiting for cleanup..."
            sleep 5
        fi
    else
        # Use Ansible to check via remote Nomad server
        NOMAD_SERVER=$(ansible-inventory -i inventory.yml --list | jq -r '.nomad_servers.hosts[0]' 2>/dev/null || echo "")
        if [ -n "$NOMAD_SERVER" ]; then
            if ansible $NOMAD_SERVER -i inventory.yml -m shell -a "nomad job status $APP_NAME" --vault-password-file .vault_pass >/dev/null 2>&1; then
                echo "Found existing $APP_NAME deployment. Stopping it..."
                ansible $NOMAD_SERVER -i inventory.yml -m shell -a "nomad job stop -purge $APP_NAME" --vault-password-file .vault_pass || echo "Warning: Failed to stop existing job"
                echo "Waiting for cleanup..."
                sleep 5
            fi
        fi
    fi

    # Update Consul KV with latest image for supported apps
    if [[ "$APP_NAME" =~ ^(web|rindexer|discourse)$ ]]; then
        echo "Checking for latest image for $APP_NAME..."
        
        # Define Consul servers
        CONSUL_SERVERS=(
            "consul-nomad-sib-01"
            "consul-nomad-sib-03"
            "consul-nomad-fsn-01"
        )
        
        # Get latest image tag from GitHub Container Registry
        REGISTRY="ghcr.io/proposals-app/proposalsapp"
        IMAGE_NAME="$REGISTRY/$APP_NAME"
        
        # Get GitHub token from Ansible vault
        echo "Retrieving GitHub authentication..."
        GITHUB_TOKEN=$(ansible localhost -i inventory.yml -m debug -a "var=vault_github_pat" --vault-password-file .vault_pass 2>/dev/null | 
            grep -o '"vault_github_pat": "[^"]*"' | 
            sed 's/"vault_github_pat": "\(.*\)"/\1/' || echo "")
        
        if [ -z "$GITHUB_TOKEN" ]; then
            echo "ERROR: Could not retrieve GitHub token from vault."
            echo "Ensure vault_github_pat is set in vault and .vault_pass file exists."
            exit 1
        fi
        
        # Use GitHub API to get the latest successful build
        echo "Checking GitHub API for latest successful build..."
        API_RESPONSE=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
            -H "Accept: application/vnd.github+json" \
            -H "X-GitHub-Api-Version: 2022-11-28" \
            "https://api.github.com/repos/proposals-app/proposalsapp/actions/workflows/build-${APP_NAME}.yml/runs?branch=main&status=success&per_page=1")
        
        LATEST_SHA=$(echo "$API_RESPONSE" | jq -r '.workflow_runs[0].head_sha[:7]' 2>/dev/null || echo "")
        
        if [ -n "$LATEST_SHA" ] && [ "$LATEST_SHA" != "null" ]; then
            LATEST_TAG="main-$LATEST_SHA"
            echo "✓ Found latest tag from GitHub Actions: $LATEST_TAG"
        else
            # Fallback: check current deployment in Consul
            echo "Could not get tag from GitHub API. Checking Consul for current deployment..."
            for server in "${CONSUL_SERVERS[@]}"; do
                DEPLOYMENT_JSON=$(ansible $server -i inventory.yml -m uri -a \
                    "url=http://localhost:8500/v1/kv/$APP_NAME/deployment/main?raw method=GET" \
                    --vault-password-file .vault_pass 2>/dev/null | \
                    grep -o '{.*}' || echo "")
                
                if [ -n "$DEPLOYMENT_JSON" ]; then
                    LATEST_TAG=$(echo "$DEPLOYMENT_JSON" | jq -r '.tag' 2>/dev/null || echo "")
                    if [ -n "$LATEST_TAG" ] && [ "$LATEST_TAG" != "null" ]; then
                        echo "✓ Using current deployment tag from Consul: $LATEST_TAG"
                        break
                    fi
                fi
            done
        fi
        
        # Final fallback
        if [ -z "$LATEST_TAG" ] || [ "$LATEST_TAG" = "null" ]; then
            echo "Warning: Could not determine latest tag. Using 'latest' as fallback."
            LATEST_TAG="latest"
        fi
        
        FULL_IMAGE="$IMAGE_NAME:$LATEST_TAG"
        echo "Using image: $FULL_IMAGE"
        
        # Create deployment metadata
        DEPLOYMENT_JSON=$(cat <<EOF
{
  "tag": "$LATEST_TAG",
  "image": "$FULL_IMAGE",
  "branch": "main",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployed_by": "deploy-application.sh",
  "deployed_from": "$(hostname)"
}
EOF
)
        
        # Update Consul KV with retry logic
        CONSUL_UPDATED=false
        for server in "${CONSUL_SERVERS[@]}"; do
            echo "Updating Consul KV on $server..."
            
            # Try up to 3 times with exponential backoff
            for attempt in 1 2 3; do
                if ansible $server -i inventory.yml -m uri -a \
                    "url=http://localhost:8500/v1/kv/$APP_NAME/deployment/main method=PUT body='$DEPLOYMENT_JSON' body_format=json" \
                    --vault-password-file .vault_pass > /dev/null 2>&1; then
                    echo "✓ Successfully updated Consul KV on $server"
                    CONSUL_UPDATED=true
                    break 2
                else
                    echo "Attempt ${attempt}/3 failed for ${server}"
                    [ $attempt -lt 3 ] && sleep $((attempt * 2))
                fi
            done
        done
        
        if [ "$CONSUL_UPDATED" = false ]; then
            echo "ERROR: Failed to update Consul KV on all servers!"
            echo "Deployment will proceed but Nomad may not detect the new image."
        fi
    fi

    # Check if NOMAD_ADDR is set
    if [ -z "$NOMAD_ADDR" ]; then
        echo "NOMAD_ADDR not set. Deploying via Ansible on first Nomad server..."

        # Get the first Nomad server from inventory
        NOMAD_SERVER=$(ansible-inventory -i inventory.yml --list | jq -r '.nomad_servers.hosts[0]' 2>/dev/null || echo "")

        if [ -z "$NOMAD_SERVER" ]; then
            echo "Error: Could not find a Nomad server in inventory"
            echo "Set NOMAD_ADDR environment variable or ensure nomad_servers group exists in inventory"
            exit 1
        fi

        echo "Using Nomad server: $NOMAD_SERVER"

        # Create a temporary job file with updated image
        TEMP_NOMAD_FILE="/tmp/${APP_NAME}_deploy_$$.nomad"
        cp "$NOMAD_FILE" "$TEMP_NOMAD_FILE"
        
        # Update the image in the job file if we have the full image
        if [ ! -z "$FULL_IMAGE" ]; then
            echo "Updating job file with image: $FULL_IMAGE"
            sed -i.bak "s|image = \".*\"|image = \"$FULL_IMAGE\"|g" "$TEMP_NOMAD_FILE"
        fi

        # Copy the job file to remote with vault password
        ansible $NOMAD_SERVER -i inventory.yml -m copy \
            -a "src=$TEMP_NOMAD_FILE dest=/tmp/$APP_NAME.nomad" \
            --vault-password-file .vault_pass || exit 1

        # Run the job on remote
        echo "Deploying job to Nomad..."
        ansible $NOMAD_SERVER -i inventory.yml -m shell \
            -a "nomad job run /tmp/$APP_NAME.nomad" \
            --vault-password-file .vault_pass || exit 1
            
        echo "✅ Job deployed successfully"
        echo "Checking deployment status..."
        ansible $NOMAD_SERVER -i inventory.yml -m shell \
            -a "nomad job status $APP_NAME | head -10" \
            --vault-password-file .vault_pass

        # Clean up
        ansible $NOMAD_SERVER -i inventory.yml -m file \
            -a "path=/tmp/$APP_NAME.nomad state=absent" \
            --vault-password-file .vault_pass
        rm -f "$TEMP_NOMAD_FILE" "$TEMP_NOMAD_FILE.bak"
    else
        echo "Using NOMAD_ADDR: $NOMAD_ADDR"
        
        # Create a temporary job file with updated image
        TEMP_NOMAD_FILE="/tmp/${APP_NAME}_deploy_$$.nomad"
        cp "$NOMAD_FILE" "$TEMP_NOMAD_FILE"
        
        # Update the image in the job file if we have the full image
        if [ ! -z "$FULL_IMAGE" ]; then
            echo "Updating job file with image: $FULL_IMAGE"
            sed -i.bak "s|image = \".*\"|image = \"$FULL_IMAGE\"|g" "$TEMP_NOMAD_FILE"
        fi
        
        echo "Executing: nomad job run $TEMP_NOMAD_FILE"
        echo "Deploying job to Nomad..."
        if ! nomad job run "$TEMP_NOMAD_FILE"; then
            echo "ERROR: Failed to deploy job to Nomad"
            rm -f "$TEMP_NOMAD_FILE" "$TEMP_NOMAD_FILE.bak"
            exit 1
        fi
        
        echo "✅ Job deployed successfully"
        echo "Checking deployment status..."
        sleep 3
        nomad job status "$APP_NAME" | head -10
        
        # Clean up
        rm -f "$TEMP_NOMAD_FILE" "$TEMP_NOMAD_FILE.bak"
    fi
}

case "$ACTION" in
    setup)
        run_setup
        ;;
    deploy)
        run_deploy
        ;;
    both)
        run_setup
        run_deploy
        ;;
    *)
        echo "Error: Unknown action '$ACTION'. Use: setup, deploy, or both"
        exit 1
        ;;
esac

echo "Done!"
