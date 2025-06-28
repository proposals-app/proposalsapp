#!/bin/bash
# Deploy Homepage Dashboard to ProposalsApp Infrastructure

set -e

echo "🚀 Deploying Homepage Dashboard..."

cd "$(dirname "$0")"

# Deploy using the same method as other applications
if [ -f "ansible/deploy-application.sh" ]; then
    echo "📝 Creating Homepage application directory..."
    mkdir -p ansible/applications/homepage
    
    # Copy the Nomad job to the applications directory
    if [ -f "nomad-jobs/homepage-enhanced.nomad" ]; then
        echo "Using enhanced Homepage configuration..."
        cp nomad-jobs/homepage-enhanced.nomad ansible/applications/homepage/homepage.nomad
    else
        echo "Using standard Homepage configuration..."
        cp nomad-jobs/homepage.nomad ansible/applications/homepage/homepage.nomad
    fi
    
    # Deploy using the standard deployment script
    cd ansible
    ./deploy-application.sh homepage
    cd ..
else
    # Fallback to manual deployment via Ansible
    echo "⚠️  Standard deployment script not found. Using manual deployment..."
    
    # Get the first Nomad server from inventory
    cd ansible
    NOMAD_SERVER=$(ansible-inventory -i inventory.yml --list | jq -r '.nomad_servers.hosts[0]' 2>/dev/null || echo "consul-nomad-sib-01")
    
    if [ -z "$NOMAD_SERVER" ]; then
        echo "❌ Error: Could not find a Nomad server in inventory"
        exit 1
    fi
    
    echo "Using Nomad server: $NOMAD_SERVER"
    
    # Set up Consul KV configuration (optional)
    if [ -f "applications/homepage/setup-consul-kv.yml" ]; then
        echo "📝 Setting up Consul KV configuration..."
        ansible-playbook -i inventory.yml applications/homepage/setup-consul-kv.yml --vault-password-file .vault_pass || true
    fi
    
    # Copy and deploy the Nomad job
    NOMAD_FILE="../nomad-jobs/homepage-enhanced.nomad"
    if [ ! -f "$NOMAD_FILE" ]; then
        NOMAD_FILE="../nomad-jobs/homepage.nomad"
    fi
    
    echo "📦 Deploying Homepage to Nomad via $NOMAD_SERVER..."
    
    # Copy the job file to remote
    ansible $NOMAD_SERVER -i inventory.yml -m copy \
        -a "src=$NOMAD_FILE dest=/tmp/homepage.nomad" \
        --vault-password-file .vault_pass || exit 1
    
    # Check for existing deployment and stop it
    echo "Checking for existing homepage deployment..."
    if ansible $NOMAD_SERVER -i inventory.yml -m shell -a "nomad job status homepage" --vault-password-file .vault_pass >/dev/null 2>&1; then
        echo "Found existing homepage deployment. Stopping it..."
        ansible $NOMAD_SERVER -i inventory.yml -m shell -a "nomad job stop -purge homepage" --vault-password-file .vault_pass
        echo "Waiting for cleanup..."
        sleep 5
    fi
    
    # Run the job on remote
    echo "Deploying job to Nomad..."
    ansible $NOMAD_SERVER -i inventory.yml -m shell \
        -a "nomad job run /tmp/homepage.nomad" \
        --vault-password-file .vault_pass || exit 1
    
    # Clean up
    ansible $NOMAD_SERVER -i inventory.yml -m file \
        -a "path=/tmp/homepage.nomad state=absent" \
        --vault-password-file .vault_pass
    
    cd ..
fi

# Wait for deployment
echo "⏳ Waiting for deployment to complete..."
sleep 10

# Check deployment status
if nomad job status homepage > /dev/null 2>&1; then
    echo "✅ Homepage deployed successfully!"
    echo ""
    echo "🌐 Access your dashboard at: http://dashboard.proposals.app"
    echo ""
    echo "📊 Service Status:"
    nomad job status homepage | grep -A 5 "Allocations"
    echo ""
    echo "💡 Tips:"
    echo "   - The dashboard will auto-discover services via Consul"
    echo "   - Health checks update every 10 seconds"
    echo "   - Customize by editing the Nomad job file"
    echo "   - View logs: nomad alloc logs -f \$(nomad job status homepage | grep running | awk '{print \$1}')"
else
    echo "❌ Deployment failed. Check Nomad logs for details."
    exit 1
fi