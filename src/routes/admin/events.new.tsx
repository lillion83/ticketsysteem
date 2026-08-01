import { createFileRoute, redirect } from '@tanstack/react-router'

// Het eventformulier woont op /events/new (de 3-staps wizard). /admin/events/new
// is een voor de hand liggende gok vanuit het beheerscherm, en die kwam vroeger
// uit bij /admin/events/$eventId met eventId="new" — een uuid-query op de string
// "new", dus een harde databasefout. Vangen en doorsturen naar het echte
// formulier: een statisch segment gaat in TanStack vóór $eventId.
export const Route = createFileRoute('/admin/events/new')({
  beforeLoad: () => {
    throw redirect({ to: '/events/new' })
  },
})
