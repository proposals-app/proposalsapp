job "grafana" {
  region      = "global"
  datacenters = ["dc1", "dc2", "dc3"]
  type        = "service"

  constraint {
    attribute = "${attr.kernel.name}"
    value     = "linux"
  }

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