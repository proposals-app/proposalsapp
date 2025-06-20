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
        image        = "grafana/alloy:v1.4.0"
        network_mode = "host"
        
        args = [
          "run",
          "/etc/alloy/config.alloy",
          "--server.http.listen-addr=0.0.0.0:12345",
        ]

        volumes = [
          "local/config.alloy:/etc/alloy/config.alloy",
          "/opt/nomad/alloc:/opt/nomad/alloc:ro",
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
    }
    
    // Don't fail if JSON parsing fails (for non-JSON logs)
    drop_malformed = false
  }

  // Set level label from parsed JSON
  stage.labels {
    values = {
      level = "level",
    }
  }
  
  forward_to = [loki.write.loki.receiver]
}

// Send logs to Loki
loki.write "loki" {
  endpoint {
    url = "http://{{ range service "loki" }}{{ .Address }}:{{ .Port }}{{ end }}/loki/api/v1/push"
    tenant_id = "proposalsapp"
  }
  
  // External labels added to all logs
  external_labels = {
    cluster = "proposalsapp",
    datacenter = "{{ env "node.datacenter" }}",
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
        tags = ["metrics", "ui"]

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