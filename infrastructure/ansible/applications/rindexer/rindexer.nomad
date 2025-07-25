job "rindexer" {
  datacenters = ["dc1", "dc2", "dc3"]
  type = "service"

  update {
    max_parallel      = 1
    health_check      = "checks"
    min_healthy_time  = "30s"
    healthy_deadline  = "5m"
    progress_deadline = "10m"
    auto_revert       = true
    auto_promote      = true
    canary            = 1
    stagger           = "30s"
  }

  group "rindexer" {
    count = 1  # Single instance - indexes all chains centrally

    # Prefer to run in dc1 but can run anywhere if needed
    affinity {
      attribute = "${node.datacenter}"
      value     = "dc1"
      weight    = 100
    }

    migrate {
      max_parallel = 1
      health_check = "checks"
      min_healthy_time = "10s"
      healthy_deadline = "2m"
    }

    reschedule {
      delay          = "5s"      # Reduced from 30s for faster recovery
      delay_function = "constant" # Use constant delay for predictable recovery
      max_delay      = "30s"     # Reduced from 1h
      unlimited      = true
    }

    restart {
      attempts = 10      # Increased from 5 for more resilience
      interval = "10m"
      delay    = "10s"  # Reduced from 60s
      mode     = "delay"
    }

    ephemeral_disk {
      size    = 500
      sticky  = false
      migrate = true
    }

    network {
      port "http" {
        static = 3004
        to = 3000
        host_network = "tailscale"
      }
    }

    task "rindexer" {
      driver = "docker"

      config {
        image = "ghcr.io/proposals-app/proposalsapp/rindexer:latest"
        ports = ["http"]
        force_pull = true

        # DNS configuration for better host resolution
        dns_servers = ["8.8.8.8", "8.8.4.4"]

        # Add logging configuration
        logging {
          type = "json-file"
          config {
            max-size = "10m"
            max-file = "3"
          }
        }
      }

      env {
        RUST_LOG = "info,rindexer=debug"
        RUST_BACKTRACE = "1"
      }

      # Environment configuration template
      template {
        data = <<EOF
# Deployment metadata from Consul
{{ $deploymentJson := keyOrDefault "rindexer/deployment/main" "{}" }}
{{ if $deploymentJson }}
{{ $deployment := $deploymentJson | parseJSON }}
DEPLOYMENT_IMAGE={{ if $deployment.image }}{{ $deployment.image }}{{ else }}unknown{{ end }}
DEPLOYMENT_TAG={{ if $deployment.tag }}{{ $deployment.tag }}{{ else }}unknown{{ end }}
DEPLOYMENT_SHA={{ if $deployment.sha }}{{ $deployment.sha }}{{ else }}unknown{{ end }}
DEPLOYMENT_TIME={{ if $deployment.timestamp }}{{ $deployment.timestamp }}{{ else }}unknown{{ end }}
DEPLOYMENT_AUTHOR={{ if $deployment.author }}{{ $deployment.author }}{{ else }}unknown{{ end }}
DEPLOYMENT_WORKFLOW_URL={{ if $deployment.workflow_run_url }}{{ $deployment.workflow_run_url }}{{ else }}unknown{{ end }}
{{ else }}
DEPLOYMENT_IMAGE=unknown
DEPLOYMENT_TAG=unknown
DEPLOYMENT_SHA=unknown
DEPLOYMENT_TIME=unknown
DEPLOYMENT_AUTHOR=unknown
DEPLOYMENT_WORKFLOW_URL=unknown
{{ end }}

# Database connection - use Nomad service discovery to find pgpool
# This will resolve to the pgpool service running on the same node
{{ $pgpoolFound := false }}
{{ range service "pgpool" }}
{{ $pgpoolFound = true }}
# Get connection string and replace localhost with discovered address
{{ $connStr := keyOrDefault "pgpool/connection_string/local" "postgresql://proposalsapp:password@localhost:5432/proposalsapp" }}
DATABASE_URL={{ $connStr | regexReplaceAll "@localhost:" (printf "@%s:" .Address) }}
{{ end }}
{{ if not $pgpoolFound }}
# Fallback: Use connection string from Consul KV directly when pgpool service is not yet discovered
{{ $connStr := keyOrDefault "pgpool/connection_string/local" "" }}
{{ if $connStr }}
DATABASE_URL={{ $connStr }}
{{ else }}
# Emergency fallback - this will cause the service to fail and retry
DATABASE_URL=
{{ end }}
{{ end }}

# Chain RPC endpoints - use the single eRPC instance via Consul service discovery
{{ $erpcFound := false }}
{{ range service "erpc" }}
  {{ if not $erpcFound }}
    {{ $erpcFound = true }}
# Using eRPC instance discovered via Consul (single instance deployment)
ETHEREUM_NODE_URL=http://{{ .Address }}:{{ .Port }}/proposalsapp/evm/1
ARBITRUM_NODE_URL=http://{{ .Address }}:{{ .Port }}/proposalsapp/evm/42161
AVALANCHE_NODE_URL=http://{{ .Address }}:{{ .Port }}/proposalsapp/evm/43114
POLYGON_NODE_URL=http://{{ .Address }}:{{ .Port }}/proposalsapp/evm/137
OPTIMISM_NODE_URL=http://{{ .Address }}:{{ .Port }}/proposalsapp/evm/10
  {{ end }}
{{ end }}
{{ if not $erpcFound }}
# ERROR: No eRPC instances found! Deploy eRPC first.
ETHEREUM_NODE_URL=
ARBITRUM_NODE_URL=
AVALANCHE_NODE_URL=
POLYGON_NODE_URL=
OPTIMISM_NODE_URL=
{{ end }}

# Block explorer API keys from Consul KV
ARBISCAN_API_KEY={{ keyOrDefault "rindexer/arbiscan_api_key" "" }}
ETHERSCAN_API_KEY={{ keyOrDefault "rindexer/etherscan_api_key" "" }}
OPTIMISTIC_SCAN_API_KEY={{ keyOrDefault "rindexer/optimistic_scan_api_key" "" }}
POLYGONSCAN_API_KEY={{ keyOrDefault "rindexer/polygonscan_api_key" "" }}

# BetterStack monitoring
BETTERSTACK_KEY={{ keyOrDefault "rindexer/betterstack_key" "" }}

EOF
        destination = "secrets/env"
        env         = true
        change_mode = "restart"
        splay       = "30s"
      }

      resources {
        cpu    = 2000  # 2 CPU cores
        memory = 8192  # 8GB RAM

        # Reserve additional resources for peak loads
        memory_max = 8192  # Allow bursting to 8GB
      }

      service {
        name = "rindexer"
        tags = ["indexer", "blockchain"]
        port = "http"
        address_mode = "host"

        check {
          type     = "http"
          path     = "/health"
          interval = "5s"
          timeout  = "2s"
          
          # Additional health check configuration
          check_restart {
            limit = 3          # Restart after 3 consecutive failures
            grace = "60s"     # Grace period before health checks start
            ignore_warnings = false
          }
        }
      }
    }
  }
}
