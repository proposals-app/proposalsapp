#!/bin/bash
# Simple deployment verification script

set -e

echo "=== Deployment Pipeline Status ==="
echo

# Check automation timer
echo "1. Automation Status:"
if ansible consul-nomad-sib-01 -i inventory.yml -m systemd -a "name=deployment-checker.timer" --vault-password-file .vault_pass 2>/dev/null | grep -q '"ActiveState": "active"'; then
    echo "   ✓ Deployment timer is active"
    
    # Show last run
    LAST_RUN=$(ansible consul-nomad-sib-01 -i inventory.yml -m shell -a "systemctl show -p ExecMainStartTimestamp deployment-checker.service --value" --vault-password-file .vault_pass 2>/dev/null | grep -v PLAY | grep -v TASK | grep -v ok: | tail -1)
    echo "   Last run: $LAST_RUN"
else
    echo "   ✗ Deployment automation not active"
    echo "   Run: ansible-playbook -i inventory.yml playbooks/setup-deployment-automation-simple.yml"
fi

echo
echo "2. Recent Deployments:"
ansible consul-nomad-sib-01 -i inventory.yml -m shell -a "tail -5 /var/log/deployment-checker.log 2>/dev/null | grep -E 'detected|deployed|ERROR' || echo 'No recent activity'" --vault-password-file .vault_pass 2>/dev/null | grep -v PLAY | grep -v TASK | grep -v ok: | tail -5

echo
echo "3. Application Status:"
for app in web rindexer discourse mapper; do
    # Check if job exists in Nomad
    JOB_STATUS=$(ansible consul-nomad-sib-01 -i inventory.yml -m shell -a "nomad job status $app 2>&1 | head -1" --vault-password-file .vault_pass 2>/dev/null | grep -v PLAY | grep -v TASK | grep -v ok: | tail -1)
    
    if echo "$JOB_STATUS" | grep -q "not found"; then
        echo "   $app: ✗ Not deployed"
    else
        # Get running count
        RUNNING=$(ansible consul-nomad-sib-01 -i inventory.yml -m shell -a "nomad job status $app | grep -c running || echo 0" --vault-password-file .vault_pass 2>/dev/null | grep -v PLAY | grep -v TASK | grep -v ok: | tail -1)
        echo "   $app: ✓ Running ($RUNNING instances)"
    fi
done

echo
echo "=== Monitoring Commands ==="
echo "• Check timer: systemctl status deployment-checker.timer"
echo "• View logs: tail -f /var/log/deployment-checker.log"
echo "• Job status: nomad job status <app>"
echo "• Manual check: /opt/deployment/deployment-checker.sh"