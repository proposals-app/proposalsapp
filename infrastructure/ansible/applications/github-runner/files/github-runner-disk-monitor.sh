#!/bin/bash
# GitHub Runner Disk Space Monitor
# This script monitors disk usage and triggers cleanup when threshold is reached

set -euo pipefail

# Configuration
DISK_THRESHOLD=80  # Trigger cleanup when disk usage reaches this percentage
CHECK_PATH="/"     # Path to monitor
LOGFILE="/var/log/github-runner-disk-monitor.log"
MAX_LOG_SIZE=10485760  # 10MB
CLEANUP_SCRIPT="/usr/local/bin/github-runner-cleanup.sh"
LOCKFILE="/var/run/github-runner-cleanup.lock"
RUNNER_HOME="/home/runner"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"
}

# Function to check if GitHub Actions jobs are running
is_runner_active() {
    # Check for Runner.Worker processes (indicates active job)
    if pgrep -f "Runner.Worker" > /dev/null 2>&1; then
        return 0  # Active
    fi
    
    # Check for active docker containers from runner
    if [ -d "$RUNNER_HOME" ]; then
        # Count containers created by the runner user
        local container_count=$(docker ps -q --filter "label=com.github.actions.workflow" 2>/dev/null | wc -l || echo "0")
        if [ "$container_count" -gt 0 ]; then
            return 0  # Active
        fi
    fi
    
    # Check for buildx build processes
    if pgrep -f "docker.*buildx.*build" > /dev/null 2>&1; then
        return 0  # Active
    fi
    
    # Check if runner service is in "Listening" state (idle) vs "Running" state (active)
    local runner_status=$(systemctl show -p SubState --value actions.runner.* 2>/dev/null || echo "unknown")
    if [ "$runner_status" = "running" ]; then
        # Additional check: look for runner process with active child processes
        local runner_pid=$(pgrep -f "Runner.Listener" 2>/dev/null | head -1)
        if [ -n "$runner_pid" ]; then
            local child_count=$(pgrep -P "$runner_pid" 2>/dev/null | wc -l || echo "0")
            if [ "$child_count" -gt 1 ]; then
                return 0  # Active (has child processes beyond normal)
            fi
        fi
    fi
    
    return 1  # Not active
}

# Rotate log if it's too large
if [ -f "$LOGFILE" ] && [ $(stat -c%s "$LOGFILE") -gt $MAX_LOG_SIZE ]; then
    mv "$LOGFILE" "$LOGFILE.old"
    gzip -f "$LOGFILE.old"
fi

# Get current disk usage percentage
CURRENT_USAGE=$(df -h "$CHECK_PATH" | awk 'NR==2 {print $5}' | sed 's/%//')

log "Disk usage check: ${CURRENT_USAGE}% (threshold: ${DISK_THRESHOLD}%)"

# Check if cleanup is already running
if [ -f "$LOCKFILE" ]; then
    LOCK_AGE=$(( $(date +%s) - $(stat -c %Y "$LOCKFILE" 2>/dev/null || echo 0) ))
    if [ $LOCK_AGE -lt 3600 ]; then  # If lock is less than 1 hour old
        log "Cleanup is already running (lock age: ${LOCK_AGE}s), skipping"
        exit 0
    else
        log "Removing stale lock file (age: ${LOCK_AGE}s)"
        rm -f "$LOCKFILE"
    fi
fi

# Check if we need to run cleanup
if [ "$CURRENT_USAGE" -ge "$DISK_THRESHOLD" ]; then
    log "ALERT: Disk usage (${CURRENT_USAGE}%) exceeds threshold (${DISK_THRESHOLD}%)"
    
    # Check if runner is active
    if is_runner_active; then
        log "GitHub Actions job is currently running, deferring cleanup"
        exit 0
    fi
    
    log "No active GitHub Actions jobs detected, proceeding with cleanup"
    
    # Create lock file
    touch "$LOCKFILE"
    
    # Trigger cleanup
    if [ -x "$CLEANUP_SCRIPT" ]; then
        log "Running cleanup script..."
        "$CLEANUP_SCRIPT" 2>&1 | tee -a "$LOGFILE"
        CLEANUP_EXIT=$?
        
        # Remove lock file
        rm -f "$LOCKFILE"
        
        if [ $CLEANUP_EXIT -eq 0 ]; then
            # Get new disk usage
            NEW_USAGE=$(df -h "$CHECK_PATH" | awk 'NR==2 {print $5}' | sed 's/%//')
            SPACE_FREED=$((CURRENT_USAGE - NEW_USAGE))
            log "Cleanup completed successfully. New disk usage: ${NEW_USAGE}% (freed ${SPACE_FREED}%)"
            
            # If still above threshold, log a warning
            if [ "$NEW_USAGE" -ge "$DISK_THRESHOLD" ]; then
                log "WARNING: Disk usage still above threshold after cleanup!"
            fi
        else
            log "ERROR: Cleanup script failed with exit code $CLEANUP_EXIT"
        fi
    else
        log "ERROR: Cleanup script not found or not executable: $CLEANUP_SCRIPT"
        rm -f "$LOCKFILE"
        exit 1
    fi
else
    log "Disk usage is below threshold, no cleanup needed"
fi

exit 0