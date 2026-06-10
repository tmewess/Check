module.exports = {
  apps: [
    {
      name: "voidaccount",
      script: "artifacts/api-server/dist/index.mjs",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        // Set these in your actual .env or pm2 ecosystem env:
        // BOT_TOKEN: "",
        // DATABASE_URL: "",
        // SESSION_SECRET: "",
        // SHOP_URL: "https://yourdomain.com/tg-shop/",
        // ADMIN_URL: "https://yourdomain.com/admin-panel/",
      },
      error_file: "logs/err.log",
      out_file: "logs/out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss",
      max_memory_restart: "512M",
      restart_delay: 3000,
      max_restarts: 10,
    },
  ],
};
