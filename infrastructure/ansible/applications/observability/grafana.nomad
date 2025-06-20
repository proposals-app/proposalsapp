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
        GF_INSTALL_PLUGINS = "grafana-piechart-panel,redis-datasource,grafana-lokiexplore-app"
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
enable = traceToMetrics,publicDashboards,exploreMetrics,metricsExplore,exploreLogsShardSplitting,exploreMetricsRelatedLogs

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
    url: http://{{ range service "loki" }}{{ .Address }}:{{ .Port }}{{ end }}
    jsonData:
      maxLines: 5000
      timeout: 60
      derivedFields:
        - datasourceUid: prometheus
          matcherRegex: '"service_name":"([^"]+)"'
          name: Service
          url: '/explore?orgId=1&left=%5B%22now-1h%22,%22now%22,%22Prometheus%22,%7B%22expr%22:%22%7Bjob%3D%5C%22$%7B__value.raw%7D%5C%22%7D%22%7D%5D'
    editable: true
    isDefault: true

  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://{{ range service "prometheus" }}{{ .Address }}:{{ .Port }}{{ end }}
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

      template {
        data = <<EOF
apiVersion: 1

providers:
  - name: 'ProposalsApp'
    orgId: 1
    folder: 'ProposalsApp'
    type: file
    disableDeletion: false
    updateIntervalSeconds: 30
    allowUiUpdates: true
    options:
      path: /etc/grafana/provisioning/dashboards
EOF
        destination = "local/provisioning/dashboards/dashboards.yaml"
        change_mode = "restart"
      }

      # Create a basic application dashboard
      template {
        data = <<EOF
{
  "title": "ProposalsApp Overview",
  "uid": "proposalsapp-overview",
  "timezone": "browser",
  "schemaVersion": 38,
  "panels": [
      {
        "datasource": {
          "type": "loki",
          "uid": "$${DS_LOKI}"
        },
        "gridPos": {
          "h": 8,
          "w": 24,
          "x": 0,
          "y": 0
        },
        "id": 1,
        "options": {
          "showTime": true,
          "showLabels": true,
          "showCommonLabels": false,
          "wrapLogMessage": true,
          "sortOrder": "Descending",
          "dedupStrategy": "none",
          "enableLogDetails": true,
          "prettifyLogMessage": false
        },
        "targets": [
          {
            "datasource": {
              "type": "loki",
              "uid": "$${DS_LOKI}"
            },
            "expr": "{job=\"nomad-alloc-logs\",task_name=~\"$task\",level=~\"$level\"}",
            "refId": "A"
          }
        ],
        "title": "Application Logs",
        "type": "logs"
      },
      {
        "datasource": {
          "type": "loki",
          "uid": "$${DS_LOKI}"
        },
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 0,
          "y": 8
        },
        "id": 2,
        "options": {
          "legend": {
            "displayMode": "list",
            "placement": "bottom",
            "showLegend": true
          },
          "tooltip": {
            "mode": "single",
            "sort": "none"
          }
        },
        "targets": [
          {
            "datasource": {
              "type": "loki",
              "uid": "$${DS_LOKI}"
            },
            "expr": "sum by (level) (rate({job=\"nomad-alloc-logs\",task_name=~\"$task\"} |= \"\" [$__interval]))",
            "refId": "A"
          }
        ],
        "title": "Log Rate by Level",
        "type": "timeseries"
      },
      {
        "datasource": {
          "type": "loki",
          "uid": "$${DS_LOKI}"
        },
        "gridPos": {
          "h": 8,
          "w": 12,
          "x": 12,
          "y": 8
        },
        "id": 3,
        "options": {
          "legend": {
            "displayMode": "list",
            "placement": "bottom",
            "showLegend": true
          },
          "tooltip": {
            "mode": "single",
            "sort": "none"
          }
        },
        "targets": [
          {
            "datasource": {
              "type": "loki",
              "uid": "$${DS_LOKI}"
            },
            "expr": "sum by (task_name) (rate({job=\"nomad-alloc-logs\"} |= \"\" [$__interval]))",
            "refId": "A"
          }
        ],
        "title": "Log Rate by Service",
        "type": "timeseries"
      }
    ],
    "templating": {
      "list": [
        {
          "current": {
            "selected": true,
            "text": ["All"],
            "value": ["$__all"]
          },
          "datasource": {
            "type": "loki",
            "uid": "$${DS_LOKI}"
          },
          "definition": "label_values({job=\"nomad-alloc-logs\"}, task_name)",
          "hide": 0,
          "includeAll": true,
          "label": "Task",
          "multi": true,
          "name": "task",
          "options": [],
          "query": "label_values({job=\"nomad-alloc-logs\"}, task_name)",
          "refresh": 2,
          "regex": "",
          "skipUrlSync": false,
          "sort": 1,
          "type": "query"
        },
        {
          "current": {
            "selected": true,
            "text": ["All"],
            "value": ["$__all"]
          },
          "datasource": {
            "type": "loki",
            "uid": "$${DS_LOKI}"
          },
          "definition": "label_values({job=\"nomad-alloc-logs\"}, level)",
          "hide": 0,
          "includeAll": true,
          "label": "Log Level",
          "multi": true,
          "name": "level",
          "options": [],
          "query": "label_values({job=\"nomad-alloc-logs\"}, level)",
          "refresh": 2,
          "regex": "",
          "skipUrlSync": false,
          "sort": 1,
          "type": "query"
        }
      ]
    }
}
EOF
        destination = "local/provisioning/dashboards/proposalsapp-overview.json"
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