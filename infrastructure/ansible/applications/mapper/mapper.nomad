job "mapper" {
  datacenters = ["dc2"]
  type = "service"

  update {
    max_parallel      = 1
    health_check      = "checks"
    min_healthy_time  = "30s"
    healthy_deadline  = "5m"
    progress_deadline = "10m"
    auto_revert       = true
    auto_promote      = false
    canary            = 0
    stagger           = "30s"
  }

  group "mapper" {
    count = 1  # Single instance service

    # Ensure it runs on apps-sib-03 (dc2) to match the GitHub runner CPU
    constraint {
      attribute = "${node.unique.name}"
      value     = "apps-sib-03"
    }

    migrate {
      max_parallel = 1
      health_check = "checks"
      min_healthy_time = "10s"
      healthy_deadline = "2m"
    }

    reschedule {
      delay          = "5s"      # Reduced from 30s for faster recovery
      delay_function = "constant" # Use constant delay for predictable recovery
      max_delay      = "30s"     # Reduced from 1h
      unlimited      = true
    }

    restart {
      attempts = 10      # Increased from 5 for more resilience
      interval = "10m"
      delay    = "10s"  # Reduced from 60s
      mode     = "delay"
    }

    ephemeral_disk {
      size    = 8000  # 8GB for model storage (5GB model + overhead)
      sticky  = true   # Keep models between restarts
      migrate = true
    }

    network {
      port "health" {
        static = 3002
        to = 3000
        host_network = "tailscale"
      }
    }

    task "mapper" {
      driver = "docker"

      config {
        # Image is hardcoded here, but will be overridden by job updates
        image = "ghcr.io/proposals-app/proposalsapp/mapper:latest"
        ports = ["health"]
        force_pull = true

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
        # Rust settings
        RUST_LOG = "mapper=debug"
        RUST_BACKTRACE = "1"

        # Set target directory for llm_client to find llama-server
        CARGO_TARGET_DIR = "/app/target"

        # Set Hugging Face cache to use the ephemeral disk so models persist between restarts
        HF_HOME = "/alloc/data/huggingface"
        HUGGING_FACE_HUB_CACHE = "/alloc/data/huggingface/hub"

        # These environment variables are kept for reference but won't be used
        # since llama-server is now built in the Dockerfile
        # CMAKE_ARGS = "-DGGML_NATIVE=OFF -DBUILD_SHARED_LIBS=OFF"
        # GGML_NO_NATIVE = "1"
        # LLAMA_NO_NATIVE = "1"
        # CFLAGS = "-march=x86-64-v2 -mtune=generic"
        # CXXFLAGS = "-march=x86-64-v2 -mtune=generic"
      }

      # Deployment metadata template for visibility
      # Does not trigger restarts - deployment is handled by automation
      template {
        destination = "local/deployment-info.txt"
        change_mode = "noop"
        data = <<EOF
{{ $deploymentJson := keyOrDefault "mapper/deployment/main" "{}" }}
{{ if $deploymentJson }}
{{ $deployment := $deploymentJson | parseJSON }}
Current deployment target:
  Image: {{ if $deployment.image }}{{ $deployment.image }}{{ else }}unknown{{ end }}
  Tag: {{ if $deployment.tag }}{{ $deployment.tag }}{{ else }}unknown{{ end }}
  SHA: {{ if $deployment.sha }}{{ $deployment.sha }}{{ else }}unknown{{ end }}
  Time: {{ if $deployment.timestamp }}{{ $deployment.timestamp }}{{ else }}unknown{{ end }}
  Author: {{ if $deployment.author }}{{ $deployment.author }}{{ else }}unknown{{ end }}
{{ else }}
No deployment information available
{{ end }}
EOF
      }

      # Environment configuration template
      # Does not trigger restarts to avoid loops
      template {
        data = <<EOF
# Deployment metadata from Consul
{{ $deploymentJson := keyOrDefault "mapper/deployment/main" "{}" }}
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

# Database connection - use Nomad service discovery to find pgpool
# This will resolve to the pgpool service running on the same node
{{ $pgpoolFound := false }}
{{ range service "pgpool" }}
{{ $pgpoolFound = true }}
# Get connection string and replace localhost with discovered address
{{ $connStr := keyOrDefault "pgpool/connection_string/local" "postgresql://proposalsapp:password@localhost:5432/proposalsapp" }}
DATABASE_URL={{ $connStr | regexReplaceAll "@localhost:" (printf "@%s:" .Address) }}
{{ end }}
{{ if not $pgpoolFound }}
# Fallback: Use connection string from Consul KV directly when pgpool service is not yet discovered
{{ $connStr := keyOrDefault "pgpool/connection_string/local" "" }}
{{ if $connStr }}
DATABASE_URL={{ $connStr }}
{{ else }}
# Emergency fallback - this will cause the service to fail and retry
DATABASE_URL=
{{ end }}
{{ end }}

# Redis connection - use Nomad service discovery to find haproxy-redis
# This will resolve to the haproxy-redis service running on the same node
{{ $redisFound := false }}
{{ range service "haproxy-redis" }}
{{ $redisFound = true }}
# Get connection string and replace localhost with discovered address
{{ $redisConnStr := keyOrDefault "redis/connection_string/haproxy" "redis://:password@localhost:6380" }}
REDIS_URL={{ $redisConnStr | regexReplaceAll "@localhost:" (printf "@%s:" .Address) }}
{{ end }}
{{ if not $redisFound }}
# Fallback: Use connection string from Consul KV directly when haproxy-redis service is not yet discovered
{{ $redisConnStr := keyOrDefault "redis/connection_string/haproxy" "" }}
{{ if $redisConnStr }}
REDIS_URL={{ $redisConnStr }}
{{ else }}
# Emergency fallback - this will cause the service to fail and retry
REDIS_URL=
{{ end }}
{{ end }}

# BetterStack monitoring
BETTERSTACK_KEY={{ keyOrDefault "mapper/betterstack_key" "" }}

# Hugging Face token for model downloads
HUGGING_FACE_TOKEN={{ keyOrDefault "mapper/hugging_face_token" "" }}

EOF
        destination = "secrets/env"
        env         = true
        change_mode = "restart"
        splay       = "30s"
      }

      resources {
        cpu    = 18000
        memory = 6144   # 6GB RAM

        # Reserve additional resources for peak loads
        memory_max = 16384  # Allow bursting to 16GB
      }

      service {
        name = "mapper"
        tags = [
          "backend",
          "rust",
          "data-processing"
        ]
        port = "health"
        address_mode = "host"

        check {
          type     = "http"
          path     = "/health"
          interval = "30s"
          timeout  = "10s"

          # Additional health check configuration
          check_restart {
            limit = 3          # Restart after 3 consecutive failures
            grace = "60s"     # Grace period before health checks start
            ignore_warnings = false
          }
        }
      }
    }
  }
}
