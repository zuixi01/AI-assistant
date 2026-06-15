module.exports = {
  apps: [
    {
      name: 'ai-assistant-api',
      cwd: __dirname,
      script: 'pnpm.cmd',
      args: '--filter @ai-assistant/api start:managed',
      interpreter: 'none',
      autorestart: true,
      restart_delay: 5000,
      min_uptime: '20s',
      max_restarts: 20,
      max_memory_restart: '768M',
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'ai-assistant-web',
      cwd: __dirname,
      script: 'pnpm.cmd',
      args: '--filter @ai-assistant/web start',
      interpreter: 'none',
      autorestart: true,
      restart_delay: 5000,
      min_uptime: '20s',
      max_restarts: 20,
      max_memory_restart: '768M',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
