import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { contentTypeVoor, uploadDir } from './src/lib/uploads'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

// Vite weigert verzoeken met een Host-header die hij niet kent (bescherming tegen
// DNS-rebinding) en antwoordt dan met 403 "Blocked request. This host is not
// allowed." Dat treft de test-omgeving, die via Caddy op
// https://test-tickets.mijnonline.shop binnenkomt in plaats van op localhost.
//
// We leiden de toegestane host af uit de env in plaats van hem hard te coderen:
// zo werkt dezelfde config voor localhost, de dev-map en de testomgeving, en
// blijft de bescherming staan (`allowedHosts: true` zou haar juist uitschakelen).
function toegestaneHosts(): Array<string> {
  const hosts = new Set<string>()
  for (const url of [
    process.env.PUBLIC_BASE_URL,
    process.env.BETTER_AUTH_URL,
  ]) {
    if (!url) continue
    try {
      hosts.add(new URL(url).hostname)
    } catch {
      // Onleesbare URL negeren; env-assert.ts klaagt daar al over.
    }
  }
  return [...hosts]
}

/**
 * Serveert /uploads/{bestand} tijdens `vite dev` uit UPLOAD_DIR.
 *
 * In productie doet `src/routes/uploads.$bestand.ts` dit, maar in de dev-server
 * komt zo'n verzoek daar nooit aan: de statische-bestandenlaag van Vite pakt elk
 * pad met een afbeeldings-extensie eerst af, en die kijkt in de projectmap
 * (`./uploads`) in plaats van in UPLOAD_DIR. Dev werkte daardoor bij toeval —
 * daar zijn die twee paden hetzelfde — en de test-omgeving, die naar
 * `uploads-test` schrijft, gaf overal een ontbrekende afbeelding.
 *
 * Deze middleware staat vóór de interne middlewares (dat is wat `configureServer`
 * zonder post-hook betekent), dus hij is als eerste aan zet. Vindt hij het
 * bestand niet, dan geeft hij het door met `next()`.
 */
function uploadsDevServer(): Plugin {
  return {
    name: 'ticketsysteem-uploads-dev',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/uploads', (req, res, next) => {
        const pad = (req.url ?? '').split('?')[0]
        const naam = path.basename(decodeURIComponent(pad))
        const type = contentTypeVoor(naam)
        // Alleen kale bestandsnamen met een toegestane extensie; de rest is niet
        // van ons (zelfde controle als de route, tegen path traversal).
        if (!type || naam !== decodeURIComponent(pad).replace(/^\//, '')) {
          next()
          return
        }
        readFile(path.join(uploadDir(), naam)).then(
          (bytes) => {
            res.setHeader('content-type', type)
            res.setHeader('x-content-type-options', 'nosniff')
            res.end(bytes)
          },
          () => next(),
        )
      })
    },
  }
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: { allowedHosts: toegestaneHosts() },
  plugins: [
    uploadsDevServer(),
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
