import { createFileRoute } from '@tanstack/react-router'
import { auth } from '#/lib/auth'

// Catch-all: alle /api/auth/*-verzoeken gaan naar Better Auth.
export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) => auth.handler(request),
      POST: ({ request }: { request: Request }) => auth.handler(request),
    },
  },
})
