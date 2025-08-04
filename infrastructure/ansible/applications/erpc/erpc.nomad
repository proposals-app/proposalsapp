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
    count = 1  # Single instance to maximize cache hit rate and prevent OOM
              # With 8GB RAM and 500 item cache, one instance is more efficient
              # than multiple instances with fragmented caches

    # Prefer to run in dc1 but can run anywhere if needed
    affinity {
      attribute = "${node.datacenter}"
      value     = "dc1"
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
      size    = 10240  # 10GB for logs, temp files, and potential disk-based cache
      sticky  = true   # Keep data on same host for better performance
      migrate = true   # Migrate data if job moves
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
        GOMAXPROCS = "2"  # Match CPU allocation

        # Balanced garbage collection for 4GB allocation
        GOGC = "30"  # Trigger GC when heap grows by 30% (recommended by eRPC docs)
        GOMEMLIMIT = "3500MiB"  # Set Go memory limit below container limit (4GB - overhead)
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
          maxItems: 2000  # Reasonable for 4GB RAM with typical 256MB base usage
    policies:
      # Cache most methods for 5 seconds
      - network: "*"
        method: "*"
        finality: finalized
        connector: memory-cache
        ttl: 5s
      # Cache getLogs and trace methods for 60 seconds (they're more expensive)
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

        # HyperRPC only supports these specific methods
        allowMethods:
          # Chain data
          - "eth_chainId"
          - "eth_blockNumber"

          # Block data
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_getBlockReceipts"

          # Transaction data
          - "eth_getTransactionByHash"
          - "eth_getTransactionByBlockHashAndIndex"
          - "eth_getTransactionByBlockNumberAndIndex"
          - "eth_getTransactionReceipt"

          # Event logs
          - "eth_getLogs"

          # Traces (only on select chains)
          - "trace_block"

        ignoreMethods:
          - "*"  # Reject all methods not explicitly allowed above

        jsonRpc:
          supportsBatch: true
          batchMaxSize: 100
          batchMaxWait: 50ms
          headers:
            Authorization: "Bearer {{ keyOrDefault "erpc/hypersync/bearer_token" "" }}"

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

        # HyperRPC only supports these specific methods
        allowMethods:
          # Chain data
          - "eth_chainId"
          - "eth_blockNumber"

          # Block data
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_getBlockReceipts"

          # Transaction data
          - "eth_getTransactionByHash"
          - "eth_getTransactionByBlockHashAndIndex"
          - "eth_getTransactionByBlockNumberAndIndex"
          - "eth_getTransactionReceipt"

          # Event logs
          - "eth_getLogs"

          # Traces (only on select chains)
          - "trace_block"

        ignoreMethods:
          - "*"  # Reject all methods not explicitly allowed above

        jsonRpc:
          supportsBatch: true
          batchMaxSize: 100
          batchMaxWait: 50ms
          headers:
            Authorization: "Bearer {{ keyOrDefault "erpc/hypersync/bearer_token" "" }}"

      # Optimism Hypersync
      - id: hypersync-optimism
        type: evm
        endpoint: {{ keyOrDefault "erpc/hypersync/optimism" "" }}
        rateLimitBudget: hypersync-budget
        evm:
          chainId: 10

        # HyperRPC only supports these specific methods
        allowMethods:
          # Chain data
          - "eth_chainId"
          - "eth_blockNumber"

          # Block data
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_getBlockReceipts"

          # Transaction data
          - "eth_getTransactionByHash"
          - "eth_getTransactionByBlockHashAndIndex"
          - "eth_getTransactionByBlockNumberAndIndex"
          - "eth_getTransactionReceipt"

          # Event logs
          - "eth_getLogs"

          # Traces (only on select chains)
          - "trace_block"

        ignoreMethods:
          - "*"  # Reject all methods not explicitly allowed above

        jsonRpc:
          supportsBatch: true
          batchMaxSize: 100
          batchMaxWait: 50ms
          headers:
            Authorization: "Bearer {{ keyOrDefault "erpc/hypersync/bearer_token" "" }}"

      # Polygon Hypersync
      - id: hypersync-polygon
        type: evm
        endpoint: {{ keyOrDefault "erpc/hypersync/polygon" "" }}
        rateLimitBudget: hypersync-budget
        evm:
          chainId: 137

        # HyperRPC only supports these specific methods
        allowMethods:
          # Chain data
          - "eth_chainId"
          - "eth_blockNumber"

          # Block data
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_getBlockReceipts"

          # Transaction data
          - "eth_getTransactionByHash"
          - "eth_getTransactionByBlockHashAndIndex"
          - "eth_getTransactionByBlockNumberAndIndex"
          - "eth_getTransactionReceipt"

          # Event logs
          - "eth_getLogs"

          # Traces (only on select chains)
          - "trace_block"

        ignoreMethods:
          - "*"  # Reject all methods not explicitly allowed above

        jsonRpc:
          supportsBatch: true
          batchMaxSize: 100
          batchMaxWait: 50ms
          headers:
            Authorization: "Bearer {{ keyOrDefault "erpc/hypersync/bearer_token" "" }}"

      # Avalanche Hypersync
      - id: hypersync-avalanche
        type: evm
        endpoint: {{ keyOrDefault "erpc/hypersync/avalanche" "" }}
        rateLimitBudget: hypersync-budget
        evm:
          chainId: 43114

        # HyperRPC only supports these specific methods
        allowMethods:
          # Chain data
          - "eth_chainId"
          - "eth_blockNumber"

          # Block data
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_getBlockReceipts"

          # Transaction data
          - "eth_getTransactionByHash"
          - "eth_getTransactionByBlockHashAndIndex"
          - "eth_getTransactionByBlockNumberAndIndex"
          - "eth_getTransactionReceipt"

          # Event logs
          - "eth_getLogs"

          # Traces (only on select chains)
          - "trace_block"

        ignoreMethods:
          - "*"  # Reject all methods not explicitly allowed above

        jsonRpc:
          supportsBatch: true
          batchMaxSize: 100
          batchMaxWait: 50ms
          headers:
            Authorization: "Bearer {{ keyOrDefault "erpc/hypersync/bearer_token" "" }}"

      # Ethereum Full node - for all other methods
      - id: full-ethereum
        type: evm
        endpoint: {{ keyOrDefault "erpc/full/ethereum" "" }}
        rateLimitBudget: full-budget
        evm:
          chainId: 1

        # Full nodes handle all methods EXCEPT those handled by HyperRPC
        # Explicitly list all methods to ensure exclusive routing
        allowMethods:
          # State queries
          - "eth_getBalance"
          - "eth_getCode"
          - "eth_getStorageAt"
          - "eth_getProof"
          - "eth_getStateRoot"

          # Smart contract execution
          - "eth_call"

          # Transaction operations
          - "eth_sendTransaction"
          - "eth_sendRawTransaction"
          - "eth_getTransactionCount"
          - "eth_sign"
          - "eth_signTransaction"
          - "eth_signTypedData"
          - "eth_signTypedData_v3"
          - "eth_signTypedData_v4"

          # Gas estimation
          - "eth_estimateGas"
          - "eth_gasPrice"
          - "eth_maxPriorityFeePerGas"
          - "eth_feeHistory"
          - "eth_createAccessList"

          # Account management
          - "eth_accounts"
          - "eth_coinbase"

          # Mining/Validator operations
          - "eth_mining"
          - "eth_hashrate"
          - "eth_getWork"
          - "eth_submitWork"
          - "eth_submitHashrate"

          # Uncle/Ommer blocks
          - "eth_getUncleByBlockHashAndIndex"
          - "eth_getUncleByBlockNumberAndIndex"
          - "eth_getUncleCountByBlockHash"
          - "eth_getUncleCountByBlockNumber"

          # Filters (except getLogs which goes to hypersync)
          - "eth_newFilter"
          - "eth_newBlockFilter"
          - "eth_newPendingTransactionFilter"
          - "eth_getFilterChanges"
          - "eth_getFilterLogs"
          - "eth_uninstallFilter"

          # Sync and protocol info
          - "eth_syncing"
          - "eth_protocolVersion"

          # Pending state
          - "eth_pendingTransactions"

          # Network methods
          - "net_version"
          - "net_peerCount"
          - "net_listening"

          # Web3 methods
          - "web3_clientVersion"
          - "web3_sha3"

          # Debug methods
          - "debug_traceTransaction"
          - "debug_traceCall"
          - "debug_traceBlockByNumber"
          - "debug_traceBlockByHash"
          - "debug_getBadBlocks"
          - "debug_storageRangeAt"
          - "debug_getBlockRlp"
          - "debug_printBlock"
          - "debug_chaindbProperty"
          - "debug_chaindbCompact"
          - "debug_verbosity"
          - "debug_vmodule"
          - "debug_backtraceAt"
          - "debug_stacks"
          - "debug_memStats"
          - "debug_gcStats"
          - "debug_cpuProfile"
          - "debug_startCPUProfile"
          - "debug_stopCPUProfile"
          - "debug_goTrace"
          - "debug_startGoTrace"
          - "debug_stopGoTrace"
          - "debug_blockProfile"
          - "debug_setBlockProfileRate"
          - "debug_writeBlockProfile"
          - "debug_mutexProfile"
          - "debug_setMutexProfileFraction"
          - "debug_writeMutexProfile"
          - "debug_writeMemProfile"
          - "debug_freeOSMemory"
          - "debug_setGCPercent"

          # Trace methods (except trace_block which goes to hypersync)
          - "trace_call"
          - "trace_callMany"
          - "trace_rawTransaction"
          - "trace_replayTransaction"
          - "trace_replayBlockTransactions"
          - "trace_transaction"
          - "trace_get"
          - "trace_filter"

        # Explicitly ignore all methods handled by HyperSync
        ignoreMethods:
          - "eth_chainId"
          - "eth_blockNumber"
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_getBlockReceipts"
          - "eth_getTransactionByHash"
          - "eth_getTransactionByBlockHashAndIndex"
          - "eth_getTransactionByBlockNumberAndIndex"
          - "eth_getTransactionReceipt"
          - "eth_getLogs"
          - "trace_block"

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

        # Full nodes handle all methods EXCEPT those handled by HyperRPC
        # Explicitly list all methods to ensure exclusive routing
        allowMethods:
          # State queries
          - "eth_getBalance"
          - "eth_getCode"
          - "eth_getStorageAt"
          - "eth_getProof"
          - "eth_getStateRoot"

          # Smart contract execution
          - "eth_call"

          # Transaction operations
          - "eth_sendTransaction"
          - "eth_sendRawTransaction"
          - "eth_getTransactionCount"
          - "eth_sign"
          - "eth_signTransaction"
          - "eth_signTypedData"
          - "eth_signTypedData_v3"
          - "eth_signTypedData_v4"

          # Gas estimation
          - "eth_estimateGas"
          - "eth_gasPrice"
          - "eth_maxPriorityFeePerGas"
          - "eth_feeHistory"
          - "eth_createAccessList"

          # Account management
          - "eth_accounts"
          - "eth_coinbase"

          # Mining/Validator operations
          - "eth_mining"
          - "eth_hashrate"
          - "eth_getWork"
          - "eth_submitWork"
          - "eth_submitHashrate"

          # Uncle/Ommer blocks
          - "eth_getUncleByBlockHashAndIndex"
          - "eth_getUncleByBlockNumberAndIndex"
          - "eth_getUncleCountByBlockHash"
          - "eth_getUncleCountByBlockNumber"

          # Filters (except getLogs which goes to hypersync)
          - "eth_newFilter"
          - "eth_newBlockFilter"
          - "eth_newPendingTransactionFilter"
          - "eth_getFilterChanges"
          - "eth_getFilterLogs"
          - "eth_uninstallFilter"

          # Sync and protocol info
          - "eth_syncing"
          - "eth_protocolVersion"

          # Pending state
          - "eth_pendingTransactions"

          # Network methods
          - "net_version"
          - "net_peerCount"
          - "net_listening"

          # Web3 methods
          - "web3_clientVersion"
          - "web3_sha3"

          # Debug methods
          - "debug_traceTransaction"
          - "debug_traceCall"
          - "debug_traceBlockByNumber"
          - "debug_traceBlockByHash"
          - "debug_getBadBlocks"
          - "debug_storageRangeAt"
          - "debug_getBlockRlp"
          - "debug_printBlock"
          - "debug_chaindbProperty"
          - "debug_chaindbCompact"
          - "debug_verbosity"
          - "debug_vmodule"
          - "debug_backtraceAt"
          - "debug_stacks"
          - "debug_memStats"
          - "debug_gcStats"
          - "debug_cpuProfile"
          - "debug_startCPUProfile"
          - "debug_stopCPUProfile"
          - "debug_goTrace"
          - "debug_startGoTrace"
          - "debug_stopGoTrace"
          - "debug_blockProfile"
          - "debug_setBlockProfileRate"
          - "debug_writeBlockProfile"
          - "debug_mutexProfile"
          - "debug_setMutexProfileFraction"
          - "debug_writeMutexProfile"
          - "debug_writeMemProfile"
          - "debug_freeOSMemory"
          - "debug_setGCPercent"

          # Trace methods (except trace_block which goes to hypersync)
          - "trace_call"
          - "trace_callMany"
          - "trace_rawTransaction"
          - "trace_replayTransaction"
          - "trace_replayBlockTransactions"
          - "trace_transaction"
          - "trace_get"
          - "trace_filter"

        # Explicitly ignore all methods handled by HyperSync
        ignoreMethods:
          - "eth_chainId"
          - "eth_blockNumber"
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_getBlockReceipts"
          - "eth_getTransactionByHash"
          - "eth_getTransactionByBlockHashAndIndex"
          - "eth_getTransactionByBlockNumberAndIndex"
          - "eth_getTransactionReceipt"
          - "eth_getLogs"
          - "trace_block"

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

        # Full nodes handle all methods EXCEPT those handled by HyperRPC
        # Explicitly list all methods to ensure exclusive routing
        allowMethods:
          # State queries
          - "eth_getBalance"
          - "eth_getCode"
          - "eth_getStorageAt"
          - "eth_getProof"
          - "eth_getStateRoot"

          # Smart contract execution
          - "eth_call"

          # Transaction operations
          - "eth_sendTransaction"
          - "eth_sendRawTransaction"
          - "eth_getTransactionCount"
          - "eth_sign"
          - "eth_signTransaction"
          - "eth_signTypedData"
          - "eth_signTypedData_v3"
          - "eth_signTypedData_v4"

          # Gas estimation
          - "eth_estimateGas"
          - "eth_gasPrice"
          - "eth_maxPriorityFeePerGas"
          - "eth_feeHistory"
          - "eth_createAccessList"

          # Account management
          - "eth_accounts"
          - "eth_coinbase"

          # Mining/Validator operations
          - "eth_mining"
          - "eth_hashrate"
          - "eth_getWork"
          - "eth_submitWork"
          - "eth_submitHashrate"

          # Uncle/Ommer blocks
          - "eth_getUncleByBlockHashAndIndex"
          - "eth_getUncleByBlockNumberAndIndex"
          - "eth_getUncleCountByBlockHash"
          - "eth_getUncleCountByBlockNumber"

          # Filters (except getLogs which goes to hypersync)
          - "eth_newFilter"
          - "eth_newBlockFilter"
          - "eth_newPendingTransactionFilter"
          - "eth_getFilterChanges"
          - "eth_getFilterLogs"
          - "eth_uninstallFilter"

          # Sync and protocol info
          - "eth_syncing"
          - "eth_protocolVersion"

          # Pending state
          - "eth_pendingTransactions"

          # Network methods
          - "net_version"
          - "net_peerCount"
          - "net_listening"

          # Web3 methods
          - "web3_clientVersion"
          - "web3_sha3"

          # Debug methods
          - "debug_traceTransaction"
          - "debug_traceCall"
          - "debug_traceBlockByNumber"
          - "debug_traceBlockByHash"
          - "debug_getBadBlocks"
          - "debug_storageRangeAt"
          - "debug_getBlockRlp"
          - "debug_printBlock"
          - "debug_chaindbProperty"
          - "debug_chaindbCompact"
          - "debug_verbosity"
          - "debug_vmodule"
          - "debug_backtraceAt"
          - "debug_stacks"
          - "debug_memStats"
          - "debug_gcStats"
          - "debug_cpuProfile"
          - "debug_startCPUProfile"
          - "debug_stopCPUProfile"
          - "debug_goTrace"
          - "debug_startGoTrace"
          - "debug_stopGoTrace"
          - "debug_blockProfile"
          - "debug_setBlockProfileRate"
          - "debug_writeBlockProfile"
          - "debug_mutexProfile"
          - "debug_setMutexProfileFraction"
          - "debug_writeMutexProfile"
          - "debug_writeMemProfile"
          - "debug_freeOSMemory"
          - "debug_setGCPercent"

          # Trace methods (except trace_block which goes to hypersync)
          - "trace_call"
          - "trace_callMany"
          - "trace_rawTransaction"
          - "trace_replayTransaction"
          - "trace_replayBlockTransactions"
          - "trace_transaction"
          - "trace_get"
          - "trace_filter"

        # Explicitly ignore all methods handled by HyperSync
        ignoreMethods:
          - "eth_chainId"
          - "eth_blockNumber"
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_getBlockReceipts"
          - "eth_getTransactionByHash"
          - "eth_getTransactionByBlockHashAndIndex"
          - "eth_getTransactionByBlockNumberAndIndex"
          - "eth_getTransactionReceipt"
          - "eth_getLogs"
          - "trace_block"

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

        # Full nodes handle all methods EXCEPT those handled by HyperRPC
        # Explicitly list all methods to ensure exclusive routing
        allowMethods:
          # State queries
          - "eth_getBalance"
          - "eth_getCode"
          - "eth_getStorageAt"
          - "eth_getProof"
          - "eth_getStateRoot"

          # Smart contract execution
          - "eth_call"

          # Transaction operations
          - "eth_sendTransaction"
          - "eth_sendRawTransaction"
          - "eth_getTransactionCount"
          - "eth_sign"
          - "eth_signTransaction"
          - "eth_signTypedData"
          - "eth_signTypedData_v3"
          - "eth_signTypedData_v4"

          # Gas estimation
          - "eth_estimateGas"
          - "eth_gasPrice"
          - "eth_maxPriorityFeePerGas"
          - "eth_feeHistory"
          - "eth_createAccessList"

          # Account management
          - "eth_accounts"
          - "eth_coinbase"

          # Mining/Validator operations
          - "eth_mining"
          - "eth_hashrate"
          - "eth_getWork"
          - "eth_submitWork"
          - "eth_submitHashrate"

          # Uncle/Ommer blocks
          - "eth_getUncleByBlockHashAndIndex"
          - "eth_getUncleByBlockNumberAndIndex"
          - "eth_getUncleCountByBlockHash"
          - "eth_getUncleCountByBlockNumber"

          # Filters (except getLogs which goes to hypersync)
          - "eth_newFilter"
          - "eth_newBlockFilter"
          - "eth_newPendingTransactionFilter"
          - "eth_getFilterChanges"
          - "eth_getFilterLogs"
          - "eth_uninstallFilter"

          # Sync and protocol info
          - "eth_syncing"
          - "eth_protocolVersion"

          # Pending state
          - "eth_pendingTransactions"

          # Network methods
          - "net_version"
          - "net_peerCount"
          - "net_listening"

          # Web3 methods
          - "web3_clientVersion"
          - "web3_sha3"

          # Debug methods
          - "debug_traceTransaction"
          - "debug_traceCall"
          - "debug_traceBlockByNumber"
          - "debug_traceBlockByHash"
          - "debug_getBadBlocks"
          - "debug_storageRangeAt"
          - "debug_getBlockRlp"
          - "debug_printBlock"
          - "debug_chaindbProperty"
          - "debug_chaindbCompact"
          - "debug_verbosity"
          - "debug_vmodule"
          - "debug_backtraceAt"
          - "debug_stacks"
          - "debug_memStats"
          - "debug_gcStats"
          - "debug_cpuProfile"
          - "debug_startCPUProfile"
          - "debug_stopCPUProfile"
          - "debug_goTrace"
          - "debug_startGoTrace"
          - "debug_stopGoTrace"
          - "debug_blockProfile"
          - "debug_setBlockProfileRate"
          - "debug_writeBlockProfile"
          - "debug_mutexProfile"
          - "debug_setMutexProfileFraction"
          - "debug_writeMutexProfile"
          - "debug_writeMemProfile"
          - "debug_freeOSMemory"
          - "debug_setGCPercent"

          # Trace methods (except trace_block which goes to hypersync)
          - "trace_call"
          - "trace_callMany"
          - "trace_rawTransaction"
          - "trace_replayTransaction"
          - "trace_replayBlockTransactions"
          - "trace_transaction"
          - "trace_get"
          - "trace_filter"

        # Explicitly ignore all methods handled by HyperSync
        ignoreMethods:
          - "eth_chainId"
          - "eth_blockNumber"
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_getBlockReceipts"
          - "eth_getTransactionByHash"
          - "eth_getTransactionByBlockHashAndIndex"
          - "eth_getTransactionByBlockNumberAndIndex"
          - "eth_getTransactionReceipt"
          - "eth_getLogs"
          - "trace_block"

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

        # Full nodes handle all methods EXCEPT those handled by HyperRPC
        # Explicitly list all methods to ensure exclusive routing
        allowMethods:
          # State queries
          - "eth_getBalance"
          - "eth_getCode"
          - "eth_getStorageAt"
          - "eth_getProof"
          - "eth_getStateRoot"

          # Smart contract execution
          - "eth_call"

          # Transaction operations
          - "eth_sendTransaction"
          - "eth_sendRawTransaction"
          - "eth_getTransactionCount"
          - "eth_sign"
          - "eth_signTransaction"
          - "eth_signTypedData"
          - "eth_signTypedData_v3"
          - "eth_signTypedData_v4"

          # Gas estimation
          - "eth_estimateGas"
          - "eth_gasPrice"
          - "eth_maxPriorityFeePerGas"
          - "eth_feeHistory"
          - "eth_createAccessList"

          # Account management
          - "eth_accounts"
          - "eth_coinbase"

          # Mining/Validator operations
          - "eth_mining"
          - "eth_hashrate"
          - "eth_getWork"
          - "eth_submitWork"
          - "eth_submitHashrate"

          # Uncle/Ommer blocks
          - "eth_getUncleByBlockHashAndIndex"
          - "eth_getUncleByBlockNumberAndIndex"
          - "eth_getUncleCountByBlockHash"
          - "eth_getUncleCountByBlockNumber"

          # Filters (except getLogs which goes to hypersync)
          - "eth_newFilter"
          - "eth_newBlockFilter"
          - "eth_newPendingTransactionFilter"
          - "eth_getFilterChanges"
          - "eth_getFilterLogs"
          - "eth_uninstallFilter"

          # Sync and protocol info
          - "eth_syncing"
          - "eth_protocolVersion"

          # Pending state
          - "eth_pendingTransactions"

          # Network methods
          - "net_version"
          - "net_peerCount"
          - "net_listening"

          # Web3 methods
          - "web3_clientVersion"
          - "web3_sha3"

          # Debug methods
          - "debug_traceTransaction"
          - "debug_traceCall"
          - "debug_traceBlockByNumber"
          - "debug_traceBlockByHash"
          - "debug_getBadBlocks"
          - "debug_storageRangeAt"
          - "debug_getBlockRlp"
          - "debug_printBlock"
          - "debug_chaindbProperty"
          - "debug_chaindbCompact"
          - "debug_verbosity"
          - "debug_vmodule"
          - "debug_backtraceAt"
          - "debug_stacks"
          - "debug_memStats"
          - "debug_gcStats"
          - "debug_cpuProfile"
          - "debug_startCPUProfile"
          - "debug_stopCPUProfile"
          - "debug_goTrace"
          - "debug_startGoTrace"
          - "debug_stopGoTrace"
          - "debug_blockProfile"
          - "debug_setBlockProfileRate"
          - "debug_writeBlockProfile"
          - "debug_mutexProfile"
          - "debug_setMutexProfileFraction"
          - "debug_writeMutexProfile"
          - "debug_writeMemProfile"
          - "debug_freeOSMemory"
          - "debug_setGCPercent"

          # Trace methods (except trace_block which goes to hypersync)
          - "trace_call"
          - "trace_callMany"
          - "trace_rawTransaction"
          - "trace_replayTransaction"
          - "trace_replayBlockTransactions"
          - "trace_transaction"
          - "trace_get"
          - "trace_filter"

        # Explicitly ignore all methods handled by HyperSync
        ignoreMethods:
          - "eth_chainId"
          - "eth_blockNumber"
          - "eth_getBlockByNumber"
          - "eth_getBlockByHash"
          - "eth_getBlockReceipts"
          - "eth_getTransactionByHash"
          - "eth_getTransactionByBlockHashAndIndex"
          - "eth_getTransactionByBlockNumberAndIndex"
          - "eth_getTransactionReceipt"
          - "eth_getLogs"
          - "trace_block"

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
        cpu    = 1000  # 1 CPU core (recommended for typical use)
        memory = 4096  # 4GB RAM (generous for indexing workloads)

        # Allow bursting for large responses (debug_traceTransaction can be 50MB+)
        memory_max = 8192  # 8GB max for burst traffic
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
