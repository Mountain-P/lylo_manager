module.exports = {
  apps : [{
    name   : "inventory-manager-backend",
    script : "./backend/server.js",
    watch  : ["backend"],
    ignore_watch : ["node_modules", "backend/logs"],
    env_development: {
      "NODE_ENV": "development"
    },
    env_production: {
      "NODE_ENV": "production",
    },
    log_date_format: "YYYY-MM-DD HH:mm Z",
    error_file: "./backend/logs/error.log",
    out_file: "./backend/logs/out.log",
    merge_logs: true,
  }]
} 