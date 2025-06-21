job "mapper" {
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

  group "mapper" {
    count = 1  # Single instance service

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
      size    = 500
      sticky  = false
      migrate = true
    }

    network {
      port "http" {
        to = 3000
      }
    }

    task "mapper" {
      driver = "docker"

      config {
        # Image is hardcoded here, but will be overridden by job updates
        image = "ghcr.io/proposals-app/proposalsapp/mapper:latest"
        ports = ["http"]
        force_pull = true

        # Allow container to access host services
        extra_hosts = [
          "host.docker.internal:host-gateway"
        ]

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
        # Rust settings
        # Removed RUST_LOG to allow JSON formatting from code
        RUST_BACKTRACE = "1"

      }

      # This template watches for image changes and triggers restart
      # Only watches the image field to prevent restart loops
      template {
        destination = "local/deployment-trigger.txt"
        change_mode = "restart"
        data = <<EOF
{{ $deploymentJson := keyOrDefault "mapper/deployment/main" "{}" }}
{{ if $deploymentJson }}
{{ $deployment := $deploymentJson | parseJSON }}
{{ if $deployment.image }}{{ $deployment.image }}{{ else }}no-image{{ end }}
{{ else }}
no-deployment
{{ end }}
EOF
      }

      # Environment configuration template
      # Does not trigger restarts to avoid loops
      template {
        data = <<EOF
# Deployment metadata from Consul
{{ $deploymentJson := keyOrDefault "mapper/deployment/main" "{}" }}
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

# Database connection - use local pgpool connection string from Consul KV
# Replace localhost with host.docker.internal for Docker container access
{{ $dbUrl := keyOrDefault "pgpool/connection_string/local" "postgresql://proposalsapp:password@localhost:5432/proposalsapp" }}
DATABASE_URL={{ $dbUrl | regexReplaceAll "@localhost:" "@host.docker.internal:" }}

# BetterStack monitoring
BETTERSTACK_KEY={{ keyOrDefault "mapper/betterstack_key" "" }}

EOF
        destination = "secrets/env"
        env         = true
        change_mode = "noop"
      }

      resources {
        cpu    = 500   # 0.5 CPU core
        memory = 512   # 512MB RAM

        # Reserve additional resources for peak loads
        memory_max = 1024  # Allow bursting to 1GB
      }

      service {
        name = "mapper"
        tags = [
          "backend",
          "rust",
          "data-processing"
        ]
        port = "http"

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
