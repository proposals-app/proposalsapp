module.exports = {
  apps: [
    {
      name: "web-arbitrum",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "/app/apps/web-arbitrum",
      instances: 6,
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PROPOSALS_BIN: "web-arbitrum",
        NEXT_OTEL_VERBOSE: 1,
        PORT: 3000,
      },
    },
  ],
};
