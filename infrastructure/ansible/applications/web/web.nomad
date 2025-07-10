job "web" {
  datacenters = ["dc1", "dc2", "dc3"]
  type = "service"

  update {
    max_parallel      = 1
    health_check      = "checks"
    min_healthy_time  = "10s"
    healthy_deadline  = "2m"
    progress_deadline = "5m"
    auto_revert       = true
    auto_promote      = false
    canary            = 0
    stagger           = "30s"
  }

  group "web" {
    count = 3  # One per datacenter for high availability

    # Spread across datacenters
    spread {
      attribute = "${node.datacenter}"
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
      attempts = 5       # Increased from 3
      interval = "5m"
      delay    = "10s"  # Reduced from 30s
      mode     = "delay"
    }

    ephemeral_disk {
      size    = 500
      sticky  = false
      migrate = true
    }

    network {
      port "http" {
        static = 3000
        to = 3000
        host_network = "tailscale"
      }
    }

    task "web" {
      driver = "docker"

      config {
        # Image will be replaced during deployment
        image = "ghcr.io/proposals-app/proposalsapp/web:latest"
        ports = ["http"]
        force_pull = true

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
        # Node.js settings
        NODE_ENV = "production"
        PORT = "3000"
        
        # Bind to all interfaces so health checks can reach the app
        HOSTNAME = "0.0.0.0"
      }

      # Deployment metadata template for visibility
      # Does not trigger restarts - deployment is handled by automation
      template {
        destination = "local/deployment-info.txt"
        change_mode = "noop"
        data = <<EOF
{{ $deploymentJson := keyOrDefault "web/deployment/main" "{}" }}
{{ if $deploymentJson }}
{{ $deployment := $deploymentJson | parseJSON }}
Current deployment target:
  Image: {{ if $deployment.image }}{{ $deployment.image }}{{ else }}unknown{{ end }}
  Tag: {{ if $deployment.tag }}{{ $deployment.tag }}{{ else }}unknown{{ end }}
  SHA: {{ if $deployment.sha }}{{ $deployment.sha }}{{ else }}unknown{{ end }}
  Time: {{ if $deployment.timestamp }}{{ $deployment.timestamp }}{{ else }}unknown{{ end }}
  Author: {{ if $deployment.author }}{{ $deployment.author }}{{ else }}unknown{{ end }}
{{ else }}
No deployment information available
{{ end }}
EOF
      }

      # Environment configuration template
      # Does not trigger restarts to avoid loops
      template {
        data = <<EOF
# Deployment metadata from Consul
{{ $deploymentJson := keyOrDefault "web/deployment/main" "{}" }}
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

# Application configuration from Consul KV
ROOT_DOMAIN={{ keyOrDefault "web/root_domain" "proposals.app" }}
NEXT_PUBLIC_ROOT_DOMAIN={{ keyOrDefault "web/root_domain" "proposals.app" }}
SPECIAL_SUBDOMAINS={{ keyOrDefault "web/special_subdomains" "arbitrum,uniswap" }}
NEXT_PUBLIC_SPECIAL_SUBDOMAINS={{ keyOrDefault "web/special_subdomains" "arbitrum,uniswap" }}

# Database connection - use Nomad service discovery to find pgpool
# This will resolve to the pgpool service running on the same node
{{ range service "pgpool" }}
# Get connection string and replace localhost with discovered address
{{ $connStr := keyOrDefault "pgpool/connection_string/local" "postgresql://proposalsapp:password@localhost:5432/proposalsapp" }}
DATABASE_URL={{ $connStr | regexReplaceAll "@localhost:" (printf "@%s:" .Address) }}
ARBITRUM_DATABASE_URL={{ $connStr | regexReplaceAll "@localhost:" (printf "@%s:" .Address) }}
UNISWAP_DATABASE_URL={{ $connStr | regexReplaceAll "@localhost:" (printf "@%s:" .Address) }}
{{ end }}

# Analytics and monitoring
POSTHOG_KEY={{ keyOrDefault "web/posthog_key" "" }}
NEXT_PUBLIC_POSTHOG_KEY={{ keyOrDefault "web/posthog_key" "" }}

# Web Push configuration
WEB_PUSH_PUBLIC_KEY={{ keyOrDefault "web/web_push_public_key" "" }}
NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY={{ keyOrDefault "web/web_push_public_key" "" }}
WEB_PUSH_PRIVATE_KEY={{ keyOrDefault "web/web_push_private_key" "" }}
WEB_PUSH_EMAIL={{ keyOrDefault "web/web_push_email" "" }}

# Email service
RESEND_API_KEY={{ keyOrDefault "web/resend_api_key" "" }}

# Authentication
BETTER_AUTH_SECRET={{ keyOrDefault "web/better_auth_secret" "" }}

# Tally API
TALLY_API_KEY={{ keyOrDefault "web/tally_api_key" "" }}

# Redis cache - connects via local HAProxy using service discovery
# HAProxy is registered as "haproxy-redis" service on port 6380
{{ range service "haproxy-redis" }}
# Get Redis connection string and replace localhost with discovered address
{{ $redisConnStr := keyOrDefault "redis/connection_string/haproxy" "redis://:password@localhost:6380" }}
REDIS_URL={{ $redisConnStr | regexReplaceAll "@localhost:" (printf "@%s:" .Address) }}
{{ end }}

EOF
        destination = "secrets/env"
        env         = true
        change_mode = "noop"
      }

      resources {
        cpu    = 2000  # 2 CPU core
        memory = 2048  # 2GB RAM

        # Reserve additional resources for peak loads
        memory_max = 3072  # Allow bursting to 3GB
      }

      service {
        name = "web"
        tags = [
          "frontend",
          "nextjs"
        ]
        port = "http"
        address_mode = "host"

        check {
          type     = "http"
          path     = "/api/health"
          interval = "5s"
          timeout  = "2s"
          
          # Additional health check configuration
          check_restart {
            limit = 3          # Restart after 3 consecutive failures
            grace = "30s"     # Grace period before health checks start
            ignore_warnings = false
          }
        }
      }
    }
  }
}
