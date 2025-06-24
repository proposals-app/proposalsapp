job "email-service" {
  datacenters = ["dc1", "dc2", "dc3"]
  type = "service"

  update {
    max_parallel      = 1
    health_check      = "checks"
    min_healthy_time  = "10s"
    healthy_deadline  = "2m"
    progress_deadline = "5m"
    auto_revert       = true
    auto_promote      = true
    canary            = 1
    stagger           = "30s"
  }

  group "email-service" {
    count = 1  # Single instance for email processing

    # No datacenter constraint - allow placement in any datacenter
    # Nomad will automatically place it where resources are available

    migrate {
      max_parallel = 1
      health_check = "checks"
      min_healthy_time = "10s"
      healthy_deadline = "2m"
    }

    reschedule {
      delay          = "30s"
      delay_function = "exponential"
      max_delay      = "1h"
      unlimited      = true
    }

    restart {
      attempts = 3
      interval = "5m"
      delay    = "30s"
      mode     = "delay"
    }

    ephemeral_disk {
      size    = 300
      sticky  = false
      migrate = true
    }

    network {
      port "http" {
        to = 3001
      }
    }

    task "email-service" {
      driver = "docker"

      config {
        # Image will be replaced during deployment
        image = "ghcr.io/proposals-app/proposalsapp/email-service:latest"
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
        PORT = "3001"
      }

      # Deployment metadata template for visibility
      # Does not trigger restarts - deployment is handled by automation
      template {
        destination = "local/deployment-info.txt"
        change_mode = "noop"
        data = <<EOF
{{ $deploymentJson := keyOrDefault "email-service/deployment/main" "{}" }}
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
{{ $deploymentJson := keyOrDefault "email-service/deployment/main" "{}" }}
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
# BetterStack monitoring
BETTERSTACK_KEY={{ keyOrDefault "email-service/betterstack_key" "" }}

# Database connection - use Nomad service discovery to find pgpool
# This will resolve to the pgpool service running on the same node
{{ range service "pgpool" }}
# Get connection string and replace localhost with discovered address
{{ $connStr := keyOrDefault "pgpool/connection_string/local" "postgresql://proposalsapp:password@localhost:5432/proposalsapp" }}
DATABASE_URL={{ $connStr | regexReplaceAll "@localhost:" (printf "@%s:" .Address) }}
ARBITRUM_DATABASE_URL={{ $connStr | regexReplaceAll "@localhost:" (printf "@%s:" .Address) }}
UNISWAP_DATABASE_URL={{ $connStr | regexReplaceAll "@localhost:" (printf "@%s:" .Address) }}
{{ end }}

# Email service configuration
RESEND_API_KEY={{ keyOrDefault "email-service/resend_api_key" "" }}

# Application URL
WEB_URL={{ keyOrDefault "email-service/web_url" "https://proposals.app" }}

EOF
        destination = "secrets/env"
        env         = true
        change_mode = "noop"
      }

      resources {
        cpu    = 500   # 0.5 CPU core
        memory = 512   # 512MB RAM

        # Reserve additional resources for peak loads
        memory_max = 768  # Allow bursting to 768MB
      }

      service {
        name = "email-service"
        tags = [
          "backend",
          "nodejs",
          "email"
        ]
        port = "http"
        address_mode = "host"

        check {
          type     = "http"
          path     = "/health"
          interval = "10s"
          timeout  = "2s"
        }
      }
    }
  }
}