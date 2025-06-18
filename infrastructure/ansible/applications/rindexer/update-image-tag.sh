#!/bin/bash
# Script to update rindexer image tag in Consul KV
# This can be called by GitHub Actions or manually

set -e

# Parse arguments
BRANCH=""
IMAGE_TAG=""
CONSUL_URL="${CONSUL_URL:-http://localhost:8500}"
CONSUL_TOKEN="${CONSUL_TOKEN:-}"

show_usage() {
    echo "Usage: $0 --branch=<branch> --tag=<tag>"
    echo "Updates the Docker image tag for a specific branch in Consul KV"
    echo ""
    echo "Options:"
    echo "  --branch=<branch>    Branch name"
    echo "  --tag=<tag>         Docker image tag"
    echo ""
    echo "Environment variables:"
    echo "  CONSUL_URL          Consul API URL (default: http://localhost:8500)"
    echo "  CONSUL_TOKEN        Consul ACL token (if required)"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --branch=*)
            BRANCH="${1#*=}"
            shift
            ;;
        --tag=*)
            IMAGE_TAG="${1#*=}"
            shift
            ;;
        --help|-h)
            show_usage
            exit 0
            ;;
        *)
            echo "Error: Unknown parameter '$1'"
            show_usage
            exit 1
            ;;
    esac
done

# Validate arguments
if [ -z "$BRANCH" ] || [ -z "$IMAGE_TAG" ]; then
    echo "Error: Both --branch and --tag are required"
    show_usage
    exit 1
fi

# Function to update Consul KV
update_consul_kv() {
    local key=$1
    local value=$2
    
    echo "Updating Consul KV: $key = $value"
    
    HEADERS=""
    if [ -n "$CONSUL_TOKEN" ]; then
        HEADERS="-H X-Consul-Token:$CONSUL_TOKEN"
    fi
    
    curl -s -X PUT $HEADERS "$CONSUL_URL/v1/kv/$key" -d "$value" || {
        echo "Error: Failed to update Consul KV"
        exit 1
    }
}

# Update the image tag for the specific branch
update_consul_kv "rindexer/image/$BRANCH" "$IMAGE_TAG"

# If this is the current branch, trigger a redeploy
CURRENT_BRANCH=$(curl -s "$CONSUL_URL/v1/kv/rindexer/branch?raw" 2>/dev/null || echo "main")

if [ "$BRANCH" = "$CURRENT_BRANCH" ]; then
    echo "This is the current active branch. The rindexer service will be redeployed automatically."
else
    echo "Updated image tag for branch $BRANCH"
    echo "To deploy this branch, run:"
    echo "  consul kv put rindexer/branch '$BRANCH'"
    echo "Or:"
    echo "  ./deploy-application.sh rindexer setup --branch=$BRANCH"
fi

echo "Done!"