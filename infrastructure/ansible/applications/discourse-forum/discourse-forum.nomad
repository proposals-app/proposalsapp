job "discourse-forum" {
  datacenters = ["dc1", "dc2", "dc3"]
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

  group "discourse" {
    count = 1

    # Prefer dc1 but can run anywhere
    affinity {
      attribute = "${node.datacenter}"
      value     = "dc1"
      weight    = 50
    }

    migrate {
      max_parallel = 1
      health_check = "checks"
      min_healthy_time = "30s"
      healthy_deadline = "5m"
    }

    reschedule {
      delay          = "30s"
      delay_function = "exponential"
      max_delay      = "1h"
      unlimited      = true
    }

    restart {
      attempts = 10
      interval = "30m"
      delay    = "60s"
      mode     = "delay"
    }

    # Large ephemeral disk for all services
    ephemeral_disk {
      size    = 20000  # 20GB
      sticky  = true
      migrate = true
    }

    network {
      mode = "host"
      
      port "discourse" {
        static = 3100
        host_network = "tailscale"
      }
      
      port "postgres" {
        static = 15432
        host_network = "tailscale"
      }
      
      port "redis" {
        static = 16379
        host_network = "tailscale"
      }
    }

    # PostgreSQL Database
    task "postgres" {
      driver = "docker"

      config {
        image = "postgres:17-alpine"
        network_mode = "host"
        ports = ["postgres"]
        
        volumes = [
          "/alloc/data/postgres:/var/lib/postgresql/data",
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
        data = <<EOF
POSTGRES_USER={{ keyOrDefault "discourse-forum/db_username" "discourse" }}
POSTGRES_PASSWORD={{ keyOrDefault "discourse-forum/db_password" "password" }}
POSTGRES_DB={{ keyOrDefault "discourse-forum/db_name" "discourse" }}
PGDATA=/var/lib/postgresql/data/pgdata
PGPORT=15432
EOF
        destination = "secrets/postgres.env"
        env         = true
        change_mode = "restart"
      }

      resources {
        cpu    = 500
        memory = 1024
        memory_max = 2048
      }

      service {
        name = "discourse-forum-postgres"
        port = "postgres"
      }
    }

    # Redis Cache
    task "redis" {
      driver = "docker"

      config {
        image = "redis:7-alpine"
        network_mode = "host"
        ports = ["redis"]
        
        volumes = [
          "/alloc/data/redis:/data",
          "local/redis.conf:/usr/local/etc/redis/redis.conf:ro"
        ]
        
        command = "redis-server"
        args = ["/usr/local/etc/redis/redis.conf"]

        logging {
          type = "json-file"
          config {
            max-size = "10m"
            max-file = "3"
          }
        }
      }

      template {
        data = <<EOF
# Redis configuration
bind 0.0.0.0
port 16379
dir /data
appendonly yes
appendfsync everysec
save 900 1
save 300 10
save 60 10000
maxmemory 512mb
maxmemory-policy allkeys-lru
{{ $password := keyOrDefault "discourse-forum/redis_password" "" }}
{{ if $password }}
requirepass {{ $password }}
{{ end }}
EOF
        destination = "local/redis.conf"
        change_mode = "restart"
      }

      resources {
        cpu    = 200
        memory = 512
        memory_max = 1024
      }

      service {
        name = "discourse-forum-redis"
        port = "redis"
      }
    }

    # Main Discourse Application
    task "discourse" {
      driver = "docker"

      config {
        image = "bitnami/discourse:latest"
        network_mode = "host"
        ports = ["discourse"]
        
        volumes = [
          "/alloc/data/discourse:/bitnami/discourse"
        ]


        logging {
          type = "json-file"
          config {
            max-size = "10m"
            max-file = "5"
          }
        }
      }

      template {
        data = <<EOF
# Application configuration
DISCOURSE_USERNAME={{ keyOrDefault "discourse-forum/admin_username" "admin" }}
DISCOURSE_PASSWORD={{ keyOrDefault "discourse-forum/admin_password" "password" }}
DISCOURSE_EMAIL={{ keyOrDefault "discourse-forum/admin_email" "admin@proposals.app" }}
DISCOURSE_HOST={{ keyOrDefault "discourse-forum/hostname" "forum.proposals.app" }}
DISCOURSE_PORT_NUMBER=3100

# Database configuration
DISCOURSE_DATABASE_HOST=localhost
DISCOURSE_DATABASE_PORT_NUMBER=15432
DISCOURSE_DATABASE_NAME={{ keyOrDefault "discourse-forum/db_name" "discourse" }}
DISCOURSE_DATABASE_USER={{ keyOrDefault "discourse-forum/db_username" "discourse" }}
DISCOURSE_DATABASE_PASSWORD={{ keyOrDefault "discourse-forum/db_password" "password" }}

# Redis configuration
DISCOURSE_REDIS_HOST=localhost
DISCOURSE_REDIS_PORT_NUMBER=16379
{{ $redisPassword := keyOrDefault "discourse-forum/redis_password" "" }}
{{ if $redisPassword }}
DISCOURSE_REDIS_PASSWORD={{ $redisPassword }}
{{ end }}


# Discourse SMTP configuration (Bitnami format)
DISCOURSE_SMTP_HOST={{ keyOrDefault "discourse-forum/smtp_host" "smtp.example.com" }}
DISCOURSE_SMTP_PORT={{ keyOrDefault "discourse-forum/smtp_port" "587" }}
DISCOURSE_SMTP_USER={{ keyOrDefault "discourse-forum/smtp_user" "" }}
DISCOURSE_SMTP_PASSWORD={{ keyOrDefault "discourse-forum/smtp_password" "" }}
DISCOURSE_SMTP_PROTOCOL={{ keyOrDefault "discourse-forum/smtp_protocol" "tls" }}

# Email settings
DISCOURSE_NOTIFICATION_EMAIL={{ keyOrDefault "discourse-forum/notification_email" "noreply@forum.proposals.app" }}
DISCOURSE_REPLY_BY_EMAIL_ADDRESS={{ keyOrDefault "discourse-forum/reply_email" "reply+%%{reply_key}@forum.proposals.app" }}

# Additional configuration
DISCOURSE_EXTERNAL_HTTP_PORT_NUMBER=80
DISCOURSE_EXTERNAL_HTTPS_PORT_NUMBER=443
DISCOURSE_ENABLE_HTTPS=yes
DISCOURSE_FORCE_HTTPS=true
ALLOW_EMPTY_PASSWORD=no

# Force TCP connections instead of socket
DISCOURSE_DB_SOCKET=""
DISCOURSE_DB_HOST=localhost
DISCOURSE_DB_PORT=15432
DISCOURSE_DB_NAME={{ keyOrDefault "discourse-forum/db_name" "discourse" }}
DISCOURSE_DB_USERNAME={{ keyOrDefault "discourse-forum/db_username" "discourse" }}
DISCOURSE_DB_PASSWORD={{ keyOrDefault "discourse-forum/db_password" "password" }}

# Proxy configuration
X_FORWARDED_PROTO=https
DISCOURSE_TRUSTED_PROXY_IP_ADDRESSES="127.0.0.1,::1,100.0.0.0/8"

# Secret key for sessions
DISCOURSE_SECRET_KEY_BASE={{ keyOrDefault "discourse-forum/secret_key_base" "" }}

# Monitoring (optional)
{{ $betterStackKey := keyOrDefault "discourse-forum/better_stack_key" "" }}
{{ if $betterStackKey }}
BETTERSTACK_SOURCE_TOKEN={{ $betterStackKey }}
{{ end }}
EOF
        destination = "secrets/env"
        env         = true
        change_mode = "restart"
      }

      resources {
        cpu    = 2000  # 2 CPU cores
        memory = 6144  # 6GB RAM
        memory_max = 8192  # Allow bursting to 8GB
      }

      service {
        name = "discourse-forum"
        tags = [
          "frontend",
          "forum"
        ]
        port = "discourse"
        address_mode = "host"

        # Health checks disabled to prevent killing during initialization
        # Discourse can take 5-10 minutes to fully start up
      }
    }

    # Sidekiq Background Jobs
    task "sidekiq" {
      driver = "docker"
      
      # Run as a long-running sidecar
      lifecycle {
        hook = "prestart"
        sidecar = true
      }

      config {
        image = "bitnami/discourse:latest"
        network_mode = "host"
        
        volumes = [
          "/alloc/data/discourse:/bitnami/discourse"
        ]

        # Run Sidekiq directly
        command = "/opt/bitnami/scripts/discourse-sidekiq/run.sh"

        logging {
          type = "json-file"
          config {
            max-size = "10m"
            max-file = "3"
          }
        }
      }

      # Use same environment as main discourse task
      template {
        data = <<EOF
# Application configuration
DISCOURSE_USERNAME={{ keyOrDefault "discourse-forum/admin_username" "admin" }}
DISCOURSE_PASSWORD={{ keyOrDefault "discourse-forum/admin_password" "password" }}
DISCOURSE_EMAIL={{ keyOrDefault "discourse-forum/admin_email" "admin@proposals.app" }}
DISCOURSE_HOST={{ keyOrDefault "discourse-forum/hostname" "forum.proposals.app" }}
DISCOURSE_PORT_NUMBER=3100

# Database configuration
DISCOURSE_DATABASE_HOST=localhost
DISCOURSE_DATABASE_PORT_NUMBER=15432
DISCOURSE_DATABASE_NAME={{ keyOrDefault "discourse-forum/db_name" "discourse" }}
DISCOURSE_DATABASE_USER={{ keyOrDefault "discourse-forum/db_username" "discourse" }}
DISCOURSE_DATABASE_PASSWORD={{ keyOrDefault "discourse-forum/db_password" "password" }}

# Redis configuration
DISCOURSE_REDIS_HOST=localhost
DISCOURSE_REDIS_PORT_NUMBER=16379
{{ $redisPassword := keyOrDefault "discourse-forum/redis_password" "" }}
{{ if $redisPassword }}
DISCOURSE_REDIS_PASSWORD={{ $redisPassword }}
{{ end }}

# PostgreSQL client configuration
POSTGRESQL_CLIENT_DATABASE_HOST=localhost
POSTGRESQL_CLIENT_DATABASE_PORT_NUMBER=15432
POSTGRESQL_CLIENT_POSTGRES_USER={{ keyOrDefault "discourse-forum/db_username" "discourse" }}

# Discourse SMTP configuration for sidekiq (Bitnami format)
DISCOURSE_SMTP_HOST={{ keyOrDefault "discourse-forum/smtp_host" "smtp.example.com" }}
DISCOURSE_SMTP_PORT={{ keyOrDefault "discourse-forum/smtp_port" "587" }}
DISCOURSE_SMTP_USER={{ keyOrDefault "discourse-forum/smtp_user" "" }}
DISCOURSE_SMTP_PASSWORD={{ keyOrDefault "discourse-forum/smtp_password" "" }}
DISCOURSE_SMTP_PROTOCOL={{ keyOrDefault "discourse-forum/smtp_protocol" "tls" }}
DISCOURSE_NOTIFICATION_EMAIL={{ keyOrDefault "discourse-forum/notification_email" "noreply@forum.proposals.app" }}

# Additional configuration for sidekiq
DISCOURSE_ENABLE_HTTPS=yes
DISCOURSE_FORCE_HTTPS=true
X_FORWARDED_PROTO=https
DISCOURSE_TRUSTED_PROXY_IP_ADDRESSES="127.0.0.1,::1,100.0.0.0/8"

# Skip installation for sidekiq
DISCOURSE_SKIP_INSTALL=yes
EOF
        destination = "secrets/env"
        env         = true
        change_mode = "restart"
      }

      resources {
        cpu    = 1000
        memory = 2048
        memory_max = 3072
      }

      service {
        name = "discourse-forum-sidekiq"
        tags = ["background", "sidekiq"]
        
        # No port for sidekiq, just a health check
        check {
          type     = "script"
          command  = "pgrep"
          args     = ["-f", "sidekiq"]
          interval = "30s"
          timeout  = "5s"
        }
      }
    }
  }
}