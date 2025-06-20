job "web" {
  datacenters = ["dc1", "dc2", "dc3"]
  type = "service"
  
  update {
    max_parallel      = 1
    health_check      = "checks"
    min_healthy_time  = "10s"
    healthy_deadline  = "2m"
    progress_deadline = "5m"
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
      healthy_deadline = "2m"
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
        to = 3002
      }
    }
    
    task "web" {
      driver = "docker"
      
      config {
        # Image is hardcoded here, but will be overridden by job updates
        image = "ghcr.io/proposals-app/proposalsapp/web:latest"
        ports = ["http"]
        force_pull = true
        
        # Allow container to access host services
        extra_hosts = [
          "host.docker.internal:host-gateway"
        ]
        
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
        
        # Observability
        NEXT_OTEL_VERBOSE = "1"
        OTEL_SERVICE_NAME = "web"
      }
      
      # This template watches for image changes and triggers restart
      # Only watches the image field to prevent restart loops
      template {
        destination = "local/deployment-trigger.txt"
        change_mode = "restart"
        data = <<EOF
{{ $deploymentJson := keyOrDefault "web/deployment/main" "{}" }}
{{ if $deploymentJson }}
{{ $deployment := $deploymentJson | parseJSON }}
{{ if $deployment.image }}{{ $deployment.image }}{{ else }}no-image{{ end }}
{{ else }}
no-deployment
{{ end }}
EOF
      }
      
      # Environment configuration template
      # Does not trigger restarts to avoid loops
      template {
        data = <<EOF
# Deployment metadata from Consul
{{ $deploymentJson := keyOrDefault "web/deployment/main" "{}" }}
{{ if $deploymentJson }}
{{ $deployment := $deploymentJson | parseJSON }}
DEPLOYMENT_IMAGE={{ if $deployment.image }}{{ $deployment.image }}{{ else }}unknown{{ end }}
DEPLOYMENT_TAG={{ if $deployment.tag }}{{ $deployment.tag }}{{ else }}unknown{{ end }}
DEPLOYMENT_SHA={{ if $deployment.sha }}{{ $deployment.sha }}{{ else }}unknown{{ end }}
DEPLOYMENT_TIME={{ if $deployment.timestamp }}{{ $deployment.timestamp }}{{ else }}unknown{{ end }}
DEPLOYMENT_AUTHOR={{ if $deployment.author }}{{ $deployment.author }}{{ else }}unknown{{ end }}
DEPLOYMENT_WORKFLOW_URL={{ if $deployment.workflow_run_url }}{{ $deployment.workflow_run_url }}{{ else }}unknown{{ end }}
{{ else }}
DEPLOYMENT_IMAGE=unknown
DEPLOYMENT_TAG=unknown
DEPLOYMENT_SHA=unknown
DEPLOYMENT_TIME=unknown
DEPLOYMENT_AUTHOR=unknown
DEPLOYMENT_WORKFLOW_URL=unknown
{{ end }}

# Application configuration from Consul KV
ROOT_DOMAIN={{ keyOrDefault "web/root_domain" "proposal.vote" }}
NEXT_PUBLIC_ROOT_DOMAIN={{ keyOrDefault "web/root_domain" "proposal.vote" }}
SPECIAL_SUBDOMAINS={{ keyOrDefault "web/special_subdomains" "arbitrum,uniswap" }}
NEXT_PUBLIC_SPECIAL_SUBDOMAINS={{ keyOrDefault "web/special_subdomains" "arbitrum,uniswap" }}

# Database connection - use local pgpool connection string from Consul KV
# Replace localhost with host.docker.internal for Docker container access
{{ $dbUrl := keyOrDefault "pgpool/connection_string/local" "postgresql://proposalsapp:password@localhost:5432/proposalsapp" }}
DATABASE_URL={{ $dbUrl | regexReplaceAll "@localhost:" "@host.docker.internal:" }}
ARBITRUM_DATABASE_URL={{ $dbUrl | regexReplaceAll "@localhost:" "@host.docker.internal:" }}
UNISWAP_DATABASE_URL={{ $dbUrl | regexReplaceAll "@localhost:" "@host.docker.internal:" }}

# OpenTelemetry configuration from Consul KV
OTEL_EXPORTER_OTLP_ENDPOINT={{ keyOrDefault "web/otel_exporter_otlp_endpoint" "" }}

# Analytics and monitoring
POSTHOG_KEY={{ keyOrDefault "web/posthog_key" "" }}
NEXT_PUBLIC_POSTHOG_KEY={{ keyOrDefault "web/posthog_key" "" }}

# Web Push configuration
WEB_PUSH_PUBLIC_KEY={{ keyOrDefault "web/web_push_public_key" "" }}
NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY={{ keyOrDefault "web/web_push_public_key" "" }}
WEB_PUSH_PRIVATE_KEY={{ keyOrDefault "web/web_push_private_key" "" }}
WEB_PUSH_EMAIL={{ keyOrDefault "web/web_push_email" "" }}

# Email service
RESEND_API_KEY={{ keyOrDefault "web/resend_api_key" "" }}

# Authentication
BETTER_AUTH_SECRET={{ keyOrDefault "web/better_auth_secret" "" }}

# Tally API
TALLY_API_KEY={{ keyOrDefault "web/tally_api_key" "" }}

# Redis cache - connects via local HAProxy
# Uses the connection string set by the Redis installation playbook
{{ $redisUrl := keyOrDefault "redis/connection_string/haproxy" "redis://:password@localhost:6380" }}
REDIS_URL={{ $redisUrl | regexReplaceAll "@localhost:" "@host.docker.internal:" }}

EOF
        destination = "secrets/env"
        env         = true
        change_mode = "noop"
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
          "traefik.http.routers.web.rule=Host(`proposal.vote`) || HostRegexp(`[a-z]+\\.proposal\\.vote`)",
          "traefik.http.routers.web.entrypoints=web",
          "traefik.http.services.web.loadbalancer.passhostheader=true",
          "traefik.http.routers.web.priority=1",
          "traefik.http.routers.web.middlewares=secure-headers@file,rate-limit@file,compress@file"
        ]
        port = "http"
        address_mode = "host"
        
        check {
          type     = "http"
          path     = "/api/health"
          interval = "5s"
          timeout  = "2s"
          
          header {
            Host = ["proposal.vote"]
          }
        }
      }
    }
  }
}