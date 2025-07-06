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
        static = 3000
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
        image        = "grafana/grafana:11.5.0"
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
      }

      template {
        data = <<EOF
[server]
http_addr = 0.0.0.0
http_port = 3000
root_url = http://grafana.proposals.app

[database]
type = sqlite3
path = /alloc/data/grafana.db

[security]
admin_user = admin
admin_password = admin
secret_key = KqloarKUwr9NrTecjZEnWJXFkiM5PwDI
disable_gravatar = true
cookie_secure = false
cookie_samesite = lax
strict_transport_security = false

[users]
allow_sign_up = false
allow_org_create = false
auto_assign_org = true
auto_assign_org_role = Viewer

[auth]
disable_login_form = false

[auth.anonymous]
enabled = false

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
    url: http://{{ range service "loki@dc1" }}{{ .NodeAddress }}:{{ .Port }}{{ else }}localhost:3100{{ end }}
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
    url: http://{{ range service "prometheus@dc1" }}{{ .NodeAddress }}:{{ .Port }}{{ end }}
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
        tags = ["http", "ui", "urlprefix-/grafana"]

        check {
          type     = "http"
          path     = "/api/health"
          interval = "10s"
          timeout  = "2s"
        }
      }
    }
  }
}