job "alloy" {
  region      = "global"
  datacenters = ["dc1", "dc2", "dc3"]
  type        = "system"  # Runs on every node

  constraint {
    attribute = "${attr.kernel.name}"
    value     = "linux"
  }

  group "alloy" {
    network {
      mode = "host"
      
      port "http" {
        static = 12345
      }
    }

    task "alloy" {
      driver = "docker"

      config {
        image        = "grafana/alloy:v1.5.0"
        network_mode = "host"
        
        args = [
          "run",
          "/etc/alloy/config.alloy",
          "--server.http.listen-addr=0.0.0.0:12345",
        ]

        volumes = [
          "local/config.alloy:/etc/alloy/config.alloy",
          "/opt/nomad/alloc:/opt/nomad/alloc:ro",
          "/var/log:/var/log:ro",
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
// Discover Nomad allocation log files
local.file_match "nomad_logs" {
  path_targets = [
    {
      __path__ = "/opt/nomad/alloc/*/alloc/logs/*.stdout.[0-9]*",
      job = "nomad-alloc-logs",
      stream = "stdout",
    },
    {
      __path__ = "/opt/nomad/alloc/*/alloc/logs/*.stderr.[0-9]*", 
      job = "nomad-alloc-logs",
      stream = "stderr",
    },
  ]
  sync_period = "10s"
}

// Tail the discovered log files
loki.source.file "nomad_files" {
  targets    = local.file_match.nomad_logs.targets
  forward_to = [loki.process.nomad_logs.receiver]
  
  // Don't re-read old logs on restart
  tail_from_end = false
}

// Process and enrich logs
loki.process "nomad_logs" {
  // Extract metadata from file path
  stage.regex {
    expression = "/opt/nomad/alloc/(?P<alloc_id>[^/]+)/alloc/logs/(?P<task_name>[^.]+)\\.(?P<stream>stdout|stderr)"
  }
  
  // Add extracted values as labels
  stage.labels {
    values = {
      alloc_id    = "alloc_id",
      task_name   = "task_name",
      service_name = "task_name",  // Use task_name as service_name
      stream      = "stream",
      datacenter  = "{{ env "node.datacenter" }}",
      node        = "{{ env "node.unique.name" }}",
    }
  }

  // Parse JSON logs if present
  stage.json {
    expressions = {
      level      = "level",
      message    = "message", 
      timestamp  = "timestamp",
      target     = "target",
      span       = "span",
      file       = "file",
      line       = "line",
    }
    
    // Don't fail if JSON parsing fails (for non-JSON logs)
    drop_malformed = false
  }

  // Set level label from parsed JSON or default to info
  stage.labels {
    values = {
      level = "level",
    }
  }

  // Use timestamp from log if available
  stage.timestamp {
    source = "timestamp"
    format = "RFC3339"
    fallback_formats = [
      "2006-01-02T15:04:05.999999999Z07:00",
      "2006-01-02T15:04:05Z07:00",
    ]
    
    // Don't fail if timestamp parsing fails
    action_on_failure = "fudge"
  }
  
  forward_to = [loki.write.loki.receiver]
}

// System logs (optional)
local.file_match "system_logs" {
  path_targets = [
    {
      __path__ = "/var/log/syslog",
      job = "syslog",
    },
  ]
  sync_period = "10s"
}

loki.source.file "system_files" {
  targets    = local.file_match.system_logs.targets
  forward_to = [loki.process.system_logs.receiver]
}

loki.process "system_logs" {
  // Parse syslog format
  stage.regex {
    expression = "^(?P<timestamp>\\w+ \\d+ \\d+:\\d+:\\d+) (?P<hostname>\\S+) (?P<program>\\S+?)(\\[(?P<pid>\\d+)\\])?: (?P<message>.*)$"
  }
  
  stage.labels {
    values = {
      hostname = "hostname",
      program  = "program",
    }
  }
  
  stage.timestamp {
    source = "timestamp"
    format = "Jan 02 15:04:05"
    
    // Add the current year since syslog doesn't include it
    location = "Local"
  }
  
  forward_to = [loki.write.loki.receiver]
}

// Send logs to Loki
loki.write "loki" {
  endpoint {
    url = "http://{{ range service "loki" }}{{ .Address }}:{{ .Port }}{{ end }}/loki/api/v1/push"
    tenant_id = "proposalsapp"
    
    // Batch configuration
    // batch_size = 1048576  // Default is fine
    // batch_wait = "1s"     // Default is fine
  }
  
  // External labels added to all logs
  external_labels = {
    cluster = "proposalsapp",
    datacenter = "{{ env "node.datacenter" }}",
  }
}

// Expose metrics for monitoring
prometheus.exporter.self "alloy" {}

// Scrape our own metrics
prometheus.scrape "alloy" {
  targets    = prometheus.exporter.self.alloy.targets
  forward_to = [prometheus.remote_write.metrics.receiver]
  
  // Scrape every 60s
  scrape_interval = "60s"
}

// Send metrics to Prometheus (optional)
prometheus.remote_write "metrics" {
  endpoint {
    url = "http://prometheus.service.consul:9090/api/v1/write"
  }
}
EOF
        destination = "local/config.alloy"
        change_mode = "restart"
      }

      resources {
        cpu    = 200
        memory = 256
      }

      service {
        name = "alloy"
        port = "http"
        tags = ["metrics", "ui", "urlprefix-/alloy"]
        
        # Use Tailscale IP for service registration
        address = "${attr.tailscale.ip}"

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