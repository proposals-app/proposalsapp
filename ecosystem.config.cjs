module.exports = {
  apps: [
    {
      name: "web-arbitrum",
      script: "yarn",
      args: "start-web-arbitrum",
      instances: "max", // Use all available CPU cores
      exec_mode: "cluster", // Run in cluster mode
      autorestart: true, // Automatically restart the app if it crashes
      watch: false, // Disable file watching
      max_memory_restart: "1G", // Restart the app if it exceeds 1GB of memory
      env: {
        NODE_ENV: "production",
        PROPOSALS_BIN: "web-arbitrum",
        NEXT_OTEL_VERBOSE: 1,
      },
    },
  ],
};
