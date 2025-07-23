job "observability-core" {
  region      = "global"
  datacenters = ["dc1", "dc2", "dc3"]
  type        = "service"

  # Core observability services: Prometheus (metrics), Loki (logs), Grafana (visualization)
  # Each service runs as a single instance across the cluster with proper Consul service discovery

  group "prometheus" {
    count = 1

    constraint {
      distinct_hosts = true
    }

    network {
      mode = "host"
      
      port "http" {
        static = 9090
        host_network = "tailscale"
      }
    }
    
    # Use ephemeral disk for storage
    ephemeral_disk {
      size = 10000  # 10GB
      migrate = true
      sticky = true
    }

    service {
      name = "prometheus"
      port = "http"
      address_mode = "host"
      tags = [
        "http",
        "metrics"
      ]

      check {
        type     = "http"
        path     = "/-/ready"
        interval = "10s"
        timeout  = "2s"
      }
    }

    task "prometheus" {
      driver = "docker"

      config {
        image        = "prom/prometheus:v3.4.2"
        network_mode = "host"
        
        args = [
          "--config.file=/etc/prometheus/prometheus.yml",
          "--storage.tsdb.path=/alloc/data",
          "--storage.tsdb.retention.time=15d",
          "--storage.tsdb.retention.size=10GB",
          "--web.console.libraries=/usr/share/prometheus/console_libraries",
          "--web.console.templates=/usr/share/prometheus/consoles",
          "--web.enable-lifecycle",
          "--web.enable-remote-write-receiver",
        ]

        volumes = [
          "local/prometheus.yml:/etc/prometheus/prometheus.yml",
          "local/alerts.yml:/etc/prometheus/alerts.yml",
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
global:
  scrape_interval: 15s
  evaluation_interval: 15s
  external_labels:
    datacenter: '{{ env "node.datacenter" }}'
    replica: '{{ env "node.unique.name" }}'

# Alertmanager configuration
alerting:
  alertmanagers:
    - static_configs:
        - targets: []

# Load rules once and periodically evaluate them
rule_files:
  - "alerts.yml"

scrape_configs:
  # Scrape Prometheus itself
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  # Scrape Consul services dynamically
  - job_name: 'consul-services'
    consul_sd_configs:
      - server: '{{ env "attr.unique.network.ip-address" }}:8500'
        datacenter: '{{ env "node.datacenter" }}'
        services: []
    relabel_configs:
      # Keep only services with 'metrics' tag
      - source_labels: [__meta_consul_tags]
        regex: .*,metrics,.*
        action: keep
      # Use service name as job label
      - source_labels: [__meta_consul_service]
        target_label: job
      # Include all Consul metadata as labels
      - regex: __meta_consul_service_metadata_(.+)
        action: labelmap

  # Scrape ERPC metrics specifically from all datacenters
  - job_name: 'erpc'
    consul_sd_configs:
      - server: '{{ env "attr.unique.network.ip-address" }}:8500'
        datacenter: 'dc1'
        services: ['erpc-metrics']
      - server: '{{ env "attr.unique.network.ip-address" }}:8500'
        datacenter: 'dc2' 
        services: ['erpc-metrics']
      - server: '{{ env "attr.unique.network.ip-address" }}:8500'
        datacenter: 'dc3'
        services: ['erpc-metrics']
    relabel_configs:
      - source_labels: [__meta_consul_service]
        target_label: job
        replacement: erpc

  # Scrape Traefik metrics
  - job_name: 'traefik'
    consul_sd_configs:
      - server: '{{ env "attr.unique.network.ip-address" }}:8500'
        services: ['traefik-metrics']
    relabel_configs:
      - source_labels: [__meta_consul_service]
        target_label: job

  # Scrape Cloudflared metrics
  - job_name: 'cloudflared'
    consul_sd_configs:
      - server: '{{ env "attr.unique.network.ip-address" }}:8500'
        services: ['cloudflared-metrics']
    relabel_configs:
      - source_labels: [__meta_consul_service]
        target_label: job

  # Scrape application metrics (once we add /metrics endpoints)
  - job_name: 'applications'
    consul_sd_configs:
      - server: '{{ env "attr.unique.network.ip-address" }}:8500'
        services: 
          - 'rindexer'
          - 'discourse'
          - 'mapper'
          - 'web'
    relabel_configs:
      # Only scrape if service has metrics endpoint
      - source_labels: [__meta_consul_service_metadata_metrics_path]
        regex: (.+)
        action: keep
      # Use metadata for metrics path
      - source_labels: [__meta_consul_service_metadata_metrics_path]
        target_label: __metrics_path__
        regex: (.+)
      # Service name as job label
      - source_labels: [__meta_consul_service]
        target_label: job
      # Add all service metadata as labels
      - regex: __meta_consul_service_metadata_(.+)
        action: labelmap

  # Scrape Loki metrics
  - job_name: 'loki'
    consul_sd_configs:
      - server: '{{ env "attr.unique.network.ip-address" }}:8500'
        services: ['loki']
    metrics_path: '/metrics'
    relabel_configs:
      - source_labels: [__meta_consul_service]
        target_label: job

  # Scrape Promtail metrics
  - job_name: 'promtail'
    consul_sd_configs:
      - server: '{{ env "attr.unique.network.ip-address" }}:8500'
        services: ['promtail']
    metrics_path: '/metrics'
    relabel_configs:
      - source_labels: [__meta_consul_service]
        target_label: job
      - source_labels: [__meta_consul_node]
        target_label: instance

  # Scrape Nomad metrics
  - job_name: 'nomad'
    metrics_path: '/v1/metrics'
    params:
      format: ['prometheus']
    consul_sd_configs:
      - server: '{{ env "attr.unique.network.ip-address" }}:8500'
        services: ['nomad-client', 'nomad']
    relabel_configs:
      - source_labels: [__meta_consul_service]
        regex: nomad-client
        target_label: job
        replacement: nomad-client
      - source_labels: [__meta_consul_service]
        regex: nomad
        target_label: job
        replacement: nomad-server

  # Scrape Consul metrics
  - job_name: 'consul'
    metrics_path: '/v1/agent/metrics'
    params:
      format: ['prometheus']
    consul_sd_configs:
      - server: '{{ env "attr.unique.network.ip-address" }}:8500'
        services: ['consul']
    relabel_configs:
      - source_labels: [__address__]
        regex: (.+):8300
        target_label: __address__
        replacement: ${1}:8500
EOF
        destination = "local/prometheus.yml"
        change_mode = "restart"
      }

      template {
        data = <<EOF
groups:
  - name: proposalsapp_alerts
    interval: 30s
    rules:
      # Service health alerts
      - alert: ServiceDown
        expr: up == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Service {{ "{{ $labels.job }}" }} is down"
          description: "{{ "{{ $labels.job }}" }} on {{ "{{ $labels.instance }}" }} has been down for more than 5 minutes."

      # High error rate
      - alert: HighErrorRate
        expr: |
          (
            sum(rate(http_requests_total{status=~"5.."}[5m])) by (job)
            /
            sum(rate(http_requests_total[5m])) by (job)
          ) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate on {{ "{{ $labels.job }}" }}"
          description: "{{ "{{ $labels.job }}" }} has error rate above 5% (current: {{ "{{ $value | humanizePercentage }}" }})"

      # Loki ingestion rate
      - alert: LokiIngestionRateHigh
        expr: rate(loki_ingester_streams_created_total[5m]) > 1000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Loki ingestion rate is high"
          description: "Loki is creating more than 1000 streams per second"

      # Disk space alerts
      - alert: DiskSpaceLow
        expr: |
          (
            node_filesystem_avail_bytes{mountpoint="/"}
            /
            node_filesystem_size_bytes{mountpoint="/"}
          ) < 0.1
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "Low disk space on {{ "{{ $labels.instance }}" }}"
          description: "{{ "{{ $labels.instance }}" }} has less than 10% disk space available"

      # Memory usage alerts
      - alert: HighMemoryUsage
        expr: |
          (
            1 - (
              node_memory_MemAvailable_bytes
              /
              node_memory_MemTotal_bytes
            )
          ) > 0.9
        for: 15m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage on {{ "{{ $labels.instance }}" }}"
          description: "{{ "{{ $labels.instance }}" }} memory usage is above 90%"
EOF
        destination = "local/alerts.yml"
        change_mode = "restart"
      }

      resources {
        cpu    = 1000
        memory = 2048
      }
    }
  }

  # Loki group - Log aggregation service (single instance)
  group "loki" {
    count = 1

    constraint {
      distinct_hosts = true
    }
    
    reschedule {
      delay          = "5s"      # Fast recovery
      delay_function = "constant"
      max_delay      = "30s"
      unlimited      = true
    }

    restart {
      attempts = 10
      interval = "10m"
      delay    = "10s"
      mode     = "delay"
    }

    network {
      mode = "host"
      
      port "http" {
        static = 3100
        host_network = "tailscale"
      }
      
      port "grpc" {
        static = 9095
        host_network = "tailscale"
      }
    }
    
    # Use ephemeral disk for storage
    ephemeral_disk {
      size = 10000  # 10GB - More space for caching
      migrate = true
      sticky = true
    }

    task "loki" {
      driver = "docker"

      config {
        image        = "grafana/loki:3.5.1"
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
  grpc_server_max_recv_msg_size: 33554432  # 32MB - Handle larger queries
  grpc_server_max_send_msg_size: 33554432  # 32MB - Handle larger responses
  http_server_read_timeout: 600s  # 10 min for long queries
  http_server_write_timeout: 600s

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
        max_size_mb: 500  # Increased for better query performance
        ttl: 1h
  parallelise_shardable_queries: true
  cache_results: true
  max_retries: 5

# Chunk store caching for faster queries
chunk_store_config:
  chunk_cache_config:
    embedded_cache:
      enabled: true
      max_size_mb: 1000  # 1GB chunk cache
      ttl: 1h

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
  enable_api: true
  # Store rules locally
  storage:
    type: local
    local:
      directory: /alloc/data/loki/rules
  rule_path: /alloc/data/loki/rules
  evaluation_interval: 1m

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
  max_query_parallelism: 64  # Increased for better performance
  max_streams_per_user: 10000
  volume_enabled: true
  allow_structured_metadata: true
  max_entries_limit_per_query: 50000  # Handle larger result sets
  max_global_streams_per_user: 50000
  max_label_name_length: 1024
  max_label_value_length: 2048
  max_label_names_per_series: 30

compactor:
  working_directory: /alloc/data/loki/compactor
  compaction_interval: 10m
  retention_enabled: true
  retention_delete_delay: 2h
  retention_delete_worker_count: 150
  delete_request_store: filesystem

pattern_ingester:
  enabled: true

query_scheduler:
  max_outstanding_requests_per_tenant: 4096  # Handle more queries

frontend:
  max_outstanding_per_tenant: 4096  # Handle more concurrent queries
  compress_responses: true
  log_queries_longer_than: 10s  # Identify slow queries
  
ingester:
  wal:
    enabled: true
    dir: /alloc/data/loki/wal
  lifecycler:
    ring:
      kvstore:
        store: inmemory
  chunk_idle_period: 30m  # Flush more frequently for faster availability
  max_chunk_age: 1h  # Reduced for better real-time performance
  concurrent_flushes: 32  # Parallel chunk flushing
  chunk_target_size: 1572864  # 1.5MB
  chunk_retain_period: 5m
  flush_check_period: 10s
EOF
        destination = "local/loki.yaml"
        change_mode = "restart"
      }

      resources {
        cpu    = 2000   # Increased for better performance
        memory = 4096   # Increased for caching
      }

      service {
        name = "loki"
        port = "http"
        tags = ["http", "logs", "urlprefix-/loki"]
        address_mode = "host"

        check {
          type     = "http"
          path     = "/ready"
          interval = "5s"    # Reduced from 10s
          timeout  = "2s"
          
          check_restart {
            limit = 3
            grace = "60s"     # Longer grace for Loki startup
            ignore_warnings = false
          }
        }
      }

      service {
        name = "loki-grpc"
        port = "grpc"
        tags = ["grpc"]
        address_mode = "host"

        check {
          type     = "tcp"
          interval = "5s"    # Reduced from 10s
          timeout  = "2s"
        }
      }
    }
  }

  # Grafana group - Visualization dashboard (single instance)
  group "grafana" {
    count = 1

    # No constraint - let Nomad place it optimally
    # This allows Grafana to move to any available node
    
    reschedule {
      delay          = "5s"      # Fast recovery
      delay_function = "constant"
      max_delay      = "30s"
      unlimited      = true
    }

    restart {
      attempts = 10
      interval = "10m"
      delay    = "10s"
      mode     = "delay"
    }

    network {
      mode = "host"
      
      port "http" {
        static = 3300
        host_network = "tailscale"
      }
    }
    
    # Use ephemeral disk for storage
    ephemeral_disk {
      size = 1000  # 1GB
      migrate = true
      sticky = true
    }

    task "grafana" {
      driver = "docker"

      config {
        image        = "grafana/grafana:12.0.2"
        network_mode = "host"
        
        volumes = [
          "local/grafana.ini:/etc/grafana/grafana.ini",
          "local/provisioning:/etc/grafana/provisioning",
        ]

        logging {
          type = "json-file"
          config {
            max-size = "10m"
            max-file = "10"
          }
        }
      }

      env {
        GF_PATHS_DATA = "/alloc/data"
        GF_SERVER_ROOT_URL = "https://grafana.proposals.app"
        GF_SERVER_SERVE_FROM_SUB_PATH = "false"
      }

      template {
        data = <<EOF
[server]
protocol = http
http_addr = 0.0.0.0
http_port = 3300
domain = grafana.proposals.app
enforce_domain = false
root_url = https://grafana.proposals.app
serve_from_sub_path = false
enable_gzip = true

[database]
type = sqlite3
path = /alloc/data/grafana.db

[security]
admin_user = admin
admin_password = admin
secret_key = KqloarKUwr9NrTecjZEnWJXFkiM5PwDI
disable_gravatar = true
cookie_secure = true
cookie_samesite = lax
strict_transport_security = false
allow_embedding = false

[users]
allow_sign_up = false
allow_org_create = false
auto_assign_org = true
auto_assign_org_role = Viewer

[auth]
disable_login_form = false

[auth.anonymous]
enabled = false

[auth.proxy]
enabled = false
header_name = X-WEBAUTH-USER
header_property = username
auto_sign_up = false

[analytics]
reporting_enabled = false
check_for_updates = false
check_for_plugin_updates = false

[log]
mode = console
level = info

[explore]
enabled = true

[feature_toggles]
enable = traceToMetrics,exploreMetrics,metricsExplore,logsContextDatasourceUi,exploreLogsShardSplitting,lokiQuerySplitting,lokiQuerySplittingByRange

[unified_alerting]
enabled = true

[alerting]
enabled = false
EOF
        destination = "local/grafana.ini"
        change_mode = "restart"
      }

      template {
        data = <<EOF
apiVersion: 1

datasources:
  - name: Loki
    type: loki
    access: proxy
    url: http://{{ range service "loki" }}{{ .Address }}:{{ .Port }}{{ else }}{{ range service "loki@dc1" }}{{ .Address }}:{{ .Port }}{{ else }}{{ range service "loki@dc2" }}{{ .Address }}:{{ .Port }}{{ else }}{{ range service "loki@dc3" }}{{ .Address }}:{{ .Port }}{{ else }}localhost:3100{{ end }}{{ end }}{{ end }}{{ end }}
    jsonData:
      maxLines: 10000
      timeout: 300
      queryTimeout: 300s
      cacheLevel: "Low"
      httpHeaderName1: "X-Scope-OrgID"
    secureJsonData:
      httpHeaderValue1: "1"
    editable: true
    isDefault: true

  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://{{ range service "prometheus" }}{{ .Address }}:{{ .Port }}{{ else }}{{ range service "prometheus@dc1" }}{{ .Address }}:{{ .Port }}{{ else }}{{ range service "prometheus@dc2" }}{{ .Address }}:{{ .Port }}{{ else }}{{ range service "prometheus@dc3" }}{{ .Address }}:{{ .Port }}{{ else }}localhost:9090{{ end }}{{ end }}{{ end }}{{ end }}
    jsonData:
      timeInterval: 15s
      queryTimeout: 60s
      httpMethod: POST
    editable: true

  - name: Tempo
    type: tempo
    access: proxy
    url: http://{{ range service "tempo" }}{{ .Address }}:{{ .Port }}{{ end }}
    jsonData:
      tracesToLogsV2:
        datasourceUid: loki
        spanStartTimeShift: -1h
        spanEndTimeShift: 1h
        filterByTraceID: true
        filterBySpanID: true
      tracesToMetrics:
        datasourceUid: prometheus
      nodeGraph:
        enabled: true
      search:
        hide: false
      lokiSearch:
        datasourceUid: loki
    editable: true
EOF
        destination = "local/provisioning/datasources/datasources.yaml"
        change_mode = "restart"
      }

      resources {
        cpu    = 500
        memory = 512
      }

      service {
        name = "grafana"
        port = "http"
        address_mode = "host"
        tags = [
          "http",
          "ui",
          "monitoring"
        ]

        check {
          type     = "http"
          path     = "/api/health"
          interval = "5s"    # Reduced from 10s
          timeout  = "2s"
          
          check_restart {
            limit = 3
            grace = "30s"
            ignore_warnings = false
          }
        }
      }
    }
  }
}