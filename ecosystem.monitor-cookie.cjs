/**
 * PM2 mandiri untuk src/monitor_cookie.ts (tidak terikat npm run start).
 *
 * Jalankan:
 *   pm2 start ecosystem.monitor-cookie.cjs
 *   pm2 save
 *
 * Hentikan hanya monitor ini:
 *   pm2 stop monitor-cookie && pm2 delete monitor-cookie
 */
module.exports = {
  apps: [
    {
      name: 'monitor-cookie',
      script: 'npm',
      args: ['run', 'monitor:cookie'],
      cwd: __dirname,
      autorestart: false,
      cron_restart: '*/30 * * * *',
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
