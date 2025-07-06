job "prometheus" {
  region      = "global"
  datacenters = ["dc1", "dc2", "dc3"]
  type        = "service"

  constraint {
    attribute = "${attr.kernel.name}"
    value     = "linux"
  }

  group "prometheus" {
    count = 1

    constraint {
      distinct_hosts = true
    }
    
    # Force deployment to dc1 for observability stack colocation
    constraint {
      attribute = "${node.datacenter}"
      value     = "dc1"
    }

    network {
      mode = "host"
      
      port "http" {
        static = 9090
      }
    }
    
    # Use ephemeral disk for storage
    ephemeral_disk {
      size = 10000  # 10GB
      migrate = true
      sticky = true
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

      service {
        name = "prometheus"
        port = "http"
        tags = ["http", "metrics", "urlprefix-/prometheus"]

        check {
          type     = "http"
          path     = "/-/ready"
          interval = "10s"
          timeout  = "2s"
        }
      }
    }
  }
}