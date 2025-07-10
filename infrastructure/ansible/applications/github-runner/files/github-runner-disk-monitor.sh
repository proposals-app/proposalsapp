#!/bin/bash
# GitHub Runner Disk Space Monitor - Consolidated Version
# This script monitors disk usage and triggers cleanup at different thresholds
# with special focus on buildx cache issues

set -euo pipefail

# Configuration
SOFT_THRESHOLD=65    # Proactive cleanup when no jobs running (lowered from 70)
HARD_THRESHOLD=75    # Force cleanup even if jobs running (lowered from 80)
CRITICAL_THRESHOLD=85 # Emergency cleanup - stop jobs if needed (lowered from 90)
CHECK_PATH="/"
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
        local container_count=$(docker ps -q --filter "label=com.github.actions.workflow" 2>/dev/null | wc -l || echo "0")
        if [ "$container_count" -gt 0 ]; then
            return 0  # Active
        fi
    fi
    
    # Check for buildx build processes
    if pgrep -f "docker.*buildx.*build" > /dev/null 2>&1; then
        return 0  # Active
    fi
    
    return 1  # Not active
}

# Function to check buildx cache sizes
check_buildx_usage() {
    local total_size=0
    
    # Check /var/cache/buildx
    if [ -d "/var/cache/buildx" ]; then
        local cache_size=$(du -sb /var/cache/buildx 2>/dev/null | awk '{print $1}' || echo "0")
        total_size=$((total_size + cache_size))
        log "Buildx cache: $(du -sh /var/cache/buildx 2>/dev/null | awk '{print $1}' || echo '0')"
    fi
    
    # Check buildx volumes - improved detection
    local volume_sizes=0
    local volume_count=0
    for volume in $(docker volume ls -q | grep -E "buildx_buildkit_.*|buildkit.*" 2>/dev/null || true); do
        if [ -n "$volume" ]; then
            local mount_point=$(docker volume inspect "$volume" 2>/dev/null | jq -r '.[0].Mountpoint' || echo "")
            if [ -n "$mount_point" ] && [ -d "$mount_point" ]; then
                local vol_size=$(du -sb "$mount_point" 2>/dev/null | awk '{print $1}' || echo "0")
                volume_sizes=$((volume_sizes + vol_size))
                volume_count=$((volume_count + 1))
            fi
        fi
    done
    
    if [ "$volume_count" -gt 0 ]; then
        total_size=$((total_size + volume_sizes))
        log "Buildx volumes ($volume_count found): $(echo $volume_sizes | numfmt --to=iec-i --suffix=B 2>/dev/null || echo "${volume_sizes} bytes")"
    fi
    
    # Check user's buildx directory
    if [ -d "$RUNNER_HOME/.docker/buildx" ]; then
        local user_buildx_size=$(du -sb "$RUNNER_HOME/.docker/buildx" 2>/dev/null | awk '{print $1}' || echo "0")
        total_size=$((total_size + user_buildx_size))
        log "User buildx directory: $(du -sh "$RUNNER_HOME/.docker/buildx" 2>/dev/null | awk '{print $1}' || echo '0')"
    fi
    
    # Convert to GB for easier comparison
    local total_gb=$((total_size / 1073741824))
    
    # If buildx is using more than 10GB, it's a problem (lowered threshold)
    if [ "$total_gb" -gt 10 ]; then
        log "WARNING: Buildx cache using ${total_gb}GB - cleanup recommended"
        return 0  # Indicates cleanup needed
    fi
    
    # Also check if /var/cache/buildx alone is over 5GB
    if [ -d "/var/cache/buildx" ]; then
        local cache_gb=$((cache_size / 1073741824))
        if [ "$cache_gb" -gt 5 ]; then
            log "WARNING: /var/cache/buildx alone is ${cache_gb}GB - cleanup recommended"
            return 0
        fi
    fi
    
    return 1  # No cleanup needed
}

# Rotate log if it's too large
if [ -f "$LOGFILE" ] && [ $(stat -c%s "$LOGFILE") -gt $MAX_LOG_SIZE ]; then
    mv "$LOGFILE" "$LOGFILE.old"
    gzip -f "$LOGFILE.old"
fi

# Get current disk usage percentage
CURRENT_USAGE=$(df -h "$CHECK_PATH" | awk 'NR==2 {print $5}' | sed 's/%//')

log "========================================="
log "Disk usage check: ${CURRENT_USAGE}% (soft: ${SOFT_THRESHOLD}%, hard: ${HARD_THRESHOLD}%, critical: ${CRITICAL_THRESHOLD}%)"

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

# Determine if we need cleanup
NEEDS_CLEANUP=false
CLEANUP_REASON=""
FORCE_CLEANUP=false

# Check disk usage thresholds
if [ "$CURRENT_USAGE" -ge "$CRITICAL_THRESHOLD" ]; then
    NEEDS_CLEANUP=true
    FORCE_CLEANUP=true
    CLEANUP_REASON="CRITICAL disk usage (${CURRENT_USAGE}%)"
elif [ "$CURRENT_USAGE" -ge "$HARD_THRESHOLD" ]; then
    NEEDS_CLEANUP=true
    CLEANUP_REASON="High disk usage (${CURRENT_USAGE}%)"
elif [ "$CURRENT_USAGE" -ge "$SOFT_THRESHOLD" ]; then
    # Only cleanup at soft threshold if no jobs are running
    if ! is_runner_active; then
        NEEDS_CLEANUP=true
        CLEANUP_REASON="Proactive cleanup at ${CURRENT_USAGE}%"
    else
        log "Disk usage at ${CURRENT_USAGE}% but jobs are running, deferring cleanup"
    fi
fi

# Always check buildx cache size regardless of disk usage
if check_buildx_usage; then
    if [ "$NEEDS_CLEANUP" = false ] && ! is_runner_active; then
        NEEDS_CLEANUP=true
        CLEANUP_REASON="Large buildx cache detected"
    fi
fi

# Perform cleanup if needed
if [ "$NEEDS_CLEANUP" = true ]; then
    log "ALERT: Cleanup needed - $CLEANUP_REASON"
    
    # Check if runner is active (unless forced)
    if [ "$FORCE_CLEANUP" = false ] && is_runner_active; then
        log "GitHub Actions job is currently running, checking if we can defer..."
        
        # If we're above hard threshold but below critical, defer
        if [ "$CURRENT_USAGE" -lt "$CRITICAL_THRESHOLD" ]; then
            log "Deferring cleanup until job completes"
            exit 0
        else
            log "CRITICAL: Cannot defer cleanup at ${CURRENT_USAGE}% usage"
        fi
    fi
    
    if [ "$FORCE_CLEANUP" = true ] && is_runner_active; then
        log "WARNING: Critical disk usage - cleanup will proceed despite active jobs"
        # Note: The cleanup script will handle stopping containers gracefully
    fi
    
    log "Proceeding with cleanup"
    
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
            log "Cleanup completed. New disk usage: ${NEW_USAGE}% (freed ${SPACE_FREED}%)"
            
            # If still above hard threshold, log a warning
            if [ "$NEW_USAGE" -ge "$HARD_THRESHOLD" ]; then
                log "⚠️  WARNING: Disk usage still above ${HARD_THRESHOLD}% after cleanup!"
                
                # Send alert or notification here if configured
                # For example: echo "Disk usage critical on $(hostname)" | mail -s "Runner Disk Alert" admin@example.com
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
    log "Disk usage is acceptable, no cleanup needed"
fi

log "Monitor check complete"
exit 0