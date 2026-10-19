// PM2 cho VPS production: chỉ chạy API (tsx server.ts).
// Frontend là file tĩnh trong dist/, do nginx phục vụ.
module.exports = {
  apps: [
    {
      name: "warehouse-oms-api",
      script: "npx",
      args: "tsx server.ts",
      cwd: "/opt/warehouse-oms",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
