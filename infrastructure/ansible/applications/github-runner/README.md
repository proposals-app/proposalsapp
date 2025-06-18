# GitHub Actions Self-Hosted Runner

This sets up GitHub Actions self-hosted runners on the infrastructure.

## Prerequisites

1. GitHub Personal Access Token (PAT) must be configured in vault
2. LXC containers must be created with the provision playbook

## Setup

1. First, edit the vault to add your GitHub PAT:
   ```bash
   ansible-vault edit group_vars/all/vault.yml --vault-password-file .vault_pass
   ```
   
   Set the following:
   ```yaml
   vault_github_pat: "YOUR_GITHUB_PAT_HERE"
   ```

2. Deploy the runners:
   ```bash
   ./deploy-application.sh github-runner setup
   ```

## Features

- One runner per datacenter (3 total)
- Automatic registration with GitHub
- Docker and Docker Buildx support
- Rust toolchain pre-installed
- Node.js and .NET SDK included
- Tailscale network integration
- Labeled by datacenter for job routing

## Runner Labels

Each runner has the following labels:
- `self-hosted`
- `linux`
- `tailscale`
- Datacenter label: `dc1`, `dc2`, or `dc3`

## Usage in GitHub Actions

```yaml
jobs:
  build:
    runs-on: [self-hosted, linux]
    # Or target specific datacenter:
    # runs-on: [self-hosted, linux, dc1]
    
    steps:
      - uses: actions/checkout@v4
      - name: Build
        run: cargo build --release
```

## Monitoring

Check runner status:
```bash
ansible github_runners -i inventory.yml -m shell -a "systemctl status actions.runner.*"
```

View runner logs:
```bash
ansible github_runners -i inventory.yml -m shell -a "journalctl -u actions.runner.* -n 50"
```

## Maintenance

To remove and re-register a runner:
1. Stop the service
2. Remove the runner from GitHub settings
3. Re-run the setup playbook