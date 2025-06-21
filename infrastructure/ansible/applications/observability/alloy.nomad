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
          "/var/lib/nomad/alloc:/var/lib/nomad/alloc:ro",
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
// Simple Alloy configuration for ProposalsApp logs

// File discovery
local.file_match "logs" {
  path_targets = [
    {
      __path__ = "/var/lib/nomad/alloc/*/alloc/logs/rindexer.stdout.*",
      job = "rindexer",
    },
    {
      __path__ = "/var/lib/nomad/alloc/*/alloc/logs/discourse.stdout.*",
      job = "discourse",
    },
    {
      __path__ = "/var/lib/nomad/alloc/*/alloc/logs/mapper.stdout.*",
      job = "mapper",
    },
    {
      __path__ = "/var/lib/nomad/alloc/*/alloc/logs/web.stdout.*",
      job = "web",
    },
    {
      __path__ = "/var/lib/nomad/alloc/*/alloc/logs/email-service.stdout.*",
      job = "email-service",
    },
  ]
}

// Read log files
loki.source.file "logs" {
  targets = local.file_match.logs.targets
  forward_to = [loki.process.json.receiver]
  tail_from_end = true
}

// Process logs
loki.process "json" {
  // Try to parse as JSON
  stage.json {
    expressions = {
      timestamp = "timestamp",
      level = "level",
      message = "message",
      service = "service",
      user_id = "user_id",
      dao = "dao",
      proposal_id = "proposal_id",
    }
  }

  // Set timestamp if found
  stage.timestamp {
    source = "timestamp"
    format = "RFC3339"
    action_on_failure = "fudge"
  }

  // Add level label if found
  stage.labels {
    values = {
      level = "",
    }
  }

  // Add high cardinality fields as metadata
  stage.structured_metadata {
    values = {
      service = "",
      user_id = "",
      dao = "",
      proposal_id = "",
    }
  }

  // Output the message or original line
  stage.output {
    source = "message"
  }

  forward_to = [loki.write.loki.receiver]
}

// Send to Loki
loki.write "loki" {
  endpoint {
    url = "http://{{ range service "loki@dc1" }}{{ .NodeAddress }}:{{ .Port }}{{ else }}localhost:3100{{ end }}/loki/api/v1/push"
    batch_size = "1MiB"
    batch_wait = "1s"
  }
  
  external_labels = {
    cluster = "proposalsapp",
    datacenter = "{{ env "node.datacenter" }}",
  }
}

// Metrics export
prometheus.exporter.self "alloy" {}

prometheus.scrape "alloy" {
  targets = prometheus.exporter.self.alloy.targets
  forward_to = [prometheus.remote_write.metrics.receiver]
  scrape_interval = "60s"
}

prometheus.remote_write "metrics" {
  endpoint {
    url = "http://{{ range service "prometheus@dc1" }}{{ .NodeAddress }}:{{ .Port }}{{ else }}localhost:9090{{ end }}/api/v1/write"
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
        
        # Let Consul determine the address

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