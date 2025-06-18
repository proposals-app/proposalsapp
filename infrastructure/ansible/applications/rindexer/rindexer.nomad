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
      port "metrics" {
        to = 9090
      }
    }
    
    task "rindexer" {
      driver = "docker"
      
      config {
        image = "${RINDEXER_IMAGE}"
        ports = ["metrics"]
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
        METRICS_PORT = "9090"
        
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

# Database connection - use local PgCat connection string from Consul KV
DATABASE_URL={{ key "pgcat/connection_string/local" }}

# Chain RPC endpoints from Consul KV
ETHEREUM_NODE_URL={{ key "rindexer/ethereum_node_url" }}
ARBITRUM_NODE_URL={{ key "rindexer/arbitrum_node_url" }}
AVALANCHE_NODE_URL={{ key "rindexer/avalanche_node_url" }}
POLYGON_NODE_URL={{ key "rindexer/polygon_node_url" }}
OPTIMISM_NODE_URL={{ key "rindexer/optimism_node_url" }}

# Block explorer API keys from Consul KV
ARBISCAN_API_KEY={{ key "rindexer/arbiscan_api_key" }}
ETHERSCAN_API_KEY={{ key "rindexer/etherscan_api_key" }}
OPTIMISTIC_SCAN_API_KEY={{ key "rindexer/optimistic_scan_api_key" }}

# OpenTelemetry configuration from Consul KV
OTEL_EXPORTER_OTLP_ENDPOINT={{ key "rindexer/otel_exporter_otlp_endpoint" }}

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
        name = "rindexer-metrics"
        tags = ["prometheus", "metrics"]
        port = "metrics"
        
        check {
          type     = "http"
          path     = "/metrics"
          interval = "60s"
          timeout  = "5s"
        }
      }
    }
  }
}