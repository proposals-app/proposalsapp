job "redis" {
  datacenters = ["dc1", "dc2", "dc3"]
  type = "service"
  
  update {
    max_parallel      = 1
    health_check      = "checks"
    min_healthy_time  = "30s"
    healthy_deadline  = "5m"
    progress_deadline = "10m"
    auto_revert       = true
    auto_promote      = false  # Manual promotion for stateful services
    canary            = 0      # No canaries for stateful services
    stagger           = "60s"
  }
  
  group "redis" {
    count = 3  # One per datacenter
    
    # Ensure one instance per datacenter
    constraint {
      distinct_property = "${node.datacenter}"
      value = "3"
    }
    
    # Spread across datacenters
    spread {
      attribute = "${node.datacenter}"
      weight    = 100
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
      attempts = 3
      interval = "5m"
      delay    = "30s"
      mode     = "delay"
    }
    
    ephemeral_disk {
      size    = 1000
      sticky  = true   # Keep data on same node
      migrate = false  # Don't migrate data
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
        ports = ["redis", "sentinel"]
        network_mode = "host"
        
        # Mount persistent volume for Redis data
        volumes = [
          "/var/lib/redis:/data"
        ]
        
        # Use entrypoint to run registration before Redis starts
        entrypoint = ["/bin/sh", "-c"]
        
        # Redis arguments - run registration then start Redis
        args = [
          "/local/register-etcd.sh && /local/periodic-register.sh & exec redis-server /local/redis.conf"
        ]
        
        logging {
          type = "json-file"
          config {
            max-size = "10m"
            max-file = "3"
          }
        }
      }
      
      # Redis configuration template
      template {
        destination = "local/redis.conf"
        change_mode = "restart"
        data = <<EOF
# Basic configuration
bind 0.0.0.0
protected-mode no
port 6379
tcp-backlog 511
timeout 0
tcp-keepalive 300

# Persistence
dir /data
dbfilename dump.rdb
save 900 1
save 300 10
save 60 10000
stop-writes-on-bgsave-error yes
rdbcompression yes
rdbchecksum yes

# Replication
{{ $node_dc := env "node.datacenter" }}
{{ $redis_master := keyOrDefault "redis/master" "" }}
{{ if and $redis_master (ne $redis_master (env "NOMAD_ALLOC_ID")) }}
replicaof {{ $redis_master | regexReplaceAll "^([^:]+):.*" "$1" }} 6379
replica-read-only yes
replica-serve-stale-data yes
{{ end }}

# Memory management
maxmemory {{ keyOrDefault "redis/maxmemory" "2gb" }}
maxmemory-policy {{ keyOrDefault "redis/maxmemory_policy" "allkeys-lru" }}

# Logging
loglevel notice
logfile ""

# Slow log
slowlog-log-slower-than 10000
slowlog-max-len 128

# Client connections
maxclients 10000

# AOF persistence (disabled by default, RDB is primary)
appendonly no
appendfilename "appendonly.aof"
appendfsync everysec
no-appendfsync-on-rewrite no
auto-aof-rewrite-percentage 100
auto-aof-rewrite-min-size 64mb

# Lua scripting
lua-time-limit 5000

# Cluster (disabled - using Sentinel instead)
cluster-enabled no

# Additional security
requirepass {{ keyOrDefault "redis/password" "proposalsapp_redis_password" }}
masterauth {{ keyOrDefault "redis/password" "proposalsapp_redis_password" }}

# Performance tuning
hz 10
dynamic-hz yes

# Datacenter-aware configuration
# Prefer local reads by setting lower replica priority for remote DCs
{{ if eq $node_dc "dc1" }}
replica-priority 100
{{ else if eq $node_dc "dc2" }}
replica-priority 90
{{ else if eq $node_dc "dc3" }}
replica-priority 80
{{ end }}
EOF
      }
      
      # Health check script
      template {
        destination = "local/health-check.sh"
        perms = "755"
        data = <<EOF
#!/bin/sh
redis-cli -h localhost -p 6379 -a {{ keyOrDefault "redis/password" "proposalsapp_redis_password" }} ping
EOF
      }
      
      resources {
        cpu    = 500   # 0.5 CPU core
        memory = 2048  # 2GB RAM
        
        # Reserve additional resources for peak loads
        memory_max = 3072  # Allow bursting to 3GB
      }
      
      # Script to register this instance in etcd
      template {
        destination = "local/register-etcd.sh"
        perms = "755"
        data = <<EOF
#!/bin/sh
# Register this Redis instance in etcd for HAProxy/Confd

ETCD_ENDPOINTS="{{ keyOrDefault "etcd/endpoints" "http://localhost:2379" }}"
INSTANCE_NAME="redis-${NOMAD_ALLOC_ID}"
INSTANCE_HOST="${NOMAD_IP_redis}"
INSTANCE_PORT="${NOMAD_PORT_redis}"
DATACENTER="${node.datacenter}"

# Wait for Redis to be ready
sleep 5

# Determine role (master or replica)
ROLE=$(redis-cli -h localhost -p 6379 -a {{ keyOrDefault "redis/password" "proposalsapp_redis_password" }} INFO replication | grep "role:" | cut -d: -f2 | tr -d '\r')

# Create JSON data for this instance
JSON_DATA=$(cat <<EOJ
{
  "name": "$INSTANCE_NAME",
  "host": "$INSTANCE_HOST",
  "port": "$INSTANCE_PORT",
  "datacenter": "$DATACENTER",
  "role": "$ROLE",
  "alloc_id": "${NOMAD_ALLOC_ID}"
}
EOJ
)

# Register in etcd using curl (etcd v3 API)
for endpoint in $(echo $ETCD_ENDPOINTS | tr ',' ' '); do
  # Base64 encode the key and value for etcd v3 API
  KEY_B64=$(echo -n "/service/redis/instances/$INSTANCE_NAME" | base64)
  VALUE_B64=$(echo -n "$JSON_DATA" | base64)
  
  # Create request JSON
  REQUEST=$(cat <<EOJ
{
  "key": "$KEY_B64",
  "value": "$VALUE_B64"
}
EOJ
)
  
  if curl -s -X POST "$endpoint/v3/kv/put" \
    -H "Content-Type: application/json" \
    -d "$REQUEST" >/dev/null 2>&1; then
    echo "Successfully registered in etcd at $endpoint"
    
    # If this is the master, also update the master key
    if [ "$ROLE" = "master" ]; then
      MASTER_KEY_B64=$(echo -n "/service/redis/master" | base64)
      MASTER_VALUE_B64=$(echo -n "$INSTANCE_HOST:$INSTANCE_PORT" | base64)
      MASTER_REQUEST=$(cat <<EOJ
{
  "key": "$MASTER_KEY_B64",
  "value": "$MASTER_VALUE_B64"
}
EOJ
)
      curl -s -X POST "$endpoint/v3/kv/put" \
        -H "Content-Type: application/json" \
        -d "$MASTER_REQUEST" >/dev/null 2>&1
      echo "Updated master location in etcd"
    fi
    break
  fi
done
EOF
      }
      
      # Script to deregister from etcd on shutdown
      template {
        destination = "local/deregister-etcd.sh"
        perms = "755"
        data = <<EOF
#!/bin/sh
# Deregister this Redis instance from etcd

ETCD_ENDPOINTS="{{ keyOrDefault "etcd/endpoints" "http://localhost:2379" }}"
INSTANCE_NAME="redis-${NOMAD_ALLOC_ID}"

# Use curl to delete from etcd (v3 API)
for endpoint in $(echo $ETCD_ENDPOINTS | tr ',' ' '); do
  KEY_B64=$(echo -n "/service/redis/instances/$INSTANCE_NAME" | base64)
  
  REQUEST=$(cat <<EOJ
{
  "key": "$KEY_B64"
}
EOJ
)
  
  if curl -s -X POST "$endpoint/v3/kv/deleterange" \
    -H "Content-Type: application/json" \
    -d "$REQUEST" >/dev/null 2>&1; then
    echo "Successfully deregistered from etcd at $endpoint"
    break
  fi
done
EOF
      }
      
      
      # Periodic registration task
      template {
        destination = "local/periodic-register.sh"
        perms = "755"
        data = <<EOF
#!/bin/sh
# Periodically update registration in etcd
while true; do
  sleep 30
  /local/register-etcd.sh
done
EOF
      }
      
      service {
        name = "redis"
        tags = [
          "cache",
          "redis",
          "datacenter=${node.datacenter}",
          "alloc=${NOMAD_ALLOC_ID}"
        ]
        port = "redis"
        
        check {
          type     = "script"
          command  = "/local/health-check.sh"
          interval = "5s"
          timeout  = "2s"
        }
        
        # Additional metadata for service discovery
        meta {
          datacenter = "${node.datacenter}"
          alloc_id   = "${NOMAD_ALLOC_ID}"
        }
      }
      
    }
    
    # Redis Sentinel for automatic failover
    task "sentinel" {
      driver = "docker"
      
      config {
        image = "redis:7-alpine"
        ports = ["sentinel"]
        network_mode = "host"
        
        # Sentinel arguments
        args = [
          "redis-sentinel",
          "/local/sentinel.conf"
        ]
        
        logging {
          type = "json-file"
          config {
            max-size = "10m"
            max-file = "3"
          }
        }
      }
      
      # Sentinel configuration template
      template {
        destination = "local/sentinel.conf"
        change_mode = "restart"
        data = <<EOF
# Sentinel configuration
bind 0.0.0.0
port 26379
protected-mode no

# Monitor the master
sentinel monitor proposalsapp-redis {{ keyOrDefault "redis/master_host" "localhost" }} 6379 2
sentinel auth-pass proposalsapp-redis {{ keyOrDefault "redis/password" "proposalsapp_redis_password" }}

# Sentinel behavior
sentinel down-after-milliseconds proposalsapp-redis 5000
sentinel failover-timeout proposalsapp-redis 60000
sentinel parallel-syncs proposalsapp-redis 1

# Notification scripts (optional)
# sentinel notification-script proposalsapp-redis /local/notify.sh
# sentinel client-reconfig-script proposalsapp-redis /local/reconfig.sh

# Logging
logfile ""
loglevel notice

# Resolve hostnames
sentinel resolve-hostnames yes
sentinel announce-hostnames yes
EOF
      }
      
      # Script to update Consul KV with new master info after failover
      template {
        destination = "local/sentinel-script.sh"
        perms = "755"
        data = <<EOF
#!/bin/sh
# This script is called by Sentinel after a failover
# Arguments: <master-name> <role> <state> <from-ip> <from-port> <to-ip> <to-port>

if [ "$2" = "leader" ] && [ "$3" = "end" ]; then
  # Update Consul KV with new master
  consul kv put redis/master "$6:$7"
  consul kv put redis/master_host "$6"
  consul kv put redis/master_port "$7"
  
  # Also update etcd for HAProxy/Confd using curl
  ETCD_ENDPOINTS="{{ keyOrDefault "etcd/endpoints" "http://localhost:2379" }}"
  for endpoint in $(echo $ETCD_ENDPOINTS | tr ',' ' '); do
    KEY_B64=$(echo -n "/service/redis/master" | base64)
    VALUE_B64=$(echo -n "$6:$7" | base64)
    REQUEST=$(cat <<EOJ
{
  "key": "$KEY_B64",
  "value": "$VALUE_B64"
}
EOJ
)
    if curl -s -X POST "$endpoint/v3/kv/put" \
      -H "Content-Type: application/json" \
      -d "$REQUEST" >/dev/null 2>&1; then
      echo "Updated master in etcd"
      break
    fi
  done
fi
EOF
      }
      
      resources {
        cpu    = 100   # 0.1 CPU core
        memory = 128   # 128MB RAM
      }
      
      service {
        name = "redis-sentinel"
        tags = [
          "sentinel",
          "redis",
          "datacenter=${node.datacenter}"
        ]
        port = "sentinel"
        
        check {
          type     = "tcp"
          port     = "sentinel"
          interval = "5s"
          timeout  = "2s"
        }
      }
    }
  }
}