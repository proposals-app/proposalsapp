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
        image        = "grafana/alloy:v1.9.2"
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
        # Don't block on missing services
        wait {
          min = "2s"
          max = "10s"
        }
        error_on_missing_key = false
        
        data = <<EOF
// Simple Alloy configuration for ProposalsApp logs

// File discovery
local.file_match "logs" {
  path_targets = [
    // rindexer logs
    {
      __path__ = "/var/lib/nomad/alloc/*/alloc/logs/rindexer.stdout.*",
      job = "rindexer",
      stream = "stdout",
    },
    {
      __path__ = "/var/lib/nomad/alloc/*/alloc/logs/rindexer.stderr.*",
      job = "rindexer",
      stream = "stderr",
    },
    // discourse logs
    {
      __path__ = "/var/lib/nomad/alloc/*/alloc/logs/discourse.stdout.*",
      job = "discourse",
      stream = "stdout",
    },
    {
      __path__ = "/var/lib/nomad/alloc/*/alloc/logs/discourse.stderr.*",
      job = "discourse",
      stream = "stderr",
    },
    // mapper logs
    {
      __path__ = "/var/lib/nomad/alloc/*/alloc/logs/mapper.stdout.*",
      job = "mapper",
      stream = "stdout",
    },
    {
      __path__ = "/var/lib/nomad/alloc/*/alloc/logs/mapper.stderr.*",
      job = "mapper",
      stream = "stderr",
    },
    // web logs
    {
      __path__ = "/var/lib/nomad/alloc/*/alloc/logs/web.stdout.*",
      job = "web",
      stream = "stdout",
    },
    {
      __path__ = "/var/lib/nomad/alloc/*/alloc/logs/web.stderr.*",
      job = "web",
      stream = "stderr",
    },
    // email-service logs
    {
      __path__ = "/var/lib/nomad/alloc/*/alloc/logs/email-service.stdout.*",
      job = "email-service",
      stream = "stdout",
    },
    {
      __path__ = "/var/lib/nomad/alloc/*/alloc/logs/email-service.stderr.*",
      job = "email-service",
      stream = "stderr",
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

  stage.timestamp {
    source = "timestamp"
    format = "RFC3339"
    action_on_failure = "fudge"
  }

  stage.labels {
    values = {
      level = "",
      stream = "",
    }
  }

  stage.structured_metadata {
    values = {
      service = "",
      user_id = "",
      dao = "",
      proposal_id = "",
    }
  }

  stage.output {
    source = "message"
  }

  forward_to = [loki.write.loki.receiver]
}

// Send to Loki
loki.write "loki" {
  endpoint {
    {{ $lokiFound := false }}
    {{- range service "loki" }}
    {{- $lokiFound = true }}
    url = "http://{{ .Address }}:{{ .Port }}/loki/api/v1/push"
    {{- end }}
    {{- if not $lokiFound }}
    {{- range datacenters }}
    {{- $dc := . }}
    {{- range service (printf "loki@%s" $dc) }}
    {{- $lokiFound = true }}
    url = "http://{{ .Address }}:{{ .Port }}/loki/api/v1/push"
    {{- end }}
    {{- end }}
    {{- end }}
    {{- if not $lokiFound }}
    url = "http://localhost:3100/loki/api/v1/push"
    {{- end }}
    batch_size = "4MiB"
    batch_wait = "2s"
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
    {{ $promFound := false }}
    {{- range service "prometheus" }}
    {{- $promFound = true }}
    url = "http://{{ .Address }}:{{ .Port }}/api/v1/write"
    {{- end }}
    {{- if not $promFound }}
    {{- range datacenters }}
    {{- $dc := . }}
    {{- range service (printf "prometheus@%s" $dc) }}
    {{- $promFound = true }}
    url = "http://{{ .Address }}:{{ .Port }}/api/v1/write"
    {{- end }}
    {{- end }}
    {{- end }}
    {{- if not $promFound }}
    url = "http://localhost:9090/api/v1/write"
    {{- end }}
  }
}
EOF
        destination = "local/config.alloy"
        change_mode = "restart"
      }

      resources {
        cpu    = 400
        memory = 512
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