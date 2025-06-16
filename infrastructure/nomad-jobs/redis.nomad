job "redis" {
  datacenters = ["dc1", "dc2", "dc3"]
  type = "service"
  
  group "redis" {
    count = 3
    
    constraint {
      distinct_hosts = true
    }
    
    spread {
      attribute = "${node.datacenter}"
      weight    = 100
    }
    
    network {
      port "redis" {
        static = 6379
      }
      port "sentinel" {
        static = 26379
      }
    }
    
    task "redis" {
      driver = "docker"
      
      config {
        image = "redis:7-alpine"
        ports = ["redis"]
        command = "redis-server"
        args = [
          "--requirepass", "${REDIS_PASSWORD}",
          "--maxmemory", "512mb",
          "--maxmemory-policy", "allkeys-lru",
          "--save", "900 1",
          "--save", "300 10",
          "--save", "60 10000"
        ]
      }
      
      template {
        data = <<EOF
REDIS_PASSWORD={{ with secret "kv/redis" }}{{ .Data.data.password }}{{ end }}
EOF
        destination = "secrets/env"
        env         = true
      }
      
      resources {
        cpu    = 200
        memory = 768
      }
      
      service {
        name = "redis"
        port = "redis"
        tags = ["cache", "${node.datacenter}"]
        
        check {
          type     = "script"
          command  = "redis-cli"
          args     = ["ping"]
          interval = "10s"
          timeout  = "2s"
        }
      }
    }
    
    task "sentinel" {
      driver = "docker"
      
      config {
        image = "redis:7-alpine"
        ports = ["sentinel"]
        command = "redis-sentinel"
        args = ["/local/sentinel.conf"]
      }
      
      template {
        data = <<EOF
port 26379
dir /tmp
sentinel monitor proposalsapp {{ range service "redis" }}{{ .Address }}{{ end }} 6379 2
sentinel auth-pass proposalsapp {{ with secret "kv/redis" }}{{ .Data.data.password }}{{ end }}
sentinel down-after-milliseconds proposalsapp 5000
sentinel parallel-syncs proposalsapp 1
sentinel failover-timeout proposalsapp 10000
sentinel announce-ip {{ env "NOMAD_IP_sentinel" }}
sentinel announce-port 26379
EOF
        destination = "local/sentinel.conf"
      }
      
      resources {
        cpu    = 100
        memory = 128
      }
      
      service {
        name = "redis-sentinel"
        port = "sentinel"
        tags = ["sentinel"]
        
        check {
          type     = "tcp"
          interval = "10s"
          timeout  = "2s"
        }
      }
    }
  }
}