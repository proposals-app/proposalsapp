job "erpc" {
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

  group "erpc" {
    count = 3  # One instance per datacenter for high availability

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
      delay          = "5s"
      delay_function = "constant"
      max_delay      = "30s"
      unlimited      = true
    }

    restart {
      attempts = 10
      interval = "10m"
      delay    = "10s"
      mode     = "delay"
    }

    ephemeral_disk {
      size    = 500
      sticky  = false
      migrate = true
    }

    network {
      port "rpc" {
        static = 8545
        to = 4000
        host_network = "tailscale"
      }
      port "metrics" {
        static = 4001
        to = 4001
        host_network = "tailscale"
      }
    }

    task "erpc" {
      driver = "docker"

      config {
        image = "ghcr.io/erpc/erpc:latest"
        ports = ["rpc", "metrics"]
        force_pull = true

        # Mount the configuration file
        volumes = [
          "local/erpc.yaml:/root/erpc.yaml:ro"
        ]

        # DNS configuration
        dns_servers = ["8.8.8.8", "8.8.4.4"]

        # Logging configuration
        logging {
          type = "json-file"
          config {
            max-size = "10m"
            max-file = "3"
          }
        }

        # eRPC will automatically use the config file at /root/erpc.yaml
      }

      env {
        # Enable debug logging
        LOG_LEVEL = "debug"
        
        # Performance tuning
        GOMAXPROCS = "4"
      }

      # eRPC configuration template with proper structure
      template {
        data = <<EOF
server:
  listenV4: true
  httpHostV4: "0.0.0.0"
  httpPort: 4000
  maxTimeout: 120s

metrics:
  enabled: true
  listenV4: true
  hostV4: "0.0.0.0"
  port: 4001

database:
  evmJsonRpcCache:
    connectors:
      - id: memory-cache
        driver: memory
        memory:
          maxItems: 100000
    policies:
      - network: "*"
        method: "*"
        finality: finalized
        connector: memory-cache
        ttl: 5s
      - network: "*"
        method: "eth_getLogs|trace_*"
        finality: finalized
        connector: memory-cache
        ttl: 60s

projects:
  - id: proposalsapp
    networks:
      - architecture: evm
        evm:
          chainId: 1
      - architecture: evm
        evm:
          chainId: 42161
      - architecture: evm
        evm:
          chainId: 10
      - architecture: evm
        evm:
          chainId: 137
      - architecture: evm
        evm:
          chainId: 43114
    
    rateLimitBudget: global
    
    upstreams:
      # Ethereum Hypersync - for logs and block methods
      - id: hypersync-ethereum
        type: evm
        endpoint: {{ keyOrDefault "erpc/hypersync/ethereum" "" }}
        rateLimitBudget: hypersync-budget
        evm:
          chainId: 1
        
        # Only allow specific methods that Hypersync excels at
        allowMethods:
          - "eth_getLogs"
          - "eth_blockNumber"
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_newFilter"
          - "eth_newBlockFilter"
          - "eth_newPendingTransactionFilter"
          - "eth_getFilterChanges"
          - "eth_getFilterLogs"
          - "eth_uninstallFilter"
        
        ignoreMethods:
          - "*"  # Ignore everything else
        
        jsonRpc:
          supportsBatch: true
          batchMaxSize: 100
          batchMaxWait: 50ms
        
        failsafe:
          timeout:
            duration: 30s
          retry:
            maxAttempts: 3
            delay: 200ms
            backoffMaxDelay: 2s
            backoffFactor: 2
            jitter: 100ms

      # Arbitrum Hypersync
      - id: hypersync-arbitrum
        type: evm
        endpoint: {{ keyOrDefault "erpc/hypersync/arbitrum" "" }}
        rateLimitBudget: hypersync-budget
        evm:
          chainId: 42161
        
        allowMethods:
          - "eth_getLogs"
          - "eth_blockNumber"
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_newFilter"
          - "eth_newBlockFilter"
          - "eth_newPendingTransactionFilter"
          - "eth_getFilterChanges"
          - "eth_getFilterLogs"
          - "eth_uninstallFilter"
        
        ignoreMethods:
          - "*"
        
        jsonRpc:
          supportsBatch: true
          batchMaxSize: 100
          batchMaxWait: 50ms

      # Optimism Hypersync
      - id: hypersync-optimism
        type: evm
        endpoint: {{ keyOrDefault "erpc/hypersync/optimism" "" }}
        rateLimitBudget: hypersync-budget
        evm:
          chainId: 10
        
        allowMethods:
          - "eth_getLogs"
          - "eth_blockNumber"
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_newFilter"
          - "eth_newBlockFilter"
          - "eth_newPendingTransactionFilter"
          - "eth_getFilterChanges"
          - "eth_getFilterLogs"
          - "eth_uninstallFilter"
        
        ignoreMethods:
          - "*"
        
        jsonRpc:
          supportsBatch: true
          batchMaxSize: 100
          batchMaxWait: 50ms

      # Polygon Hypersync
      - id: hypersync-polygon
        type: evm
        endpoint: {{ keyOrDefault "erpc/hypersync/polygon" "" }}
        rateLimitBudget: hypersync-budget
        evm:
          chainId: 137
        
        allowMethods:
          - "eth_getLogs"
          - "eth_blockNumber"
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_newFilter"
          - "eth_newBlockFilter"
          - "eth_newPendingTransactionFilter"
          - "eth_getFilterChanges"
          - "eth_getFilterLogs"
          - "eth_uninstallFilter"
        
        ignoreMethods:
          - "*"
        
        jsonRpc:
          supportsBatch: true
          batchMaxSize: 100
          batchMaxWait: 50ms

      # Avalanche Hypersync
      - id: hypersync-avalanche
        type: evm
        endpoint: {{ keyOrDefault "erpc/hypersync/avalanche" "" }}
        rateLimitBudget: hypersync-budget
        evm:
          chainId: 43114
        
        allowMethods:
          - "eth_getLogs"
          - "eth_blockNumber"
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_newFilter"
          - "eth_newBlockFilter"
          - "eth_newPendingTransactionFilter"
          - "eth_getFilterChanges"
          - "eth_getFilterLogs"
          - "eth_uninstallFilter"
        
        ignoreMethods:
          - "*"
        
        jsonRpc:
          supportsBatch: true
          batchMaxSize: 100
          batchMaxWait: 50ms

      # Ethereum Full node - for all other methods
      - id: full-ethereum
        type: evm
        endpoint: {{ keyOrDefault "erpc/full/ethereum" "" }}
        rateLimitBudget: full-budget
        evm:
          chainId: 1
        
        # Ignore methods handled by Hypersync
        ignoreMethods:
          - "eth_getLogs"
          - "eth_blockNumber"
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_newFilter"
          - "eth_newBlockFilter"
          - "eth_newPendingTransactionFilter"
          - "eth_getFilterChanges"
          - "eth_getFilterLogs"
          - "eth_uninstallFilter"
        
        # Allow all other standard methods
        allowMethods:
          - "eth_*"
          - "net_*"
          - "web3_*"
        
        jsonRpc:
          supportsBatch: true
          batchMaxSize: 100
          batchMaxWait: 50ms
        
        failsafe:
          timeout:
            duration: 15s
          retry:
            maxAttempts: 3
            delay: 100ms
            backoffMaxDelay: 1s
            backoffFactor: 2
            jitter: 50ms

      # Arbitrum Full node
      - id: full-arbitrum
        type: evm
        endpoint: {{ keyOrDefault "erpc/full/arbitrum" "" }}
        rateLimitBudget: full-budget
        evm:
          chainId: 42161
        
        ignoreMethods:
          - "eth_getLogs"
          - "eth_blockNumber"
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_newFilter"
          - "eth_newBlockFilter"
          - "eth_newPendingTransactionFilter"
          - "eth_getFilterChanges"
          - "eth_getFilterLogs"
          - "eth_uninstallFilter"
        
        allowMethods:
          - "eth_*"
          - "net_*"
          - "web3_*"
        
        jsonRpc:
          supportsBatch: true
          batchMaxSize: 100
          batchMaxWait: 50ms

      # Optimism Full node
      - id: full-optimism
        type: evm
        endpoint: {{ keyOrDefault "erpc/full/optimism" "" }}
        rateLimitBudget: full-budget
        evm:
          chainId: 10
        
        ignoreMethods:
          - "eth_getLogs"
          - "eth_blockNumber"
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_newFilter"
          - "eth_newBlockFilter"
          - "eth_newPendingTransactionFilter"
          - "eth_getFilterChanges"
          - "eth_getFilterLogs"
          - "eth_uninstallFilter"
        
        allowMethods:
          - "eth_*"
          - "net_*"
          - "web3_*"
        
        jsonRpc:
          supportsBatch: true
          batchMaxSize: 100
          batchMaxWait: 50ms

      # Polygon Full node
      - id: full-polygon
        type: evm
        endpoint: {{ keyOrDefault "erpc/full/polygon" "" }}
        rateLimitBudget: full-budget
        evm:
          chainId: 137
        
        ignoreMethods:
          - "eth_getLogs"
          - "eth_blockNumber"
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_newFilter"
          - "eth_newBlockFilter"
          - "eth_newPendingTransactionFilter"
          - "eth_getFilterChanges"
          - "eth_getFilterLogs"
          - "eth_uninstallFilter"
        
        allowMethods:
          - "eth_*"
          - "net_*"
          - "web3_*"
        
        jsonRpc:
          supportsBatch: true
          batchMaxSize: 100
          batchMaxWait: 50ms

      # Avalanche Full node
      - id: full-avalanche
        type: evm
        endpoint: {{ keyOrDefault "erpc/full/avalanche" "" }}
        rateLimitBudget: full-budget
        evm:
          chainId: 43114
        
        ignoreMethods:
          - "eth_getLogs"
          - "eth_blockNumber"
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_newFilter"
          - "eth_newBlockFilter"
          - "eth_newPendingTransactionFilter"
          - "eth_getFilterChanges"
          - "eth_getFilterLogs"
          - "eth_uninstallFilter"
        
        allowMethods:
          - "eth_*"
          - "net_*"
          - "web3_*"
        
        jsonRpc:
          supportsBatch: true
          batchMaxSize: 100
          batchMaxWait: 50ms

rateLimiters:
  budgets:
    - id: global
      rules:
        - method: "*"
          maxCount: 10000
          period: 1s
    
    - id: hypersync-budget
      rules:
        - method: "*"
          maxCount: 10000
          period: 1s
    
    - id: full-budget
      rules:
        - method: "*"
          maxCount: 5000
          period: 1s
EOF
        destination = "local/erpc.yaml"
        change_mode = "restart"
        splay       = "30s"
      }

      resources {
        cpu    = 1000  # 1 CPU core
        memory = 2048  # 2GB RAM
        
        # Allow bursting
        memory_max = 4096  # 4GB max
      }

      service {
        name = "erpc"
        tags = ["rpc", "proxy", "ethereum"]
        port = "rpc"
        address_mode = "host"

        check {
          type     = "tcp"
          port     = "rpc"
          interval = "10s"
          timeout  = "5s"
          
          check_restart {
            limit = 3
            grace = "60s"
            ignore_warnings = false
          }
        }
      }

      service {
        name = "erpc-metrics"
        tags = ["metrics", "prometheus"]
        port = "metrics"
        address_mode = "host"

        check {
          type     = "http"
          path     = "/metrics"
          interval = "30s"
          timeout  = "5s"
        }
      }
    }
  }
}