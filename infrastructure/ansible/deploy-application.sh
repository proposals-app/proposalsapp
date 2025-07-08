#!/bin/bash
# Helper script to deploy applications

# Don't exit on error - we'll handle errors gracefully
set +e

# Function to show usage
show_usage() {
    echo "Usage: $0 <application-name|all> [action]"
    echo "Actions: setup, deploy, both (default), continue (for 'all' only)"
    echo ""
    echo "Available applications:"
    echo "  all              - Deploy all applications in the correct order"
    echo "  rindexer         - Blockchain indexer service"
    echo "  discourse        - Discourse forum indexer service"
    echo "  mapper           - Data relationship engine for grouping proposals and karma calculation"
    echo "  cloudflared      - Cloudflare tunnel daemon for Zero Trust access"
    echo "  consul-ingress   - Consul mesh gateway ingress for service routing"
    echo "  web              - Next.js frontend application"
    echo "  email-service    - Email notification service for proposals"
    echo "  homepage         - Infrastructure dashboard with service discovery"
    echo ""
    echo "Note: For observability stack (Prometheus, Grafana, Loki), use ./deploy-observability.sh"
    echo ""
    echo "Examples:"
    echo "  $0 all              # Deploy all applications (stops on first error)"
    echo "  $0 all continue     # Deploy all applications (continues on errors)"
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

cd "$(dirname "$0")"

# Handle "all" option
if [ "$APP_NAME" = "all" ]; then
    echo "=========================================="
    echo "Deploying all applications in order"
    echo "=========================================="

    DEPLOYMENT_ORDER="cloudflared consul-ingress homepage web rindexer discourse mapper email-service"

    # Check if we should continue on error
    CONTINUE_ON_ERROR=false
    if [ "$ACTION" = "continue" ]; then
        CONTINUE_ON_ERROR=true
        ACTION="both"
        echo "Note: Will continue deploying even if some applications fail"
    fi

    FAILED_APPS=""
    SUCCEEDED_APPS=""

    for app in $DEPLOYMENT_ORDER; do
        echo ""
        echo "=========================================="
        echo "Deploying $app..."
        echo "=========================================="

        if "$0" "$app" "$ACTION"; then
            SUCCEEDED_APPS="$SUCCEEDED_APPS $app"
            echo "✅ $app deployed successfully"

            # Add a delay between deployments to allow services to stabilize
            if [ "$app" != "email-service" ]; then
                echo "Waiting 10 seconds before next deployment..."
                sleep 10
            fi
        else
            FAILED_APPS="$FAILED_APPS $app"
            echo "❌ $app deployment failed"

            if [ "$CONTINUE_ON_ERROR" = false ]; then
                echo "Stopping deployment due to failure. Use 'all continue' to continue on errors."
                break
            fi
        fi
    done

    echo ""
    echo "=========================================="
    echo "Deployment Summary"
    echo "=========================================="
    if [ -n "$SUCCEEDED_APPS" ]; then
        echo "✅ Succeeded:$SUCCEEDED_APPS"
    fi
    if [ -n "$FAILED_APPS" ]; then
        echo "❌ Failed:$FAILED_APPS"
        exit 1
    else
        echo "All applications deployed successfully!"
    fi
    exit 0
fi

# List of valid applications
VALID_APPS="rindexer discourse mapper email-service cloudflared consul-ingress web homepage"

# Check if app is valid
if ! echo "$VALID_APPS" | grep -q "\b$APP_NAME\b"; then
    echo "Error: Invalid application '$APP_NAME'"
    echo "Valid applications: $VALID_APPS, all"
    exit 1
fi

APP_DIR="applications/$APP_NAME"

if [ ! -d "$APP_DIR" ]; then
    echo "Error: Application directory '$APP_DIR' not found"
    exit 1
fi

# Function to run setup playbooks
run_setup() {
    echo "Running setup playbooks for $APP_NAME..."

    # Track if any playbook succeeded
    SETUP_SUCCESS=false

    for playbook in "$APP_DIR"/*.yml; do
        if [ -f "$playbook" ]; then
            echo "Executing: ansible-playbook -i inventory.yml $playbook"

            # First check which hosts are reachable
            echo "Checking host connectivity..."
            REACHABLE_HOSTS=""
            
            # Determine which hosts to check based on the playbook
            if [[ "$playbook" =~ "setup-consul-kv" ]]; then
                # For Consul KV setup, only check consul servers
                TARGET_HOSTS=$(ansible-inventory -i inventory.yml --list | jq -r '.consul_servers.hosts[]' 2>/dev/null || echo "")
            else
                # For other playbooks, check all hosts
                TARGET_HOSTS=$(ansible-inventory -i inventory.yml --list | jq -r '.all.hosts[]' 2>/dev/null || echo "")
            fi

            for host in $TARGET_HOSTS; do
                if ansible $host -i inventory.yml -m ping --vault-password-file .vault_pass -o >/dev/null 2>&1; then
                    REACHABLE_HOSTS="$REACHABLE_HOSTS,$host"
                fi
            done

            # Remove leading comma
            REACHABLE_HOSTS=${REACHABLE_HOSTS#,}

            if [ -z "$REACHABLE_HOSTS" ]; then
                echo "WARNING: No hosts are reachable for playbook $playbook"
                
                # Special handling for cloudflared - it requires Consul KV setup
                if [ "$APP_NAME" = "cloudflared" ] && [[ "$playbook" =~ "setup-consul-kv" ]]; then
                    echo "ERROR: Cannot deploy cloudflared without setting up Consul KV values!"
                    echo "Consul servers must be reachable to store the tunnel token."
                    echo ""
                    echo "To fix this:"
                    echo "1. Ensure Consul servers are running"
                    echo "2. Run: ansible-playbook -i inventory.yml $playbook --vault-password-file .vault_pass"
                    echo "3. Or set NOMAD_ADDR and run the job manually after setting up Consul KV"
                    return 1
                fi
                
                continue
            fi

            echo "Running playbook on reachable hosts: $REACHABLE_HOSTS"

            # Run playbook only on reachable hosts
            if ansible-playbook -i inventory.yml "$playbook" --vault-password-file .vault_pass --limit "$REACHABLE_HOSTS"; then
                echo "✓ Playbook $playbook completed successfully on reachable hosts"
                SETUP_SUCCESS=true
            else
                echo "WARNING: Playbook $playbook failed or partially failed"
                echo "Some tasks may have failed. Check ansible output above."
                # Continue with other playbooks instead of exiting
            fi
        fi
    done

    if [ "$SETUP_SUCCESS" = false ]; then
        echo "ERROR: All setup playbooks failed"
        return 1
    fi
}

# Function to deploy Nomad job
run_deploy() {
    echo "Deploying Nomad job for $APP_NAME..."
    NOMAD_FILE="$APP_DIR/$APP_NAME.nomad"

    if [ ! -f "$NOMAD_FILE" ]; then
        echo "Warning: No Nomad job file found at $NOMAD_FILE"
        return
    fi

    # Special check for cloudflared - verify Consul KV is set up
    if [ "$APP_NAME" = "cloudflared" ]; then
        echo "Checking if Cloudflare tunnel token is in Consul KV..."
        
        # Try to check via any reachable Consul server
        CONSUL_CHECK_PASSED=false
        CONSUL_SERVERS=$(ansible-inventory -i inventory.yml --list | jq -r '.consul_servers.hosts[]' 2>/dev/null || echo "")
        
        for server in $CONSUL_SERVERS; do
            if ansible $server -i inventory.yml -m uri -a \
                "url=http://localhost:8500/v1/kv/cloudflared/tunnel_token method=GET" \
                --vault-password-file .vault_pass 2>/dev/null | grep -q "200"; then
                echo "✓ Cloudflare tunnel token found in Consul KV"
                CONSUL_CHECK_PASSED=true
                break
            fi
        done
        
        if [ "$CONSUL_CHECK_PASSED" = false ]; then
            echo "ERROR: Cloudflare tunnel token not found in Consul KV!"
            echo "The cloudflared job will fail without this token."
            echo ""
            echo "To fix this:"
            echo "1. Ensure Consul servers are reachable"
            echo "2. Run: ansible-playbook -i inventory.yml applications/cloudflared/setup-consul-kv.yml --vault-password-file .vault_pass"
            echo ""
            echo "Aborting deployment to prevent job failures."
            return 1
        fi
    fi

    # Initialize FULL_IMAGE variable
    FULL_IMAGE=""

    # Check for existing deployment and stop it
    echo "Checking for existing $APP_NAME deployment..."

    # Special handling for consul-ingress to stop old ingress systems
    if [ "$APP_NAME" = "consul-ingress" ]; then
        echo "Checking for legacy ingress deployments..."
        if [ -n "$NOMAD_ADDR" ]; then
            for old_ingress in "traefik" "haproxy-ingress"; do
                if nomad job status "$old_ingress" >/dev/null 2>&1; then
                    echo "Found existing $old_ingress deployment. Stopping it..."
                    nomad job stop -purge "$old_ingress" || echo "Warning: Failed to stop $old_ingress"
                    sleep 5
                fi
            done
        else
            # Try via Ansible
            NOMAD_SERVERS=$(ansible-inventory -i inventory.yml --list | jq -r '.nomad_servers.hosts[]' 2>/dev/null || echo "")
            for server in $NOMAD_SERVERS; do
                if ansible $server -i inventory.yml -m ping --vault-password-file .vault_pass -o >/dev/null 2>&1; then
                    for old_ingress in traefik haproxy-ingress; do
                        ansible $server -i inventory.yml -m shell -a "nomad job stop -purge $old_ingress 2>/dev/null || true" --vault-password-file .vault_pass >/dev/null 2>&1
                    done
                    break
                fi
            done
        fi
    fi

    if [ -n "$NOMAD_ADDR" ]; then
        # Use direct Nomad connection
        if nomad job status "$APP_NAME" >/dev/null 2>&1; then
            echo "Found existing $APP_NAME deployment. Stopping it..."
            if ! nomad job stop -purge "$APP_NAME"; then
                echo "ERROR: Failed to stop existing job $APP_NAME"
                exit 1
            fi
            echo "Waiting for cleanup..."
            sleep 5
        fi
    else
        # Use Ansible to check via remote Nomad server
        # Try all Nomad servers until we find one that's reachable
        NOMAD_SERVERS=$(ansible-inventory -i inventory.yml --list | jq -r '.nomad_servers.hosts[]' 2>/dev/null || echo "")

        FOUND_AND_STOPPED=false
        for server in $NOMAD_SERVERS; do
            if ansible $server -i inventory.yml -m ping --vault-password-file .vault_pass -o >/dev/null 2>&1; then
                echo "Checking for existing deployment on $server..."
                if ansible $server -i inventory.yml -m shell -a "nomad job status $APP_NAME" --vault-password-file .vault_pass >/dev/null 2>&1; then
                    echo "Found existing $APP_NAME deployment. Stopping it..."
                    if ansible $server -i inventory.yml -m shell -a "nomad job stop -purge $APP_NAME" --vault-password-file .vault_pass; then
                        echo "✓ Successfully stopped existing job"
                        FOUND_AND_STOPPED=true
                        echo "Waiting for cleanup..."
                        sleep 5
                        break
                    else
                        echo "WARNING: Failed to stop existing job via $server, trying next server..."
                    fi
                else
                    # Job doesn't exist, that's fine
                    break
                fi
            fi
        done

        if [ "$FOUND_AND_STOPPED" = false ] && [ -n "$NOMAD_SERVERS" ]; then
            echo "WARNING: Could not verify/stop existing deployment (servers may be unreachable)"
            echo "Proceeding with deployment anyway..."
        fi
    fi

    # Update Consul KV with latest image for supported apps
    if [[ "$APP_NAME" =~ ^(web|rindexer|discourse|email-service)$ ]]; then
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
            echo "WARNING: Could not retrieve GitHub token from vault."
            echo "Will use fallback methods to determine image tag."
        fi

        # Use GitHub API to get the latest successful build
        LATEST_SHA=""
        if [ -n "$GITHUB_TOKEN" ]; then
            echo "Checking GitHub API for latest successful build..."
            WORKFLOW_FILE="build-${APP_NAME}.yml"
            API_RESPONSE=$(curl -s -H "Authorization: token $GITHUB_TOKEN" \
                -H "Accept: application/vnd.github+json" \
                -H "X-GitHub-Api-Version: 2022-11-28" \
                "https://api.github.com/repos/proposals-app/proposalsapp/actions/workflows/${WORKFLOW_FILE}/runs?branch=main&status=success&per_page=1")

            LATEST_SHA=$(echo "$API_RESPONSE" | jq -r '.workflow_runs[0].head_sha[:7]' 2>/dev/null || echo "")
        fi

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
  "deployed_from": "$(hostname)",
  "manual_deployment": true
}
EOF
)

        # Update Consul KV with retry logic
        CONSUL_UPDATED=false
        REACHABLE_CONSUL_SERVERS=()

        # First, check which Consul servers are reachable
        echo "Checking Consul server connectivity..."
        for server in "${CONSUL_SERVERS[@]}"; do
            if ansible $server -i inventory.yml -m ping --vault-password-file .vault_pass -o >/dev/null 2>&1; then
                REACHABLE_CONSUL_SERVERS+=("$server")
                echo "✓ $server is reachable"
            else
                echo "✗ $server is not reachable"
            fi
        done

        if [ ${#REACHABLE_CONSUL_SERVERS[@]} -eq 0 ]; then
            echo "WARNING: No Consul servers are reachable!"
            echo "Proceeding with manual deployment without Consul KV update..."
        else
            # Try to update Consul KV on reachable servers
            for server in "${REACHABLE_CONSUL_SERVERS[@]}"; do
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
        fi

        if [ "$CONSUL_UPDATED" = false ]; then
            echo "WARNING: Failed to update Consul KV on available servers!"
            echo "Without Consul KV update, automated deployment will not trigger."
            echo "Proceeding with manual deployment..."
        else
            # Check if automated deployment is enabled
            echo "Checking for automated deployment service..."
            AUTOMATION_ENABLED=false
            for server in "${REACHABLE_CONSUL_SERVERS[@]}"; do
                if ansible $server -i inventory.yml -m systemd -a "name=deployment-checker.timer" --vault-password-file .vault_pass 2>/dev/null | grep -q "active (running)"; then
                    AUTOMATION_ENABLED=true
                    break
                fi
            done

            if [ "$AUTOMATION_ENABLED" = true ]; then
                echo "✓ Automated deployment is enabled and will handle the update."
                echo "The deployment handler will:"
                echo "  1. Detect the Consul KV change"
                echo "  2. Update the Nomad job with the new image"
                echo "  3. Perform a rolling update across all datacenters"
                echo ""
                echo "Monitor deployment progress with:"
                echo "  - Nomad: nomad job status $APP_NAME"
                echo "  - Logs: journalctl -u consul-deployment-watcher -f"
                echo "  - Handler logs: tail -f /var/log/deployment-handler.log"
                echo ""
                echo "Skipping manual deployment as automation will handle it."
                return 0
            else
                echo "ℹ️  Automated deployment is not enabled. Proceeding with manual deployment."
            fi
        fi
    fi

    # Check if NOMAD_ADDR is set
    if [ -z "$NOMAD_ADDR" ]; then
        echo "NOMAD_ADDR not set. Deploying via Ansible on first Nomad server..."

        # Get all Nomad servers from inventory
        NOMAD_SERVERS=$(ansible-inventory -i inventory.yml --list | jq -r '.nomad_servers.hosts[]' 2>/dev/null || echo "")

        if [ -z "$NOMAD_SERVERS" ]; then
            echo "Error: Could not find any Nomad servers in inventory"
            echo "Set NOMAD_ADDR environment variable or ensure nomad_servers group exists in inventory"
            return 1
        fi

        # Try each Nomad server until one works
        NOMAD_SERVER=""
        for server in $NOMAD_SERVERS; do
            echo "Checking connectivity to $server..."
            if ansible $server -i inventory.yml -m ping --vault-password-file .vault_pass -o >/dev/null 2>&1; then
                NOMAD_SERVER=$server
                echo "✓ Using Nomad server: $NOMAD_SERVER"
                break
            else
                echo "✗ Server $server is not reachable"
            fi
        done

        if [ -z "$NOMAD_SERVER" ]; then
            echo "Error: No reachable Nomad servers found!"
            echo "Tried servers: $NOMAD_SERVERS"
            return 1
        fi

        # Create a temporary job file with updated image
        TEMP_NOMAD_FILE="/tmp/${APP_NAME}_deploy_$$.nomad"
        cp "$NOMAD_FILE" "$TEMP_NOMAD_FILE"

        # Update the image in the job file if we have the full image
        if [ ! -z "$FULL_IMAGE" ]; then
            echo "Updating job file with image: $FULL_IMAGE"
            sed -i.bak "s|image = \".*\"|image = \"$FULL_IMAGE\"|g" "$TEMP_NOMAD_FILE"
        fi

        # Copy the job file to remote with vault password
        if ! ansible $NOMAD_SERVER -i inventory.yml -m copy \
            -a "src=$TEMP_NOMAD_FILE dest=/tmp/$APP_NAME.nomad" \
            --vault-password-file .vault_pass; then
            echo "ERROR: Failed to copy job file to $NOMAD_SERVER"
            rm -f "$TEMP_NOMAD_FILE" "$TEMP_NOMAD_FILE.bak"
            return 1
        fi

        # Run the job on remote
        echo "Deploying job to Nomad..."
        if ! ansible $NOMAD_SERVER -i inventory.yml -m shell \
            -a "nomad job run /tmp/$APP_NAME.nomad" \
            --vault-password-file .vault_pass; then
            echo "ERROR: Failed to deploy job to Nomad on $NOMAD_SERVER"
            # Clean up remote file
            ansible $NOMAD_SERVER -i inventory.yml -m file \
                -a "path=/tmp/$APP_NAME.nomad state=absent" \
                --vault-password-file .vault_pass
            rm -f "$TEMP_NOMAD_FILE" "$TEMP_NOMAD_FILE.bak"
            return 1
        fi

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
            return 1
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
