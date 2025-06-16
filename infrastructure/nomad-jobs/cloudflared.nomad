job "cloudflared" {
  datacenters = ["dc1", "dc2", "dc3"]
  type = "service"
  
  group "tunnel" {
    count = 3
    
    constraint {
      distinct_hosts = true
    }
    
    spread {
      attribute = "${node.datacenter}"
      weight    = 100
    }
    
    network {
      port "metrics" {
        to = 2000
      }
    }
    
    task "cloudflared" {
      driver = "docker"
      
      config {
        image = "cloudflare/cloudflared:latest"
        args = [
          "tunnel",
          "--no-autoupdate",
          "--metrics",
          "0.0.0.0:2000",
          "run"
        ]
      }
      
      env {
        TUNNEL_TOKEN = "${CLOUDFLARE_TUNNEL_TOKEN}"
      }
      
      template {
        data = <<EOF
CLOUDFLARE_TUNNEL_TOKEN={{ with secret "kv/cloudflare/tunnel" }}{{ .Data.data.token }}{{ end }}
EOF
        destination = "secrets/env"
        env         = true
      }
      
      resources {
        cpu    = 100
        memory = 128
      }
      
      service {
        name = "cloudflared"
        port = "metrics"
        tags = ["tunnel", "cloudflare"]
        
        check {
          type     = "http"
          path     = "/metrics"
          interval = "10s"
          timeout  = "2s"
        }
      }
    }
  }
}