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
        static = 3000
      }
    }

    task "rindexer" {
      driver = "docker"

      config {
        image = "${RINDEXER_IMAGE}"
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
        RUST_LOG = "info,rindexer=debug"
        RUST_BACKTRACE = "1"

        # Service configuration
        # Health check is on port 3000

        # Database
        DATABASE_URL = "${DATABASE_URL}"

        # Chain RPC endpoints
        ETHEREUM_NODE_URL = "${ETHEREUM_NODE_URL}"
        ARBITRUM_NODE_URL = "${ARBITRUM_NODE_URL}"
        AVALANCHE_NODE_URL = "${AVALANCHE_NODE_URL}"
        POLYGON_NODE_URL = "${POLYGON_NODE_URL}"
        OPTIMISM_NODE_URL = "${OPTIMISM_NODE_URL}"

        # Block explorer API keys
        ARBISCAN_API_KEY = "${ARBISCAN_API_KEY}"
        ETHERSCAN_API_KEY = "${ETHERSCAN_API_KEY}"
        OPTIMISTIC_SCAN_API_KEY = "${OPTIMISTIC_SCAN_API_KEY}"

        # OpenTelemetry configuration
        OTEL_EXPORTER_OTLP_ENDPOINT = "${OTEL_EXPORTER_OTLP_ENDPOINT}"
        OTEL_SERVICE_NAME = "rindexer"

        # Indexer settings
        INDEXER_BATCH_SIZE = "100"
        INDEXER_RETRY_LIMIT = "3"
        INDEXER_RETRY_DELAY = "5"

        # Performance tuning
        TOKIO_WORKER_THREADS = "4"
        DATABASE_POOL_SIZE = "10"
        DATABASE_TIMEOUT = "30"
      }

      template {
        data = <<EOF
# Always use main branch for production deployments
{{ $imageTag := keyOrDefault "rindexer/image/main" "latest" }}
RINDEXER_IMAGE=ghcr.io/proposals-app/proposalsapp/rindexer:{{ $imageTag }}

# Database connection - use local pgpool connection string from Consul KV
DATABASE_URL={{ keyOrDefault "pgpool/connection_string/local" "postgresql://proposalsapp:password@localhost:5432/proposalsapp" }}

# Chain RPC endpoints from Consul KV
ETHEREUM_NODE_URL={{ keyOrDefault "rindexer/ethereum_node_url" "" }}
ARBITRUM_NODE_URL={{ keyOrDefault "rindexer/arbitrum_node_url" "" }}
AVALANCHE_NODE_URL={{ keyOrDefault "rindexer/avalanche_node_url" "" }}
POLYGON_NODE_URL={{ keyOrDefault "rindexer/polygon_node_url" "" }}
OPTIMISM_NODE_URL={{ keyOrDefault "rindexer/optimism_node_url" "" }}

# Block explorer API keys from Consul KV
ARBISCAN_API_KEY={{ keyOrDefault "rindexer/arbiscan_api_key" "" }}
ETHERSCAN_API_KEY={{ keyOrDefault "rindexer/etherscan_api_key" "" }}
OPTIMISTIC_SCAN_API_KEY={{ keyOrDefault "rindexer/optimistic_scan_api_key" "" }}

# OpenTelemetry configuration from Consul KV
OTEL_EXPORTER_OTLP_ENDPOINT={{ keyOrDefault "rindexer/otel_exporter_otlp_endpoint" "" }}

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
        name = "rindexer"
        tags = ["indexer", "blockchain"]
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
