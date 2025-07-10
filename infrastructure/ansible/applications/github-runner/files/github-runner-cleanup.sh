#!/bin/bash
# GitHub Runner Cleanup Script - Consolidated Version
# This script performs comprehensive cleanup with focus on buildx caches
# which are the primary cause of disk space issues

set -euo pipefail

# Configuration
LOGFILE="/var/log/github-runner-cleanup.log"
MAX_LOG_SIZE=10485760  # 10MB
RUNNER_HOME="/home/runner"

# Thresholds
AGGRESSIVE_CLEANUP_THRESHOLD=90  # Perform aggressive cleanup above this %
CRITICAL_CLEANUP_THRESHOLD=95    # Emergency cleanup above this %

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOGFILE"
}

# Function to get disk usage percentage
get_disk_usage() {
    df -h / | awk 'NR==2 {print $5}' | sed 's/%//'
}

# Rotate log if it's too large
if [ -f "$LOGFILE" ] && [ $(stat -c%s "$LOGFILE") -gt $MAX_LOG_SIZE ]; then
    mv "$LOGFILE" "$LOGFILE.old"
    gzip -f "$LOGFILE.old"
fi

log "========================================="
log "Starting GitHub Runner cleanup"
log "========================================="

# Get initial disk usage
INITIAL_USAGE=$(get_disk_usage)
log "Initial disk usage: ${INITIAL_USAGE}%"

# Determine cleanup level based on disk usage
CLEANUP_LEVEL="normal"
if [ "$INITIAL_USAGE" -ge "$CRITICAL_CLEANUP_THRESHOLD" ]; then
    CLEANUP_LEVEL="critical"
    log "CRITICAL: Disk usage is above ${CRITICAL_CLEANUP_THRESHOLD}%, performing emergency cleanup"
elif [ "$INITIAL_USAGE" -ge "$AGGRESSIVE_CLEANUP_THRESHOLD" ]; then
    CLEANUP_LEVEL="aggressive"
    log "WARNING: Disk usage is above ${AGGRESSIVE_CLEANUP_THRESHOLD}%, performing aggressive cleanup"
fi

# 1. Clean buildx cache - PRIMARY DISK SPACE CONSUMER
log "=== Cleaning Docker buildx cache (primary space consumer) ==="

# Remove /var/cache/buildx completely (can use 65GB+)
if [ -d "/var/cache/buildx" ]; then
    SIZE=$(du -sh /var/cache/buildx 2>/dev/null | awk '{print $1}' || echo "unknown")
    log "Removing /var/cache/buildx (size: $SIZE)..."
    # Use sudo to ensure we can delete all files
    sudo rm -rf /var/cache/buildx/* 2>&1 | tee -a "$LOGFILE" || log "Warning: Failed to clean /var/cache/buildx"
    # Recreate directory with proper permissions
    sudo mkdir -p /var/cache/buildx
    sudo chown runner:runner /var/cache/buildx
fi

# Clean buildx builder cache (before removing builders)
log "Cleaning buildx builder cache..."
docker buildx prune -af --verbose 2>&1 | tee -a "$LOGFILE" || log "Warning: Docker buildx prune failed"

# Remove all buildx builders and their volumes (can use 34GB+ per builder)
log "Removing all buildx builders and volumes..."
# Get all builders except 'default'
for builder in $(docker buildx ls --format '{{.Name}}' 2>/dev/null | grep -v '^default$' || true); do
    if [ -n "$builder" ]; then
        log "Removing builder: $builder"
        docker buildx rm "$builder" --force 2>&1 | tee -a "$LOGFILE" || log "Warning: Failed to remove builder $builder"
    fi
done

# Clean any leftover buildkit instances
log "Cleaning leftover buildkit containers..."
docker ps -a --filter "name=buildx_buildkit_" --format "{{.Names}}" | while read container; do
    if [ -n "$container" ]; then
        log "Removing buildkit container: $container"
        docker rm -f "$container" 2>&1 | tee -a "$LOGFILE" || true
    fi
done

# 2. Clean Docker system
log "=== Cleaning Docker system ==="

# Stop all containers if in aggressive mode
if [ "$CLEANUP_LEVEL" != "normal" ]; then
    log "Stopping all Docker containers..."
    docker stop $(docker ps -aq) 2>/dev/null || true
fi

# Remove stopped containers
log "Removing stopped containers..."
docker container prune -f 2>&1 | tee -a "$LOGFILE" || log "Warning: Failed to prune containers"

# Clean up Docker volumes (especially buildx volumes)
log "Cleaning Docker volumes..."
docker volume prune -af 2>&1 | tee -a "$LOGFILE" || log "Warning: Docker volume prune failed"

# Remove orphaned buildx volumes specifically
log "Looking for buildx volumes to remove..."
BUILDX_VOLUMES=$(docker volume ls -q | grep -E "buildx_buildkit_.*|buildkit.*" || true)
if [ -n "$BUILDX_VOLUMES" ]; then
    for volume in $BUILDX_VOLUMES; do
        log "Removing buildx volume: $volume"
        docker volume rm -f "$volume" 2>&1 | tee -a "$LOGFILE" || log "Warning: Failed to remove volume $volume"
    done
else
    log "No buildx volumes found"
fi

# Also check for buildx cache in user's docker directory
if [ -d "$RUNNER_HOME/.docker/buildx" ]; then
    BUILDX_SIZE=$(du -sh "$RUNNER_HOME/.docker/buildx" 2>/dev/null | awk '{print $1}' || echo "unknown")
    log "Cleaning user buildx directory (size: $BUILDX_SIZE)..."
    rm -rf "$RUNNER_HOME/.docker/buildx/cache" 2>&1 | tee -a "$LOGFILE" || true
fi

# Clean Docker build cache
log "Cleaning Docker build cache..."
docker builder prune -af 2>&1 | tee -a "$LOGFILE" || log "Warning: Docker builder prune failed"

# Clean regular Docker cache
docker system prune -af --volumes 2>&1 | tee -a "$LOGFILE" || log "Warning: Docker system prune failed"

# 3. Clean images based on cleanup level
if [ "$CLEANUP_LEVEL" = "critical" ]; then
    log "CRITICAL: Removing ALL Docker images..."
    docker rmi $(docker images -aq) 2>/dev/null || true
elif [ "$CLEANUP_LEVEL" = "aggressive" ]; then
    log "Removing unused Docker images..."
    docker image prune -af 2>&1 | tee -a "$LOGFILE" || true
fi

# 4. Clean runner work directories
if [ -d "$RUNNER_HOME/_work" ]; then
    log "=== Cleaning runner work directories ==="
    
    # Determine age threshold based on cleanup level
    AGE_THRESHOLD=7
    if [ "$CLEANUP_LEVEL" = "critical" ]; then
        AGE_THRESHOLD=0  # Remove everything
    elif [ "$CLEANUP_LEVEL" = "aggressive" ]; then
        AGE_THRESHOLD=1  # Keep only today's files
    fi
    
    if [ "$AGE_THRESHOLD" -eq 0 ]; then
        log "CRITICAL: Removing ALL work directories..."
        # Keep the _work directory itself but remove all contents
        find "$RUNNER_HOME/_work" -mindepth 1 -maxdepth 1 -exec rm -rf {} + 2>&1 | tee -a "$LOGFILE" || true
    else
        log "Removing work directories older than $AGE_THRESHOLD days..."
        # Remove build artifacts
        find "$RUNNER_HOME/_work" -type d -name "target" -mtime +$AGE_THRESHOLD -exec rm -rf {} + 2>&1 | tee -a "$LOGFILE" || true
        find "$RUNNER_HOME/_work" -type d -name "node_modules" -mtime +$AGE_THRESHOLD -exec rm -rf {} + 2>&1 | tee -a "$LOGFILE" || true
        find "$RUNNER_HOME/_work" -type d -name ".next" -mtime +$AGE_THRESHOLD -exec rm -rf {} + 2>&1 | tee -a "$LOGFILE" || true
        find "$RUNNER_HOME/_work" -type d -name "dist" -mtime +$AGE_THRESHOLD -exec rm -rf {} + 2>&1 | tee -a "$LOGFILE" || true
        find "$RUNNER_HOME/_work" -type d -name "build" -mtime +$AGE_THRESHOLD -exec rm -rf {} + 2>&1 | tee -a "$LOGFILE" || true
        find "$RUNNER_HOME/_work" -type d -name "_temp" -mtime +$AGE_THRESHOLD -exec rm -rf {} + 2>&1 | tee -a "$LOGFILE" || true
        find "$RUNNER_HOME/_work" -type f -name "*.log" -mtime +$AGE_THRESHOLD -delete 2>&1 | tee -a "$LOGFILE" || true
    fi
fi

# 5. Clean development caches
if [ -d "$RUNNER_HOME" ]; then
    log "=== Cleaning development caches ==="
    
    # Rust/Cargo - preserve rustup, only clean cargo caches
    if [ -d "$RUNNER_HOME/.cargo" ]; then
        log "Cleaning Cargo caches (preserving rustup)..."
        # Clean git checkouts (can be re-cloned)
        rm -rf "$RUNNER_HOME/.cargo/git/checkouts" 2>&1 | tee -a "$LOGFILE" || true
        # Clean git db only if aggressive
        if [ "$CLEANUP_LEVEL" != "normal" ]; then
            rm -rf "$RUNNER_HOME/.cargo/git/db" 2>&1 | tee -a "$LOGFILE" || true
        fi
        # Clean registry cache (downloaded .crate files)
        rm -rf "$RUNNER_HOME/.cargo/registry/cache" 2>&1 | tee -a "$LOGFILE" || true
        # Clean registry src (extracted crates)
        rm -rf "$RUNNER_HOME/.cargo/registry/src" 2>&1 | tee -a "$LOGFILE" || true
        # Only clean index in critical mode (will need re-download)
        if [ "$CLEANUP_LEVEL" = "critical" ]; then
            rm -rf "$RUNNER_HOME/.cargo/registry/index" 2>&1 | tee -a "$LOGFILE" || true
        fi
        # Report cargo cache size after cleanup
        CARGO_SIZE=$(du -sh "$RUNNER_HOME/.cargo" 2>/dev/null | awk '{print $1}' || echo "unknown")
        log "Cargo directory size after cleanup: $CARGO_SIZE"
    fi
    
    # Node/Yarn/npm
    rm -rf "$RUNNER_HOME/.yarn/berry/cache" "$RUNNER_HOME/.yarn/cache" 2>&1 | tee -a "$LOGFILE" || true
    rm -rf "$RUNNER_HOME/.npm/_cacache" "$RUNNER_HOME/.npm/_logs" 2>&1 | tee -a "$LOGFILE" || true
    rm -rf "$RUNNER_HOME/.pnpm-store" 2>&1 | tee -a "$LOGFILE" || true
    
    # General cache
    if [ -d "$RUNNER_HOME/.cache" ] && [ "$CLEANUP_LEVEL" != "normal" ]; then
        log "Cleaning general cache directory..."
        rm -rf "$RUNNER_HOME/.cache"/* 2>&1 | tee -a "$LOGFILE" || true
    fi
fi

# 6. Clean system caches and logs
log "=== Cleaning system caches ==="

# APT cache
apt-get clean 2>&1 | tee -a "$LOGFILE" || log "Warning: Failed to clean apt cache"
if [ "$CLEANUP_LEVEL" != "normal" ]; then
    apt-get autoremove -y 2>&1 | tee -a "$LOGFILE" || true
fi

# Temp directories
find /tmp -type f -atime +1 -delete 2>&1 | tee -a "$LOGFILE" || true
find /var/tmp -type f -atime +1 -delete 2>&1 | tee -a "$LOGFILE" || true
find /tmp -type d -empty -mtime +1 -delete 2>&1 | tee -a "$LOGFILE" || true
find /var/tmp -type d -empty -mtime +1 -delete 2>&1 | tee -a "$LOGFILE" || true

# Journal logs
if [ "$CLEANUP_LEVEL" != "normal" ]; then
    journalctl --vacuum-time=3d 2>&1 | tee -a "$LOGFILE" || true
else
    journalctl --vacuum-time=7d 2>&1 | tee -a "$LOGFILE" || true
fi

# Compress old logs
find /var/log -type f -name "*.log" -mtime +7 -exec gzip {} + 2>&1 | tee -a "$LOGFILE" || true
find /var/log -type f -name "*.gz" -mtime +30 -delete 2>&1 | tee -a "$LOGFILE" || true

# 7. Final Docker cleanup if still high usage
CURRENT_USAGE=$(get_disk_usage)
if [ "$CURRENT_USAGE" -ge "$AGGRESSIVE_CLEANUP_THRESHOLD" ]; then
    log "=== Performing final aggressive Docker cleanup ==="
    
    # Check Docker overlay2 size
    if [ -d "/var/lib/docker/overlay2" ]; then
        OVERLAY_SIZE=$(du -sh /var/lib/docker/overlay2 2>/dev/null | awk '{print $1}' || echo "unknown")
        log "Docker overlay2 size: $OVERLAY_SIZE"
    fi
    
    # Check if Docker is responsive
    if ! docker info >/dev/null 2>&1; then
        log "WARNING: Docker is not responsive, attempting restart..."
        systemctl restart docker 2>&1 | tee -a "$LOGFILE" || log "Warning: Failed to restart Docker"
        sleep 10
    fi
    
    # Last resort: restart Docker service to clear any hanging resources
    if [ "$CLEANUP_LEVEL" = "critical" ] && [ "$CURRENT_USAGE" -ge "$CRITICAL_CLEANUP_THRESHOLD" ]; then
        log "CRITICAL: Restarting Docker service..."
        # Stop all containers before restart
        docker kill $(docker ps -q) 2>/dev/null || true
        systemctl restart docker 2>&1 | tee -a "$LOGFILE" || log "Warning: Failed to restart Docker"
        sleep 10
        
        # Clean up any stuck mounts
        log "Cleaning up stuck Docker mounts..."
        umount -l /var/lib/docker/overlay2/*/merged 2>/dev/null || true
    fi
fi

# Get final disk usage and calculate freed space
FINAL_USAGE=$(get_disk_usage)
SPACE_FREED=$((INITIAL_USAGE - FINAL_USAGE))

log "========================================="
log "Cleanup complete"
log "Initial disk usage: ${INITIAL_USAGE}%"
log "Final disk usage: ${FINAL_USAGE}%"
log "Space freed: ${SPACE_FREED}%"
log "========================================="

# Alert if disk usage is still high
if [ "$FINAL_USAGE" -ge "$AGGRESSIVE_CLEANUP_THRESHOLD" ]; then
    log "⚠️  WARNING: Disk usage (${FINAL_USAGE}%) is still above ${AGGRESSIVE_CLEANUP_THRESHOLD}%!"
    log "Manual intervention may be required. Check:"
    log "- Large files: du -h / | sort -rh | head -20"
    log "- Docker status: docker system df"
    log "- Active processes: ps aux | grep -E '(docker|buildx)'"
fi

exit 0