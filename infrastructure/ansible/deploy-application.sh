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
VALID_APPS="rindexer discourse"

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

        # Copy the job file to remote
        ansible $NOMAD_SERVER -i inventory.yml -m copy -a "src=$NOMAD_FILE dest=/tmp/$APP_NAME.nomad" || exit 1

        # Run the job on remote
        ansible $NOMAD_SERVER -i inventory.yml -m shell -a "nomad job run /tmp/$APP_NAME.nomad" || exit 1

        # Clean up
        ansible $NOMAD_SERVER -i inventory.yml -m file -a "path=/tmp/$APP_NAME.nomad state=absent"
    else
        echo "Using NOMAD_ADDR: $NOMAD_ADDR"
        echo "Executing: nomad job run $NOMAD_FILE"
        nomad job run "$NOMAD_FILE"
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
