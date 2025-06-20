job "cloudflared" {
  datacenters = ["dc1", "dc2", "dc3"]
  type = "service"
  
  # High priority to ensure it runs
  priority = 90
  
  # Update configuration for automatic rescheduling
  update {
    max_parallel      = 1
    health_check      = "checks"
    min_healthy_time  = "30s"
    healthy_deadline  = "5m"
    progress_deadline = "10m"
    auto_revert       = true
    auto_promote      = false  # No canary deployment for single instance
  }
  
  group "tunnel" {
    count = 1  # Single instance that can migrate between datacenters
    
    # Prefer dc1 but allow running anywhere
    affinity {
      attribute = "${node.datacenter}"
      value     = "dc1"
      weight    = 50
    }
    
    # Ensure automatic rescheduling on node failure
    reschedule {
      delay          = "30s"
      delay_function = "exponential"
      max_delay      = "10m"
      unlimited      = true
    }
    
    # Allow migration between datacenters
    migrate {
      max_parallel = 1
      health_check = "checks"
      min_healthy_time = "10s"
      healthy_deadline = "5m"
    }
    
    restart {
      attempts = 10
      interval = "5m"
      delay    = "25s"
      mode     = "delay"
    }
    
    network {
      mode = "host"
      port "metrics" {
        static = 2000
      }
    }
    
    task "cloudflared" {
      driver = "docker"
      
      config {
        image = "cloudflare/cloudflared:latest"
        network_mode = "host"
        ports = ["metrics"]
        args = [
          "tunnel",
          "--no-autoupdate",
          "--metrics",
          "0.0.0.0:2000",
          "run"
        ]
        
        # Redirect stderr to stdout for proper log handling
        logging {
          type = "json-file"
          config {
            max-size = "10m"
            max-file = "3"
          }
        }
        
        # Merge stderr into stdout
        tty = true
      }
      
      env {
        # The tunnel token contains all necessary configuration
        TUNNEL_TOKEN = "${TUNNEL_TOKEN}"
      }
      
      template {
        data = <<EOF
# Cloudflare tunnel token from Consul KV
TUNNEL_TOKEN={{ key "cloudflared/tunnel_token" }}
EOF
        destination = "secrets/env"
        env         = true
        change_mode = "restart"
      }
      
      
      resources {
        cpu    = 100   # Minimal CPU
        memory = 128   # 128MB RAM
      }
      
      service {
        name = "cloudflared"
        tags = [
          "tunnel", 
          "cloudflare", 
          "zero-trust",
          "ingress.service=http://localhost:8080",
          "ingress.originRequest.noTLSVerify=true"
        ]
        port = "metrics"
        
        check {
          type     = "http"
          path     = "/metrics"
          interval = "30s"
          timeout  = "5s"
          
          check_restart {
            limit = 3
            grace = "90s"
            ignore_warnings = false
          }
        }
      }
    }
  }
}