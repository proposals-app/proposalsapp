job "discourse" {
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

  group "discourse" {
    count = 1  # Single instance - indexes all discourse forums centrally

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
      healthy_deadline = "5m"
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
      port "health" {
        static = 3001
      }
    }

    task "discourse" {
      driver = "docker"

      config {
        # Image is hardcoded here, but will be overridden by job updates
        image = "ghcr.io/proposals-app/proposalsapp/discourse:latest"
        ports = ["health"]
        network_mode = "host"
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
        RUST_LOG = "info,discourse=debug"
        RUST_BACKTRACE = "1"

        # Database
        DATABASE_URL = "${DATABASE_URL}"

        # OpenTelemetry configuration
        OTEL_EXPORTER_OTLP_ENDPOINT = "${OTEL_EXPORTER_OTLP_ENDPOINT}"
        OTEL_SERVICE_NAME = "consul-discourse"

        # BetterStack monitoring (optional)
        BETTERSTACK_KEY = "${BETTERSTACK_KEY}"

        # Performance tuning
        TOKIO_WORKER_THREADS = "4"
        DATABASE_POOL_SIZE = "10"
        DATABASE_TIMEOUT = "30"
      }

      # This template watches for deployment changes and forces a restart
      template {
        destination = "local/deployment.txt"
        change_mode = "restart"
        data = <<EOF
{{ key "discourse/deployment/main" }}
EOF
      }
      
      template {
        data = <<EOF
# Deployment metadata from Consul
{{ $deployment := keyOrDefault "discourse/deployment/main" "{}" | parseJSON }}
DEPLOYMENT_IMAGE={{ $deployment.image | default "unknown" }}
DEPLOYMENT_TAG={{ $deployment.tag | default "unknown" }}
DEPLOYMENT_SHA={{ $deployment.sha | default "unknown" }}
DEPLOYMENT_TIME={{ $deployment.timestamp | default "unknown" }}

# Database connection - use local pgpool connection string from Consul KV
DATABASE_URL={{ keyOrDefault "pgpool/connection_string/local" "postgresql://proposalsapp:password@localhost:5432/proposalsapp" }}

# OpenTelemetry configuration from Consul KV
OTEL_EXPORTER_OTLP_ENDPOINT={{ keyOrDefault "discourse/otel_exporter_otlp_endpoint" "" }}

# BetterStack monitoring key (optional)
BETTERSTACK_KEY={{ keyOrDefault "discourse/betterstack_key" "" }}

EOF
        destination = "secrets/env"
        env         = true
        change_mode = "restart"
        change_signal = "SIGTERM"
      }

      resources {
        cpu    = 2000  # 2 CPU cores
        memory = 4096  # 4GB RAM

        # Reserve additional resources for peak loads
        memory_max = 6144  # Allow bursting to 6GB
      }

      service {
        name = "discourse"
        tags = ["indexer", "forum"]
        port = "health"

        check {
          type     = "http"
          path     = "/health"
          interval = "30s"
          timeout  = "5s"
        }
      }
    }
  }
}