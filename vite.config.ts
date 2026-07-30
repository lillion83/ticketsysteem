import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

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
  for (const url of [process.env.PUBLIC_BASE_URL, process.env.BETTER_AUTH_URL]) {
    if (!url) continue
    try {
      hosts.add(new URL(url).hostname)
    } catch {
      // Onleesbare URL negeren; env-assert.ts klaagt daar al over.
    }
  }
  return [...hosts]
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  server: { allowedHosts: toegestaneHosts() },
  plugins: [
    devtools(),
    nitro({ rollupConfig: { external: [/^@sentry\//] } }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
