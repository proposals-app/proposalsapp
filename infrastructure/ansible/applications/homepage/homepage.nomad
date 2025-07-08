job "homepage" {
  datacenters = ["dc1", "dc2", "dc3"]
  type        = "service"

  group "homepage" {
    count = 1

    # No constraint needed - deploy to any available node

    network {
      mode = "host"
      
      port "http" {
        static = 3200
      }
    }

    service {
      name = "homepage"
      port = "http"
      address_mode = "host"
      tags = ["dashboard", "ui"]

      check {
        name     = "homepage-health"
        type     = "http"
        path     = "/"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "homepage" {
      driver = "docker"

      config {
        image = "ghcr.io/gethomepage/homepage:latest"
        network_mode = "host"
        
        volumes = [
          "local/config:/app/config"
        ]
      }

      env {
        PUID = "1000"
        PGID = "1000"
        PORT = "3200"
        HOMEPAGE_ALLOWED_HOSTS = "dashboard.proposals.app"
      }

      # Enhanced configuration with dynamic service discovery
      template {
        destination = "local/config/settings.yaml"
        data        = <<EOH
---
title: ProposalsApp Infrastructure
favicon: https://proposals.app/favicon.ico
theme: dark
color: slate
target: _blank
headerStyle: boxed
language: en
hideVersion: true

layout:
  Applications:
    style: row
    columns: 4
  Infrastructure:
    style: row
    columns: 4
  Monitoring & Observability:
    style: row
    columns: 3
  Data Layer:
    style: row
    columns: 3
  Datacenters:
    style: row
    columns: 3

providers:
  openweathermap: openweathermap_api_key
EOH
      }

      template {
        destination = "local/config/services.yaml"
        data        = <<EOH
---
- Applications:
    - ProposalsApp:
        icon: si-ethereum
        href: https://proposals.app
        description: Main DAO governance platform
        siteMonitor: https://proposals.app
        # Widget disabled - service port needs verification
    
    - Arbitrum DAO:
        icon: si-ethereum
        href: https://arbitrum.proposals.app
        description: Arbitrum governance portal
        siteMonitor: https://arbitrum.proposals.app
    
    - Uniswap DAO:
        icon: si-ethereum
        href: https://uniswap.proposals.app
        description: Uniswap governance portal
        siteMonitor: https://uniswap.proposals.app
    
    - Email Service:
        icon: mdi-email-newsletter
        description: Notification service
        # Widget disabled - service port needs verification

- Infrastructure:
    - Consul Cluster:
        icon: si-consul
        href: http://consul-nomad-sib-01:8500/ui
        description: Service mesh & discovery
        widget:
          type: customapi
          url: http://consul-nomad-sib-01:8500/v1/status/leader
          display: |
            if (data) {
              return "✓ Leader elected";
            }
            return "✗ No leader";
    
    - Nomad Cluster:
        icon: si-hashicorp
        href: http://consul-nomad-sib-01:4646/ui
        description: Container orchestration
        widget:
          type: customapi
          url: http://consul-nomad-sib-01:4646/v1/nodes
          display: |
            const ready = data.filter(n => n.Status === "ready").length;
            return ready + "/" + data.length + " nodes ready";
    
    - Cloudflare Tunnel:
        icon: si-cloudflare
        description: Secure external access
        # Cloudflared widget disabled

- Monitoring & Observability:
    - Grafana:
        icon: grafana
        href: http://grafana.proposals.app
        description: Metrics visualization & dashboards
        # Access via Traefik ingress
    
    - Prometheus:
        icon: prometheus
        href: http://prometheus.proposals.app
        description: Metrics collection & alerting
        # Access via Traefik ingress
    
    - Loki:
        icon: grafana
        href: http://grafana.proposals.app/explore?orgId=1&left=%7B%22datasource%22:%22loki%22%7D
        description: Log aggregation system
        # Access via Grafana UI

- Data Layer:
    - PostgreSQL Cluster:
        icon: postgres
        description: High-availability database
        widget:
          type: customapi
          url: http://db-sib-01:8008/patroni
          display: |
            if (data && data.members) {
              const primary = data.members.find(m => m.role === 'leader');
              const replicas = data.members.filter(m => m.role === 'replica').length;
              return primary ? primary.name + " + " + replicas + " replicas" : "No primary";
            }
            return "✓ Cluster active";
    
    - pgbackweb:
        icon: postgres
        href: http://pgbackweb-sib-01:8085
        description: PostgreSQL backup management
        siteMonitor: http://pgbackweb-sib-01:8085
    
    - Redis Cluster:
        icon: redis
        description: High-availability cache
        # Redis widget disabled - requires auth

- Datacenters:
    - Sibiu DC1:
        icon: mdi-server
        href: https://sib-01:8006
        description: Primary datacenter (Romania) - Proxmox
        widget:
          type: customapi
          url: http://consul-nomad-sib-01:8500/v1/agent/self
          display: |
            return data.Config.Datacenter + " - " + data.Stats.consul.leader;
    
    - Sibiu DC2:
        icon: mdi-server
        href: https://sib-03:8006
        description: Secondary datacenter (Romania) - Proxmox
        widget:
          type: customapi
          url: http://consul-nomad-sib-03:8500/v1/agent/self
          display: |
            return data.Config.Datacenter + " - " + data.Stats.consul.leader;
    
    - Falkenstein DC:
        icon: mdi-server
        href: https://fsn-01:8006
        description: Tertiary datacenter (Germany) - Proxmox
        widget:
          type: customapi
          url: http://consul-nomad-fsn-01:8500/v1/agent/self
          display: |
            return data.Config.Datacenter + " - " + data.Stats.consul.leader;
EOH
      }

      template {
        destination = "local/config/widgets.yaml"
        data        = <<EOH
---
- logo:
    icon: mdi-view-dashboard
    
- greeting:
    text_size: 3xl
    text: Infrastructure Dashboard
    
- datetime:
    text_size: xl
    format:
      dateStyle: long
      timeStyle: short
      hourCycle: h23
      
- search:
    provider: duckduckgo
    target: _blank
    
- openmeteo:
    label: Sibiu # Primary datacenter location
    latitude: 45.7983
    longitude: 24.1256
    units: metric
    cache: 5

- resources:
    expanded: true
    cpu: true
    memory: true
    disk: /
    
EOH
      }

      template {
        destination = "local/config/bookmarks.yaml"
        data        = <<EOH
---
- Development:
    - GitHub:
        - abbr: GH
          icon: github
          href: https://github.com/your-org/proposalsapp
    - CI/CD:
        - abbr: CI
          icon: github
          href: https://github.com/your-org/proposalsapp/actions
    - Issues:
        - abbr: IS
          icon: github
          href: https://github.com/your-org/proposalsapp/issues

- Documentation:
    - Nomad:
        - abbr: ND
          icon: si-hashicorp
          href: https://developer.hashicorp.com/nomad
    - Consul:
        - abbr: CD
          icon: si-consul
          href: https://developer.hashicorp.com/consul
    - PostgreSQL:
        - abbr: PG
          icon: postgres
          href: https://www.postgresql.org/docs/17/
    - Traefik:
        - abbr: TF
          icon: traefik
          href: https://doc.traefik.io/traefik/

- External Services:
    - Cloudflare:
        - abbr: CF
          icon: si-cloudflare
          href: https://dash.cloudflare.com
    - Tailscale:
        - abbr: TS
          icon: si-tailscale
          href: https://login.tailscale.com/admin
    - Hetzner:
        - abbr: HZ
          icon: mdi-server
          href: https://console.hetzner.cloud

- Monitoring:
    - Status Page:
        - abbr: ST
          icon: mdi-shield-check
          href: https://status.proposals.app
EOH
      }


      # Custom CSS for better styling
      template {
        destination = "local/config/custom.css"
        data        = <<EOH
/* Custom styles for ProposalsApp dashboard */
.service-block {
  transition: transform 0.2s ease-in-out;
}

.service-block:hover {
  transform: scale(1.02);
}

/* Datacenter status indicators */
.widget-content {
  font-family: 'Monaco', 'Consolas', monospace;
}

/* Better status colors */
.status-ok { color: #10b981; }
.status-error { color: #ef4444; }
.status-warning { color: #f59e0b; }
EOH
      }

      resources {
        cpu    = 200
        memory = 512
      }
    }
  }
}