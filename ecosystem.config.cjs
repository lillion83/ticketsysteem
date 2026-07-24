// PM2-configuratie voor productie op de VPS.
// Runtime-secrets komen uit .env.local op de VPS zelf (nooit in Git) via Node's
// ingebouwde --env-file. Zelfde opzet als webwinkri, zodat beide apps op deze
// server op dezelfde manier draaien.
//
// Draaien:  npm run build && pm2 start ecosystem.config.cjs
// Zie infra/DEPLOY.md voor de volledige stappen.
module.exports = {
  apps: [
    {
      name: 'ticketsysteem',
      script: '.output/server/index.mjs',
      node_args: '--env-file=.env.local',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
    },
  ],
}
