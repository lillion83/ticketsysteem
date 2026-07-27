import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { TanStackDevtools } from '@tanstack/react-devtools'

import appCss from '../styles.css?url'
import { getCurrentUser } from '#/server/session'

export const Route = createRootRoute({
  // Sessie één keer centraal laden: de publieke header (SiteNav) leest hieruit
  // of er iemand is ingelogd en welke rol. Login/logout roepen router.invalidate()
  // aan, waardoor deze loader herlaadt en de header vanzelf ververst.
  loader: async () => ({ user: await getCurrentUser() }),
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Ticketsysteem',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
      // Manrope: het lettertype van de publieke discovery-front-end (ontwerp).
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap',
      },
      {
        rel: 'manifest',
        href: '/manifest.webmanifest',
      },
    ],
  }),
  shellComponent: RootDocument,
})

// Registreert de service worker (fase E, offline-first). Alleen in productie:
// in dev zou de SW de assets van de dev-server cachen en verwarring geven.
function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!import.meta.env.PROD) return
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Registratie mislukt (bv. geen https): de app werkt gewoon door,
      // alleen zonder offline-shell.
    })
  }, [])
  return null
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <ServiceWorkerRegistrar />
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
