#!/bin/bash
# Deploy script for Discourse Forum - a self-contained forum application

set +e  # Don't exit on error - we'll handle errors gracefully

# Function to show usage
show_usage() {
    echo "Usage: $0 [action]"
    echo "Actions: setup, deploy, both (default)"
    echo ""
    echo "Discourse Forum is a self-contained deployment that includes:"
    echo "  - PostgreSQL 17 database"
    echo "  - Redis 7 cache"
    echo "  - Discourse application (Bitnami image)"
    echo "  - Sidekiq background job processor"
    echo ""
    echo "Examples:"
    echo "  $0              # Run both setup and deploy"
    echo "  $0 setup        # Only run Consul KV setup"
    echo "  $0 deploy       # Only deploy the Nomad job"
}

ACTION=${1:-both}
APP_NAME="discourse-forum"
APP_DIR="applications/$APP_NAME"

cd "$(dirname "$0")"

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
            
            # For Consul KV setup, only check consul servers
            if [[ "$playbook" =~ "setup-consul-kv" ]]; then
                TARGET_HOSTS=$(ansible-inventory -i inventory.yml --list | jq -r '.consul_servers.hosts[]' 2>/dev/null || echo "")
            else
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
        echo "Error: No Nomad job file found at $NOMAD_FILE"
        return 1
    fi

    echo ""
    echo "⚠️  IMPORTANT: Discourse Forum Requirements"
    echo "==========================================="
    echo "1. Requires 20GB of persistent storage"
    echo "2. All data stored in Nomad allocation directory"
    echo "3. PostgreSQL and Redis are job-internal only"
    echo "4. Initial setup wizard runs on first access"
    echo "5. SMTP must be configured for email functionality"
    echo ""
    echo "Post-deployment steps:"
    echo "1. Update consul-ingress.nomad to add forum.proposals.app routing"
    echo "2. Access the forum and complete the setup wizard"
    echo "3. Configure categories, permissions, and SSO if needed"
    echo "4. Set up regular backups of the /alloc/data directory"
    echo "==========================================="
    echo ""
    read -p "Continue with deployment? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled"
        return 1
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

        # Check for existing deployment and stop it
        echo "Checking for existing $APP_NAME deployment..."
        if ansible $NOMAD_SERVER -i inventory.yml -m shell -a "nomad job status $APP_NAME" --vault-password-file .vault_pass >/dev/null 2>&1; then
            echo "Found existing $APP_NAME deployment. Stopping it..."
            if ansible $NOMAD_SERVER -i inventory.yml -m shell -a "nomad job stop -purge $APP_NAME" --vault-password-file .vault_pass; then
                echo "✓ Successfully stopped existing job"
                echo "Waiting for cleanup..."
                sleep 5
            else
                echo "WARNING: Failed to stop existing job"
            fi
        fi

        # Copy the job file to remote
        if ! ansible $NOMAD_SERVER -i inventory.yml -m copy \
            -a "src=$NOMAD_FILE dest=/tmp/$APP_NAME.nomad" \
            --vault-password-file .vault_pass; then
            echo "ERROR: Failed to copy job file to $NOMAD_SERVER"
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
            return 1
        fi

        echo "✅ Job deployed successfully"
        echo "Checking deployment status..."
        ansible $NOMAD_SERVER -i inventory.yml -m shell \
            -a "nomad job status $APP_NAME | head -20" \
            --vault-password-file .vault_pass

        # Clean up
        ansible $NOMAD_SERVER -i inventory.yml -m file \
            -a "path=/tmp/$APP_NAME.nomad state=absent" \
            --vault-password-file .vault_pass
    else
        echo "Using NOMAD_ADDR: $NOMAD_ADDR"

        # Check for existing deployment and stop it
        echo "Checking for existing $APP_NAME deployment..."
        if nomad job status "$APP_NAME" >/dev/null 2>&1; then
            echo "Found existing $APP_NAME deployment. Stopping it..."
            if ! nomad job stop -purge "$APP_NAME"; then
                echo "ERROR: Failed to stop existing job $APP_NAME"
                return 1
            fi
            echo "Waiting for cleanup..."
            sleep 5
        fi

        echo "Executing: nomad job run $NOMAD_FILE"
        echo "Deploying job to Nomad..."
        if ! nomad job run "$NOMAD_FILE"; then
            echo "ERROR: Failed to deploy job to Nomad"
            return 1
        fi

        echo "✅ Job deployed successfully"
        echo "Checking deployment status..."
        sleep 3
        nomad job status "$APP_NAME" | head -20
    fi

    echo ""
    echo "==========================================="
    echo "Discourse Forum deployment initiated!"
    echo ""
    echo "The forum will be available at:"
    echo "  https://forum.proposals.app (after configuring ingress)"
    echo ""
    echo "Monitor the deployment:"
    echo "  nomad job status discourse-forum"
    echo "  nomad alloc logs <alloc-id> postgresql"
    echo "  nomad alloc logs <alloc-id> redis"
    echo "  nomad alloc logs <alloc-id> discourse"
    echo "==========================================="
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
    -h|--help)
        show_usage
        exit 0
        ;;
    *)
        echo "Error: Unknown action '$ACTION'. Use: setup, deploy, or both"
        show_usage
        exit 1
        ;;
esac

echo "Done!"