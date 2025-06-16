job "web" {
  datacenters = ["dc1", "dc2", "dc3"]
  type = "service"
  
  update {
    max_parallel      = 1
    health_check      = "checks"
    min_healthy_time  = "30s"
    healthy_deadline  = "5m"
    progress_deadline = "10m"
    auto_revert       = true
  }
  
  group "nextjs" {
    count = 3
    
    spread {
      attribute = "${node.datacenter}"
      weight    = 100
    }
    
    migrate {
      max_parallel = 1
      health_check = "checks"
      min_healthy_time = "10s"
      healthy_deadline = "5m"
    }
    
    reschedule {
      attempts = 3
      interval = "30m"
      delay = "30s"
      delay_function = "exponential"
      max_delay = "1h"
      unlimited = true
    }
    
    ephemeral_disk {
      size = 1000
      sticky = false
      migrate = true
    }
    
    network {
      port "http" {
        to = 3000
      }
    }
    
    task "nextjs" {
      driver = "docker"
      
      restart {
        attempts = 3
        interval = "5m"
        delay = "15s"
        mode = "fail"
      }
      
      config {
        image = "${DOCKER_REGISTRY}/proposalsapp-web:${DOCKER_TAG}"
        ports = ["http"]
      }
      
      env {
        NODE_ENV = "production"
        PORT = "3000"
        
        # Database
        DATABASE_URL = "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}"
        
        # Redis
        REDIS_URL = "redis://:${REDIS_PASSWORD}@${REDIS_HOST}:6379"
        
        # NextAuth
        NEXTAUTH_URL = "https://${DOMAIN_NAME}"
        
        # Observability
        OTEL_EXPORTER_OTLP_ENDPOINT = "http://tempo.service.consul:4317"
        OTEL_SERVICE_NAME = "proposalsapp-web"
      }
      
      template {
        data = <<EOF
{{ range service "postgres-primary" }}
DB_HOST={{ .Address }}
{{ end }}

{{ range service "redis" | byTag (env "node.datacenter") }}
REDIS_HOST={{ .Address }}
{{ end }}

DB_USER={{ with secret "kv/postgres/app" }}{{ .Data.data.username }}{{ end }}
DB_PASSWORD={{ with secret "kv/postgres/app" }}{{ .Data.data.password }}{{ end }}
DB_NAME={{ with secret "kv/postgres/app" }}{{ .Data.data.database }}{{ end }}

REDIS_PASSWORD={{ with secret "kv/redis" }}{{ .Data.data.password }}{{ end }}

NEXTAUTH_SECRET={{ with secret "kv/nextauth" }}{{ .Data.data.secret }}{{ end }}

DOMAIN_NAME={{ key "config/domain" }}
DOCKER_REGISTRY={{ key "config/docker/registry" }}
DOCKER_TAG={{ key "config/docker/tag" }}
EOF
        destination = "secrets/env"
        env         = true
      }
      
      resources {
        cpu    = 500
        memory = 1024
      }
      
      service {
        name = "web"
        port = "http"
        tags = [
          "traefik.enable=true",
          "traefik.http.routers.web.rule=Host(`${DOMAIN_NAME}`)",
          "traefik.http.routers.web.entrypoints=http",
          "traefik.http.services.web.loadbalancer.sticky.cookie=true",
          "traefik.http.services.web.loadbalancer.sticky.cookie.name=proposalsapp"
        ]
        
        check {
          type     = "http"
          path     = "/api/health"
          interval = "30s"
          timeout  = "5s"
          
          check_restart {
            limit           = 3
            grace           = "90s"
            ignore_warnings = false
          }
        }
      }
    }
  }
}