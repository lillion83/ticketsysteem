import { createFileRoute } from '@tanstack/react-router'
import { getPublicTicket } from '#/server/publicTicket'

// Publieke ticketpagina (PLAN §3.6). Geen login: de HMAC in de URL is het
// toegangsbewijs. Deze pagina wordt vrijwel altijd op een telefoon geopend,
// dus mobile first en de QR zo groot mogelijk.

export const Route = createFileRoute('/t/$code')({
  loader: ({ params }) => getPublicTicket({ data: params.code }),
  component: TicketPagina,
  errorComponent: TicketFout,
})

function formatDatum(datum: Date | string): string {
  return new Date(datum).toLocaleString('nl-NL', {
    dateStyle: 'full',
    timeStyle: 'short',
  })
}

function TicketPagina() {
  const { ticket, qr } = Route.useLoaderData()
  const geldig = ticket.status === 'geldig'

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 bg-gray-100 p-4">
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <p className="text-center text-xs font-medium tracking-wide text-gray-500 uppercase">
          E-ticket
        </p>
        <h1 className="mt-1 text-center text-2xl font-bold">
          {ticket.event_naam}
        </h1>
        <p className="mt-1 text-center text-sm text-gray-600">
          {formatDatum(ticket.datum_start)}
          {ticket.locatie ? ` · ${ticket.locatie}` : ''}
        </p>

        {!geldig && (
          <div
            className={`mt-4 rounded-lg px-4 py-3 text-center text-sm font-semibold ${
              ticket.status === 'ingetrokken'
                ? 'bg-red-100 text-red-800'
                : 'bg-amber-100 text-amber-900'
            }`}
          >
            {ticket.status === 'ingetrokken'
              ? 'Dit ticket is ingetrokken en geeft geen toegang.'
              : `Dit ticket is al gescand${
                  ticket.gebruikt_op
                    ? ` op ${formatDatum(ticket.gebruikt_op)}`
                    : ''
                }.`}
          </div>
        )}

        {/* Witte achtergrond en flinke marge: QR's op telefoonschermen lezen
            slecht bij fel licht (PLAN §7.2). */}
        <div
          className={`mx-auto mt-5 w-full max-w-xs rounded-xl bg-white p-3 ${
            geldig ? '' : 'opacity-40'
          }`}
          // De SVG komt uit onze eigen qrcode-generator, niet uit gebruikersinvoer.
          dangerouslySetInnerHTML={{ __html: qr }}
        />

        <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-gray-500">Naam</dt>
          <dd className="font-medium">{ticket.koper_naam ?? '—'}</dd>
          <dt className="text-gray-500">Type</dt>
          <dd className="font-medium">{ticket.type_naam}</dd>
        </dl>
      </div>

      <p className="text-center text-xs text-gray-500">
        Laat deze QR-code scannen bij de ingang. Tip: maak een screenshot, dan
        werkt hij ook zonder internet.
      </p>
    </main>
  )
}

function TicketFout() {
  // Bewust één generieke tekst: onbekend, vervalst en verlopen zijn van buitenaf
  // niet te onderscheiden.
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-3 bg-gray-100 p-6 text-center">
      <h1 className="text-xl font-bold">Ticket niet gevonden</h1>
      <p className="text-sm text-gray-600">
        Deze link is niet geldig. Controleer of je de volledige link uit je
        bericht hebt geopend, of neem contact op met de verkoper.
      </p>
    </main>
  )
}
