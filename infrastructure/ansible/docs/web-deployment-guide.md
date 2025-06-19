# Web Application Deployment Guide

This guide explains how to deploy the ProposalsApp web application with full integration of Cloudflare, Traefik, and the Next.js frontend.

## Architecture Overview

```
Internet → Cloudflare Edge → Cloudflared Tunnel → Traefik (Load Balancer) → Web App (3 instances)
```

## Prerequisites

1. Domain configured in Cloudflare (proposal.vote)
2. Cloudflare tunnel created with proper token
3. All infrastructure components deployed (pgpool, etcd, etc.)

## Deployment Steps

### 1. Deploy Traefik (Load Balancer)

Traefik handles SSL termination, load balancing, and routing based on hostnames.

```bash
cd infrastructure/ansible
./deploy-application.sh traefik
```

Traefik will:
- Listen on ports 80 (HTTP) and 443 (HTTPS)
- Automatically redirect HTTP to HTTPS
- Use Cloudflare DNS challenge for Let's Encrypt certificates
- Route traffic based on Host headers to appropriate services

### 2. Deploy Cloudflared (Tunnel)

Cloudflared creates a secure tunnel from Cloudflare's edge to your infrastructure.

```bash
./deploy-application.sh cloudflared
```

**Important**: After deployment, configure the tunnel in Cloudflare dashboard:
1. Go to Zero Trust → Access → Tunnels
2. Find your tunnel (using the token ID)
3. Configure public hostnames:
   - `proposal.vote` → `http://traefik:443`
   - `*.proposal.vote` → `http://traefik:443`
4. Enable "No TLS Verify" in origin settings (Traefik handles SSL)

### 3. Deploy Web Application

The Next.js frontend with subdomain routing support.

```bash
./deploy-application.sh web
```

The web app will:
- Deploy 3 instances across datacenters
- Listen on port 3000
- Handle subdomain routing (arbitrum.proposal.vote, uniswap.proposal.vote)
- Connect to local pgpool for database access

## Subdomain Routing

The web application uses middleware to handle subdomain routing:

- **Special subdomains** (arbitrum, uniswap): Custom implementations with DAO-specific features
- **Dynamic subdomains**: Generic interface for any DAO using `[daoSlug]` routing
- **Main domain**: Shows a landing page or redirects to a default DAO

### Environment Variables

Key environment variables configured via Consul KV:
- `NEXT_PUBLIC_ROOT_DOMAIN`: proposal.vote
- `NEXT_PUBLIC_SPECIAL_SUBDOMAINS`: arbitrum,uniswap
- `DATABASE_URL`: Local pgpool connection string

## Verification

### 1. Check Service Health

```bash
# Check Nomad job status
nomad job status traefik
nomad job status cloudflared
nomad job status web

# Check Consul service registration
consul catalog services | grep -E "(traefik|cloudflared|web)"
```

### 2. Test Connectivity

```bash
# Test Traefik health
curl http://<any-node>:8080/ping

# Test web app health (from inside network)
curl http://<any-node>:3000/api/health
```

### 3. Test Public Access

After DNS propagation:
- https://proposal.vote - Main site
- https://arbitrum.proposal.vote - Arbitrum DAO interface
- https://uniswap.proposal.vote - Uniswap DAO interface

## Troubleshooting

### Cloudflared Issues

1. Check tunnel status in Cloudflare dashboard
2. Verify tunnel token is correctly stored in Consul KV
3. Check logs: `nomad alloc logs <alloc-id> cloudflared`

### Traefik Issues

1. Check certificate generation: `nomad alloc logs <alloc-id> traefik | grep acme`
2. Verify Cloudflare API credentials in Consul KV
3. Check Traefik dashboard: http://<node>:8080/dashboard/

### Web App Issues

1. Verify environment variables: `consul kv get -recurse web/`
2. Check subdomain middleware: `nomad alloc logs <alloc-id> web | grep middleware`
3. Verify database connectivity through pgpool

## Traffic Flow Example

When a user visits `https://arbitrum.proposal.vote/proposals`:

1. DNS resolves to Cloudflare's edge network
2. Cloudflare routes through the configured tunnel
3. Cloudflared tunnel forwards to Traefik on port 443
4. Traefik:
   - Terminates SSL
   - Matches the Host header `arbitrum.proposal.vote`
   - Routes to one of the web service instances
5. Web app middleware:
   - Extracts subdomain "arbitrum"
   - Rewrites the path to `/arbitrum/proposals`
   - Serves the Arbitrum-specific interface

## Security Considerations

1. **SSL/TLS**: Handled by Traefik with Let's Encrypt certificates
2. **Origin Protection**: Only accessible through Cloudflare tunnel
3. **Internal Communication**: Uses Tailscale VPN between nodes
4. **Database Access**: Through local pgpool with connection pooling

## Maintenance

### Updating the Web App

When new code is pushed to the main branch:
1. GitHub Action builds and pushes new Docker image
2. Updates image tag in Consul KV
3. Nomad detects change and performs rolling update
4. Zero-downtime deployment with health checks

### Adding New Subdomains

To add a new special subdomain (e.g., "compound"):
1. Update `vault_web_special_subdomains` in web_vault.yml
2. Re-run setup: `./deploy-application.sh web setup`
3. Implement the subdomain-specific pages in `/app/(dao)/compound/`

### Scaling

To adjust the number of web app instances:
1. Edit `count` in web.nomad (currently set to 3)
2. Redeploy: `./deploy-application.sh web deploy`