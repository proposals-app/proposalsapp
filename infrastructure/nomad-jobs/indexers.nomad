job "indexers" {
  datacenters = ["dc1", "dc2", "dc3"]
  type = "service"
  
  group "rust-indexer" {
    count = 1
    
    constraint {
      distinct_hosts = true
    }
    
    restart {
      attempts = 3
      interval = "5m"
      delay    = "30s"
      mode     = "delay"
    }
    
    task "rindexer" {
      driver = "docker"
      
      config {
        image = "${DOCKER_REGISTRY}/proposalsapp-rindexer:${DOCKER_TAG}"
      }
      
      env {
        RUST_LOG = "info"
        DATABASE_URL = "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}"
        
        # Chain endpoints
        ARBITRUM_RPC_URL = "${ARBITRUM_RPC_URL}"
        ETHEREUM_RPC_URL = "${ETHEREUM_RPC_URL}"
        
        # Indexer settings
        INDEXER_CHAIN = "arbitrum"
        INDEXER_START_BLOCK = "latest"
        INDEXER_BATCH_SIZE = "100"
      }
      
      template {
        data = <<EOF
{{ range service "postgres-primary" }}
DB_HOST={{ .Address }}
{{ end }}

DB_USER={{ with secret "kv/postgres/app" }}{{ .Data.data.username }}{{ end }}
DB_PASSWORD={{ with secret "kv/postgres/app" }}{{ .Data.data.password }}{{ end }}
DB_NAME={{ with secret "kv/postgres/app" }}{{ .Data.data.database }}{{ end }}

ARBITRUM_RPC_URL={{ with secret "kv/rpc/arbitrum" }}{{ .Data.data.url }}{{ end }}
ETHEREUM_RPC_URL={{ with secret "kv/rpc/ethereum" }}{{ .Data.data.url }}{{ end }}

DOCKER_REGISTRY={{ key "config/docker/registry" }}
DOCKER_TAG={{ key "config/docker/tag" }}
EOF
        destination = "secrets/env"
        env         = true
      }
      
      resources {
        cpu    = 1000
        memory = 2048
      }
      
      service {
        name = "rindexer"
        tags = ["indexer", "rust"]
        
        check {
          type     = "http"
          path     = "/health"
          interval = "30s"
          timeout  = "5s"
        }
      }
    }
  }
  
  group "discourse-indexer" {
    count = 1
    
    constraint {
      distinct_hosts = true
    }
    
    task "discourse" {
      driver = "docker"
      
      config {
        image = "${DOCKER_REGISTRY}/proposalsapp-discourse:${DOCKER_TAG}"
      }
      
      env {
        RUST_LOG = "info"
        DATABASE_URL = "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}"
        
        # Discourse settings
        DISCOURSE_URL = "https://forum.arbitrum.foundation"
        DISCOURSE_API_KEY = "${DISCOURSE_API_KEY}"
        DISCOURSE_USERNAME = "system"
        
        # Indexing interval (seconds)
        INDEX_INTERVAL = "60"
      }
      
      template {
        data = <<EOF
{{ range service "postgres-primary" }}
DB_HOST={{ .Address }}
{{ end }}

DB_USER={{ with secret "kv/postgres/app" }}{{ .Data.data.username }}{{ end }}
DB_PASSWORD={{ with secret "kv/postgres/app" }}{{ .Data.data.password }}{{ end }}
DB_NAME={{ with secret "kv/postgres/app" }}{{ .Data.data.database }}{{ end }}

DISCOURSE_API_KEY={{ with secret "kv/discourse" }}{{ .Data.data.api_key }}{{ end }}

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
        name = "discourse-indexer"
        tags = ["indexer", "discourse"]
        
        check {
          type     = "http"
          path     = "/health"
          interval = "30s"
          timeout  = "5s"
        }
      }
    }
  }
  
  group "mapper" {
    count = 1
    
    constraint {
      distinct_hosts = true
    }
    
    task "mapper" {
      driver = "docker"
      
      config {
        image = "${DOCKER_REGISTRY}/proposalsapp-mapper:${DOCKER_TAG}"
      }
      
      env {
        RUST_LOG = "info"
        DATABASE_URL = "postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:5432/${DB_NAME}"
        
        # Mapping interval (seconds)
        MAPPING_INTERVAL = "300"
      }
      
      template {
        data = <<EOF
{{ range service "postgres-primary" }}
DB_HOST={{ .Address }}
{{ end }}

DB_USER={{ with secret "kv/postgres/app" }}{{ .Data.data.username }}{{ end }}
DB_PASSWORD={{ with secret "kv/postgres/app" }}{{ .Data.data.password }}{{ end }}
DB_NAME={{ with secret "kv/postgres/app" }}{{ .Data.data.database }}{{ end }}

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
        name = "mapper"
        tags = ["mapper"]
        
        check {
          type     = "http"
          path     = "/health"
          interval = "30s"
          timeout  = "5s"
        }
      }
    }
  }
}