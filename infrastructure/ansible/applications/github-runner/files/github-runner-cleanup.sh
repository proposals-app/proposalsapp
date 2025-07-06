#!/bin/bash
# GitHub Runner Cleanup Script
# This script performs comprehensive cleanup when triggered by disk monitor
# Runs automatically when disk usage exceeds 80% threshold

set -euo pipefail

LOGFILE="/var/log/github-runner-cleanup.log"
MAX_LOG_SIZE=10485760  # 10MB

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"
}

# Rotate log if it's too large
if [ -f "$LOGFILE" ] && [ $(stat -c%s "$LOGFILE") -gt $MAX_LOG_SIZE ]; then
    mv "$LOGFILE" "$LOGFILE.old"
    gzip -f "$LOGFILE.old"
fi

log "Starting GitHub Runner cleanup"

# Get initial disk usage
INITIAL_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
log "Initial disk usage: ${INITIAL_USAGE}%"

# 1. Clean up Docker system (containers, images, build cache)
log "Cleaning Docker system..."
docker system prune -af --volumes 2>&1 | tee -a "$LOGFILE" || log "Warning: Docker system prune failed"

# 2. Clean up buildx cache (major space consumer)
log "Cleaning buildx cache..."
docker buildx prune -af 2>&1 | tee -a "$LOGFILE" || log "Warning: Docker buildx prune failed"

# 3. Remove old buildx builder instances and their volumes
log "Removing old buildx builders..."
for builder in $(docker buildx ls | grep -E "builder-[a-f0-9-]+" | awk '{print $1}'); do
    log "Removing builder: $builder"
    docker buildx rm "$builder" 2>&1 | tee -a "$LOGFILE" || log "Warning: Failed to remove builder $builder"
done

# 4. Clean up Docker volumes (especially buildx volumes)
log "Cleaning Docker volumes..."
docker volume prune -af 2>&1 | tee -a "$LOGFILE" || log "Warning: Docker volume prune failed"

# Remove specific buildx volumes that might be orphaned
for volume in $(docker volume ls -q | grep -E "buildx_buildkit_.*_state"); do
    log "Removing volume: $volume"
    docker volume rm "$volume" 2>&1 | tee -a "$LOGFILE" || log "Warning: Failed to remove volume $volume"
done

# 5. Clean up /var/cache/buildx if it exists
if [ -d "/var/cache/buildx" ]; then
    log "Cleaning /var/cache/buildx..."
    rm -rf /var/cache/buildx/* 2>&1 | tee -a "$LOGFILE" || log "Warning: Failed to clean /var/cache/buildx"
fi

# 6. Clean up runner user caches
RUNNER_HOME="/home/runner"
if [ -d "$RUNNER_HOME" ]; then
    # Clean Rust/Cargo cache
    if [ -d "$RUNNER_HOME/.cargo/git" ]; then
        log "Cleaning Cargo git cache..."
        rm -rf "$RUNNER_HOME/.cargo/git" 2>&1 | tee -a "$LOGFILE" || log "Warning: Failed to clean Cargo git cache"
    fi
    
    if [ -d "$RUNNER_HOME/.cargo/registry/cache" ]; then
        log "Cleaning Cargo registry cache..."
        rm -rf "$RUNNER_HOME/.cargo/registry/cache" 2>&1 | tee -a "$LOGFILE" || log "Warning: Failed to clean Cargo registry cache"
    fi
    
    # Clean Yarn cache
    if [ -d "$RUNNER_HOME/.yarn/berry/cache" ]; then
        log "Cleaning Yarn cache..."
        rm -rf "$RUNNER_HOME/.yarn/berry/cache" 2>&1 | tee -a "$LOGFILE" || log "Warning: Failed to clean Yarn cache"
    fi
    
    # Clean npm cache
    if [ -d "$RUNNER_HOME/.npm" ]; then
        log "Cleaning npm cache..."
        rm -rf "$RUNNER_HOME/.npm/_cacache" 2>&1 | tee -a "$LOGFILE" || log "Warning: Failed to clean npm cache"
    fi
    
    # Clean old runner work directories (older than 7 days)
    if [ -d "$RUNNER_HOME/_work" ]; then
        log "Cleaning old runner work directories..."
        find "$RUNNER_HOME/_work" -type d -name "_temp" -mtime +7 -exec rm -rf {} + 2>&1 | tee -a "$LOGFILE" || true
        find "$RUNNER_HOME/_work" -type f -name "*.log" -mtime +7 -delete 2>&1 | tee -a "$LOGFILE" || true
    fi
    
    # Clean tool cache
    if [ -d "$RUNNER_HOME/_work/_tool_cache" ]; then
        log "Cleaning old tool cache entries..."
        find "$RUNNER_HOME/_work/_tool_cache" -type d -mtime +30 -exec rm -rf {} + 2>&1 | tee -a "$LOGFILE" || true
    fi
fi

# 7. Clean system package caches
log "Cleaning apt cache..."
apt-get clean 2>&1 | tee -a "$LOGFILE" || log "Warning: Failed to clean apt cache"

# 8. Clean tmp directories
log "Cleaning tmp directories..."
find /tmp -type f -atime +7 -delete 2>&1 | tee -a "$LOGFILE" || true
find /var/tmp -type f -atime +7 -delete 2>&1 | tee -a "$LOGFILE" || true

# 9. Clean old log files
log "Cleaning old log files..."
find /var/log -type f -name "*.log" -mtime +30 -exec gzip {} + 2>&1 | tee -a "$LOGFILE" || true
find /var/log -type f -name "*.gz" -mtime +90 -delete 2>&1 | tee -a "$LOGFILE" || true

# Get final disk usage
FINAL_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
SPACE_FREED=$((INITIAL_USAGE - FINAL_USAGE))

log "Cleanup complete. Final disk usage: ${FINAL_USAGE}% (freed ${SPACE_FREED}%)"

# Alert if disk usage is still high
if [ "$FINAL_USAGE" -gt 85 ]; then
    log "WARNING: Disk usage is still above 85% after cleanup!"
fi

exit 0