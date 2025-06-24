job "traefik" {
  datacenters = ["dc1", "dc2", "dc3"]
  type = "system"  # Run on all nodes for high availability

  # High priority to ensure it runs
  priority = 95

  update {
    max_parallel      = 1
    health_check      = "checks"
    min_healthy_time  = "30s"
    healthy_deadline  = "5m"
    progress_deadline = "10m"
    auto_revert       = true
    stagger           = "30s"
  }

  group "traefik" {
    restart {
      attempts = 10
      interval = "5m"
      delay    = "25s"
      mode     = "delay"
    }

    network {
      port "http" {
        static = 8080
      }
      port "api" {
        static = 9080
      }
    }

    task "traefik" {
      driver = "docker"

      config {
        image = "traefik:v3.4.1"
        ports = ["http", "api"]
        network_mode = "host"

        volumes = [
          "local/traefik.yml:/etc/traefik/traefik.yml",
          "local/dynamic:/etc/traefik/dynamic"
        ]

        logging {
          type = "json-file"
          config {
            max-size = "10m"
            max-file = "3"
          }
        }
      }

      template {
        destination = "local/traefik.yml"
        data = <<EOF
# Traefik static configuration
api:
  dashboard: true
  debug: false

entryPoints:
  web:
    address: ":8080"
  traefik:
    address: ":9080"

providers:
  consulCatalog:
    endpoint:
      address: "127.0.0.1:8500"
      scheme: http
    exposedByDefault: false
    prefix: traefik
    watch: true

  file:
    directory: /etc/traefik/dynamic
    watch: true

# Certificate resolvers removed - using HTTP only

log:
  level: INFO
  format: json

accessLog:
  format: json

metrics:
  prometheus:
    addEntryPointsLabels: true
    addServicesLabels: true
    buckets:
      - 0.1
      - 0.3
      - 1.2
      - 5.0

ping:
  entryPoint: traefik
EOF
      }

      template {
        destination = "local/dynamic/cloudflare.yml"
        data = <<EOF
# Dynamic configuration for Cloudflare tunnels
http:
  middlewares:
    # Security headers
    secure-headers:
      headers:
        frameDeny: true
        browserXssFilter: true
        contentTypeNosniff: true
        forceSTSHeader: true
        stsIncludeSubdomains: true
        stsPreload: true
        stsSeconds: 31536000
        customFrameOptionsValue: "SAMEORIGIN"
        referrerPolicy: "strict-origin-when-cross-origin"


    # Rate limiting
    rate-limit:
      rateLimit:
        average: 100
        burst: 50

    # Compression
    compress:
      compress:
        excludedContentTypes:
          - text/event-stream
EOF
      }

      env {
        # Consul address
        CONSUL_HTTP_ADDR = "localhost:8500"
      }

      template {
        data = <<EOF
# Cloudflare credentials from Consul KV
CF_API_EMAIL={{ keyOrDefault "traefik/cf_api_email" "" }}
CF_API_KEY={{ keyOrDefault "traefik/cf_api_key" "" }}

# Domain configuration
DOMAIN={{ keyOrDefault "traefik/domain" "proposals.app" }}
EOF
        destination = "secrets/env"
        env         = true
        change_mode = "restart"
      }

      resources {
        cpu    = 200   # 200 MHz
        memory = 256   # 256MB RAM

        # Allow bursting for traffic spikes
        memory_max = 512
      }

      service {
        name = "traefik"
        tags = [
          "lb",
          "urlprefix-/traefik",
          "traefik.enable=true",
          "traefik.http.routers.api.rule=Host(`traefik.${DOMAIN}`)",
          "traefik.http.routers.api.entrypoints=traefik",
          "traefik.http.routers.api.service=api@internal"
        ]
        port = "api"

        check {
          type     = "http"
          path     = "/ping"
          interval = "10s"
          timeout  = "2s"
        }
      }

      service {
        name = "traefik-http"
        tags = ["http", "lb"]
        port = "http"
      }

    }
  }
}
