# Rindexer CI/CD Pipeline

This document describes the complete CI/CD pipeline for the rindexer service.

## Overview

The pipeline automatically builds Docker images for every push to any branch, stores them in GitHub Container Registry (ghcr.io), and allows deployment of any branch through Nomad.

## Components

### 1. GitHub Actions Workflow

**File**: `.github/workflows/build-rindexer.yml`

- Triggers on every push that changes rindexer-related files
- Runs on self-hosted runners inside the Tailscale network
- Builds Docker images using buildx
- Tags images with:
  - Branch name (e.g., `main`, `feature-123`)
  - SHA-based tag (e.g., `main-abc1234`)
  - Timestamp (e.g., `main-20240118-143022`)
  - `latest` (only for main branch)
- Pushes to GitHub Container Registry
- Updates Consul KV with new image tags via internal network

### 2. Nomad Job Configuration

**File**: `infrastructure/ansible/applications/rindexer/rindexer.nomad`

- Reads branch configuration from Consul KV
- Dynamically constructs Docker image path based on branch
- Automatically redeploys when image tag changes

### 3. Consul KV Configuration

The following keys control deployment:

- `rindexer/branch` - Currently deployed branch (default: "main")
- `rindexer/image/<branch>` - Latest image tag for each branch

## Deployment Workflows

### Deploy Main Branch

```bash
# This deploys the main branch (default)
./deploy-application.sh rindexer
```

### Deploy Feature Branch

```bash
# Deploy a specific branch
./deploy-application.sh rindexer setup --branch=feature-123

# Or update Consul directly (from within Tailscale network)
consul kv put rindexer/branch "feature-123"
```

### Check Current Deployment

```bash
# See which branch is deployed
consul kv get rindexer/branch

# See available image for a branch
consul kv get rindexer/image/main
consul kv get rindexer/image/feature-123
```

## Automatic Deployment

The pipeline automatically updates Consul KV on every successful build:

1. GitHub Actions runners are inside the Tailscale network
2. They directly access Consul at `http://consul-nomad-sib-01:8500`
3. No external access or secrets needed - all communication is internal
4. When a new image is pushed for the active branch, Nomad automatically redeploys

### Security

- All infrastructure (Consul, Nomad, GitHub runners) is within the private Tailscale network
- No public endpoints exposed
- GitHub runners can only access internal services via Tailscale hostnames
- Image registry (ghcr.io) is the only external service used

## Manual Image Tag Update

If needed, you can manually update image tags (from within Tailscale network):

```bash
# Update image tag for a branch
./infrastructure/ansible/applications/rindexer/update-image-tag.sh \
  --branch=main \
  --tag=main-abc1234
```

## Branch Strategy

- `main`: Production-ready code, auto-deployed to production
- `develop`: Development branch, can be deployed to staging
- `feature/*`: Feature branches, deployable for testing
- `hotfix/*`: Emergency fixes, deployable directly

## Network Architecture

```
GitHub (External)
    |
    v
GitHub Container Registry (ghcr.io)
    |
    v
[Tailscale Network Boundary]
    |
    +---> GitHub Runners (tailscale)
    |         |
    |         v
    |     Consul KV (internal)
    |         |
    |         v
    |     Nomad (internal)
    |         |
    |         v
    +---> Docker pull from ghcr.io
```

## Monitoring

- GitHub Actions: Check workflow runs at Actions tab
- Nomad: `nomad job status rindexer` (from Tailscale network)
- Docker images: `https://github.com/orgs/proposals-app/packages`
- Logs: Available through Nomad UI or `nomad logs`

## Rollback

To rollback to a previous version (from within Tailscale network):

```bash
# See previous versions
nomad job history rindexer

# Rollback to specific version
nomad job revert rindexer <version>

# Or deploy a specific image tag
consul kv put rindexer/image/main "main-previous-tag"
```

## Troubleshooting

### Build Failures

1. Check GitHub Actions logs
2. Ensure self-hosted runners are online: `systemctl status actions.runner.*`
3. Verify runners can reach Tailscale network
4. Check Docker daemon on runners

### Deployment Failures

1. Check Nomad job status: `nomad job status rindexer`
2. Check allocation logs: `nomad alloc logs <alloc-id>`
3. Verify Consul KV values are correct
4. Ensure Nomad can pull from ghcr.io

### Image Not Found

1. Verify image was built successfully in GitHub Actions
2. Check image exists in GitHub Container Registry
3. Ensure branch name in Consul matches GitHub branch
4. Verify Nomad nodes can access ghcr.io

### Network Issues

1. Verify runner is connected to Tailscale: `tailscale status`
2. Check Consul is accessible: `curl http://consul-nomad-sib-01:8500/v1/status/leader`
3. Ensure DNS resolution works for internal hostnames
4. Check Tailscale ACLs allow runner → Consul communication