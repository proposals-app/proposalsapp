module.exports = {
  apps: [
    {
      name: "web-arbitrum",
      script: "node_modules/next/dist/bin/next",
      args: "start",
      cwd: "./apps/web-arbitrum", // Update the working directory
      instances: 6,
      exec_mode: "cluster",
      autorestart: true,
      watch: false,
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production", // Ensure this is a standard Node.js environment value
        PROPOSALS_BIN: "web-arbitrum",
        NEXT_OTEL_VERBOSE: 1,
        PORT: 3000,
      },
    },
  ],
};
