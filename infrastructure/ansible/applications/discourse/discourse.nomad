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
        to = 3001
      }
    }

    task "discourse" {
      driver = "docker"

      config {
        image = "${DISCOURSE_IMAGE}"
        ports = ["health"]
        network_mode = "host"

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
        OTEL_SERVICE_NAME = "discourse"

        # BetterStack monitoring (optional)
        BETTERSTACK_KEY = "${BETTERSTACK_KEY}"

        # Performance tuning
        TOKIO_WORKER_THREADS = "4"
        DATABASE_POOL_SIZE = "10"
        DATABASE_TIMEOUT = "30"
      }

      template {
        data = <<EOF
# Always use main branch for production deployments
{{ $imageTag := keyOrDefault "discourse/image/main" "latest" }}
DISCOURSE_IMAGE=ghcr.io/proposals-app/proposalsapp/discourse:{{ $imageTag }}

# Database connection - use local PgCat connection string from Consul KV
DATABASE_URL={{ keyOrDefault "pgcat/connection_string/local" "postgresql://proposalsapp:password@localhost:5432/proposalsapp" }}

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