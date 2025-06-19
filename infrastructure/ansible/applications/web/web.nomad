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
    auto_promote      = true
    canary            = 1
    stagger           = "30s"
  }
  
  group "web" {
    count = 3  # One per datacenter for high availability
    
    # Spread across datacenters
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
      delay          = "30s"
      delay_function = "exponential"
      max_delay      = "1h"
      unlimited      = true
    }
    
    restart {
      attempts = 3
      interval = "5m"
      delay    = "30s"
      mode     = "delay"
    }
    
    ephemeral_disk {
      size    = 500
      sticky  = false
      migrate = true
    }
    
    network {
      port "http" {
        static = 3002
      }
    }
    
    task "web" {
      driver = "docker"
      
      config {
        image = "${WEB_IMAGE}"
        ports = ["http"]
        network_mode = "host"
        
        # Add logging configuration
        logging {
          type = "json-file"
          config {
            max-size = "10m"
            max-file = "3"
          }
        }
      }
      
      env {
        # Node.js settings
        NODE_ENV = "production"
        PORT = "3002"
        
        # Application configuration
        NEXT_PUBLIC_ROOT_DOMAIN = "${ROOT_DOMAIN}"
        NEXT_PUBLIC_SPECIAL_SUBDOMAINS = "${SPECIAL_SUBDOMAINS}"
        
        # Database connection - use local pgpool connection string from Consul KV
        DATABASE_URL = "${DATABASE_URL}"
        ARBITRUM_DATABASE_URL = "${DATABASE_URL}"
        UNISWAP_DATABASE_URL = "${DATABASE_URL}"
        
        # Observability
        NEXT_OTEL_VERBOSE = "1"
        OTEL_EXPORTER_OTLP_ENDPOINT = "${OTEL_EXPORTER_OTLP_ENDPOINT}"
        OTEL_SERVICE_NAME = "web"
        
        # PostHog analytics
        NEXT_PUBLIC_POSTHOG_KEY = "${POSTHOG_KEY}"
        
        # Web Push notifications
        NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY = "${WEB_PUSH_PUBLIC_KEY}"
        WEB_PUSH_PRIVATE_KEY = "${WEB_PUSH_PRIVATE_KEY}"
        WEB_PUSH_EMAIL = "${WEB_PUSH_EMAIL}"
        
        # Email service
        RESEND_API_KEY = "${RESEND_API_KEY}"
      }
      
      template {
        data = <<EOF
# Always use main branch for production deployments
{{ $imageTag := keyOrDefault "web/image/main" "latest" }}
WEB_IMAGE=ghcr.io/proposals-app/proposalsapp/web:{{ $imageTag }}

# Application configuration from Consul KV
ROOT_DOMAIN={{ keyOrDefault "web/root_domain" "proposals.app" }}
SPECIAL_SUBDOMAINS={{ keyOrDefault "web/special_subdomains" "arbitrum,uniswap" }}

# Database connection - use local pgpool connection string from Consul KV
DATABASE_URL={{ keyOrDefault "pgpool/connection_string/local" "postgresql://proposalsapp:password@localhost:5432/proposalsapp" }}

# OpenTelemetry configuration from Consul KV
OTEL_EXPORTER_OTLP_ENDPOINT={{ keyOrDefault "web/otel_exporter_otlp_endpoint" "" }}

# Analytics and monitoring
POSTHOG_KEY={{ keyOrDefault "web/posthog_key" "" }}

# Web Push configuration
WEB_PUSH_PUBLIC_KEY={{ keyOrDefault "web/web_push_public_key" "" }}
WEB_PUSH_PRIVATE_KEY={{ keyOrDefault "web/web_push_private_key" "" }}
WEB_PUSH_EMAIL={{ keyOrDefault "web/web_push_email" "" }}

# Email service
RESEND_API_KEY={{ keyOrDefault "web/resend_api_key" "" }}

EOF
        destination = "secrets/env"
        env         = true
        change_mode = "restart"
        change_signal = "SIGTERM"
      }
      
      resources {
        cpu    = 1000  # 1 CPU core
        memory = 2048  # 2GB RAM
        
        # Reserve additional resources for peak loads
        memory_max = 3072  # Allow bursting to 3GB
      }
      
      service {
        name = "web"
        tags = [
          "frontend",
          "nextjs",
          "traefik.enable=true",
          "traefik.enable=true",
          "traefik.http.routers.web.rule=Host(`proposal.vote`) || HostRegexp(`^[a-z]+\\.proposal\\.vote$`)",
          "traefik.http.routers.web.entrypoints=web",
          "traefik.http.services.web.loadbalancer.server.port=3002",
          "traefik.http.services.web.loadbalancer.passhostheader=true"
        ]
        port = "http"
        
        check {
          type     = "http"
          path     = "/api/health"
          interval = "10s"
          timeout  = "5s"
          
          header {
            Host = ["proposal.vote"]
          }
        }
      }
    }
  }
}