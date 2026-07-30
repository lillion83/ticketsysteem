// PM2-configuratie voor productie op InterServer.
// Runtime-secrets komen uit .env.production in de productiemap (nooit in Git) via
// Node's ingebouwde --env-file. Zelfde opzet als webwinkri, zodat beide apps op
// deze server op dezelfde manier draaien.
//
// Waarom .env.production en niet .env.local: `.env.local` is de enige naam die
// nitro/vite automatisch inleest én voorrang geeft boven `.env`. Daardoor draaide
// een `npm run dev` in deze map met de productie-URL's en de echte mailkey. Nitro
// leest `.env.${mode}`, dus `.env.production` wordt in dev-mode nooit aangeraakt.
//
// Draaien:  npm run build && pm2 start ecosystem.config.cjs
// Let op: na een wijziging in cwd of node_args is `pm2 restart` NIET genoeg — die
// neemt ze niet over. Dan `pm2 delete ticketsysteem && pm2 start ecosystem.config.cjs`.
// Zie infra/DEPLOY.md voor de volledige stappen.
module.exports = {
  apps: [
    {
      name: 'ticketsysteem',
      // Expliciet absoluut: zonder cwd hangen script en env-file af van de map
      // waaruit je pm2 startte, en dat is precies het soort verrassing dat we
      // hier niet willen.
      cwd: '/home/amresh/ticketsysteem',
      script: '.output/server/index.mjs',
      node_args: '--env-file=.env.production',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      // InterServer heeft 1,9 GB RAM. Een geheugenlek mag de app herstarten, niet
      // de machine opeten en de kernel laten kiezen wie sneuvelt. Normaal gebruik
      // ligt rond 115 MB, dus 400M is ruim.
      max_memory_restart: '400M',
    },
  ],
}
