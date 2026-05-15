module.exports = {
  apps: [{
    name: 'jamsabak',
    script: 'server.js',
    cwd: __dirname,
    watch: false,
    max_memory_restart: '500M',
    exp_backoff_restart_delay: 1000,
    env: {
      NODE_ENV: 'production',
      NO_BROWSER: '1',
      PORT: 3500
    },
    // 로그 설정
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    merge_logs: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    // 자동 재시작
    autorestart: true,
    min_uptime: '10s',
    max_restarts: 50,
  }]
};
