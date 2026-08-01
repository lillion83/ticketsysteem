import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'
import { FoutOpgetreden, NietGevonden } from './components/foutpagina'

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    // Zonder deze twee toont TanStack de kale foutmelding in de pagina. Bij een
    // verkeerd pad onder /admin/events kwam daardoor de SQL-query in beeld.
    defaultErrorComponent: FoutOpgetreden,
    defaultNotFoundComponent: NietGevonden,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
