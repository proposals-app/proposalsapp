# ProposalsApp Infrastructure Deployment Guide

This guide walks through deploying a highly available infrastructure for ProposalsApp across
multiple Proxmox nodes.

## Prerequisites

- 3 Proxmox servers with Tailscale installed and connected
- SSH access to all Proxmox servers via Tailscale
- Ansible installed on your local machine
- Cloudflare account with Zero Trust access (for tunnels)

## Architecture Overview

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    sib-01       │  │    sib-03       │  │    fsn-01       │
│  (Romania)      │  │  (Romania)      │  │  (Germany)      │
├─────────────────┤  ├─────────────────┤  ├─────────────────┤
│ consul-nomad    │  │ consul-nomad    │  │ consul-nomad    │
│ postgres        │  │ postgres        │  │ postgres        │
│ apps            │  │ apps            │  │ apps            │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

## Step 1: Initial Setup

### 1.1 Configure SSH Access

Add to `~/.ssh/config`:

```
Host sib-01
    HostName <your-sib-01-tailscale-ip>
    User root
    StrictHostKeyChecking accept-new

Host sib-03
    HostName <your-sib-03-tailscale-ip>
    User root
    StrictHostKeyChecking accept-new

Host fsn-01
    HostName <your-fsn-01-tailscale-ip>
    User root
    StrictHostKeyChecking accept-new
```

### 1.2 Clone Repository

```bash
cd /Users/andrei/git/proposalsapp/infrastructure
```

### 1.3 Create Ansible Vault

Create an encrypted vault to store sensitive information:

```bash
cd ansible

# Create vault password file (keep this secure!)
echo -n "Enter vault password: " && read -s vault_pass && echo
echo "$vault_pass" > .vault_pass
chmod 600 .vault_pass

# Create the vault directory structure
mkdir -p group_vars/all

# Create encrypted vault file
ansible-vault create group_vars/all/vault.yml --vault-password-file .vault_pass
```

When the editor opens, add the following variables:

```yaml
---
# Proxmox passwords for each server
vault_proxmox_password_sib01: 'your-sib-01-password'
vault_proxmox_password_sib03: 'your-sib-03-password'
vault_proxmox_password_fsn01: 'your-fsn-01-password'

# Tailscale auth key (get from https://login.tailscale.com/admin/settings/keys)
vault_tailscale_auth_key: 'tskey-auth-XXXXXX'
vault_tailscale_api_key: 'tskey-api-XXXXXX'

# Consul and Nomad encryption keys
vault_consul_encrypt_key: 'xxx' # Generate with: consul keygen
vault_nomad_encrypt_key: 'xxx' # Generate with: openssl rand -base64 16 | base64

# Cloudflare credentials
vault_cloudflare_tunnel_token: 'your-tunnel-token'

# Database passwords
postgres_password: 'secure-postgres-password'
patroni_password: 'secure-patroni-password'
replicator_password: 'secure-replication-password'
```

Save and exit the editor (`:wq` in vim).

To edit the vault later:

```bash
ansible-vault edit group_vars/all/vault.yml --vault-password-file .vault_pass
```

To view the vault contents:

```bash
ansible-vault view group_vars/all/vault.yml --vault-password-file .vault_pass
```

## Step 2: Deploy Infrastructure

### 2.1 Create LXC Containers with Tailscale

The playbook will:

- Create containers on the `sibnet` bridge (configurable in playbook)
- Configure /dev/tun access for Tailscale
- Install and configure Tailscale automatically using the auth key from vault
- Set up Tailscale hostnames for each container

```bash
# Run the playbook (Tailscale auth key is read from vault)
ansible-playbook -i inventory.yml playbooks/01-provision-and-prepare-lxcs.yml \
  --vault-password-file .vault_pass
```

After this step, all containers will be accessible via their Tailscale hostnames (e.g.,
`consul-nomad-sib-01`, `db-sib-01`, etc.).

### 2.2 Install Consul Cluster

```bash
ansible-playbook -i inventory.yml playbooks/02-install-consul.yml \
  --vault-password-file .vault_pass
```

### 2.3 Install Nomad Cluster

```bash
ansible-playbook -i inventory.yml playbooks/03-install-nomad.yml \
  --vault-password-file .vault_pass
```

### 2.4 Setup PostgreSQL HA

```bash
ansible-playbook -i inventory.yml playbooks/04-install-postgres.yml \
  --vault-password-file .vault_pass
```

### 2.6 Deploy Applications

```bash
# Deploy infrastructure services (Cloudflare tunnel, Traefik, Redis)
nomad job run nomad-jobs/cloudflared.nomad
nomad job run nomad-jobs/traefik.nomad
nomad job run nomad-jobs/redis.nomad

# Deploy applications
nomad job run nomad-jobs/web.nomad
nomad job run nomad-jobs/indexer-discourse.nomad
nomad job run nomad-jobs/indexer-rindexer.nomad
```

## Configuration

### Network Bridge

The network bridge is configurable in `ansible/playbooks/01-provision-and-prepare-lxcs.yml`:

```yaml
network_bridge:
  sib-01: sibnet # Change this to your bridge
  sib-03: sibnet
  fsn-01: sibnet
```

### Container IDs

Container IDs start from 500 to avoid conflicts. Modify in the playbook if needed.

### Resources

Default container resources:

- consul-nomad: 2 cores, 4GB RAM, 20GB disk
- db: 4 cores, 8GB RAM, 100GB disk
- apps: 8 cores, 16GB RAM, 50GB disk

## Monitoring

### Getting Management Tokens

After infrastructure setup with ACLs enabled, retrieve management tokens:

```bash
./scripts/get-tokens.sh
```

This will show both Consul and Nomad management tokens. Export them:

```bash
export CONSUL_HTTP_TOKEN=<your-consul-token>
export NOMAD_TOKEN=<your-nomad-token>
```

### Check Service Status

```bash
# Consul (with ACL token)
consul members

# Nomad (with ACL token)
nomad server members
nomad node status

# Check jobs
nomad job status
```

### Access UIs

- Consul: http://consul-nomad-sib-01:8500 (requires token)
- Nomad: http://consul-nomad-sib-01:4646 (requires token)
- Your app: https://your-domain.com (via Cloudflare tunnel)

## Troubleshooting

### Container Network Issues

If containers can't reach each other:

```bash
# Check Tailscale status
ssh root@<container> tailscale status

# Restart Tailscale
ssh root@<container> systemctl restart tailscaled
```

### Service Discovery Issues

```bash
# Check Consul DNS
dig @127.0.0.1 -p 8600 postgres.service.consul
```

### Database Failover

```bash
# Check Patroni status
patronictl -c /etc/patroni/config.yml list
```

## Maintenance

### Backup Database

```bash
# On primary node
pg_dump -h localhost -U proposalsapp proposalsapp > backup.sql
```

### Update Applications

```bash
# Update job file, then:
nomad job run nomad-jobs/web.nomad
```

### Scale Services

Edit the `count` in Nomad job files and re-run.

## Cleanup

### Destroy All Containers

To completely remove all LXC containers created by these playbooks:

```bash
ansible-playbook -i inventory.yml playbooks/99-destroy-lxc-containers.yml \
  --vault-password-file .vault_pass
```

**WARNING**: This will:

- Stop all running containers
- Permanently delete all containers and their data
- Remove all container configurations
- This action cannot be undone!

You will be prompted to type `yes-destroy-all` to confirm the destruction.
