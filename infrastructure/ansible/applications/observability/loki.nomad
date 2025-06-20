job "loki" {
  region      = "global"
  datacenters = ["dc1", "dc2", "dc3"]
  type        = "service"

  constraint {
    attribute = "${attr.kernel.name}"
    value     = "linux"
  }

  group "loki" {
    count = 1

    constraint {
      distinct_hosts = true
    }

    network {
      mode = "host"
      
      port "http" {
        static = 3100
      }
      
      port "grpc" {
        static = 9095
      }
    }
    
    # Use ephemeral disk for storage
    ephemeral_disk {
      size = 5000  # 5GB
      migrate = true
      sticky = true
    }

    task "loki" {
      driver = "docker"

      config {
        image        = "grafana/loki:3.5.0"
        network_mode = "host"
        
        args = [
          "-config.file=/etc/loki/loki.yaml",
        ]

        volumes = [
          "local/loki.yaml:/etc/loki/loki.yaml",
        ]

        logging {
          type = "json-file"
          config {
            max-size = "10m"
            max-file = "10"
          }
        }
      }

      template {
        data = <<EOF
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9095
  log_level: info

common:
  instance_addr: 127.0.0.1
  path_prefix: /alloc/data/loki
  storage:
    filesystem:
      chunks_directory: /alloc/data/loki/chunks
      rules_directory: /alloc/data/loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

query_range:
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100

schema_config:
  configs:
    - from: 2024-04-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://localhost:9093

# By default, Loki will send anonymous, minimal usage statistics.
# You can disable this by setting analytics.reporting_enabled to false.
analytics:
  reporting_enabled: false

limits_config:
  retention_period: 720h  # 30 days
  reject_old_samples: true
  reject_old_samples_max_age: 168h
  ingestion_rate_mb: 16
  ingestion_burst_size_mb: 32
  per_stream_rate_limit: 5MB
  per_stream_rate_limit_burst: 20MB
  max_query_parallelism: 32
  max_streams_per_user: 10000
  volume_enabled: true
  allow_structured_metadata: true

compactor:
  working_directory: /alloc/data/loki/compactor
  compaction_interval: 10m
  retention_enabled: true
  retention_delete_delay: 2h
  retention_delete_worker_count: 150
  delete_request_store: filesystem

pattern_ingester:
  enabled: true
EOF
        destination = "local/loki.yaml"
        change_mode = "restart"
      }

      resources {
        cpu    = 1000
        memory = 2048
      }

      service {
        name = "loki"
        port = "http"
        tags = ["http", "logs", "urlprefix-/loki"]

        check {
          type     = "http"
          path     = "/metrics"
          interval = "10s"
          timeout  = "2s"
        }
      }

      service {
        name = "loki-grpc"
        port = "grpc"
        tags = ["grpc"]

        check {
          type     = "tcp"
          interval = "10s"
          timeout  = "2s"
        }
      }
    }
  }
}