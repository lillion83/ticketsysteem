import { createFileRoute } from '@tanstack/react-router'
import { laadPublicTicket } from '#/server/publicTicket'
import { qrPng } from '#/lib/qr'

// De QR als los plaatje op /t/{code}/qr. Nodig omdat mailclients (Gmail voorop)
// data-URI-afbeeldingen blokkeren: de mail verwijst hiernaartoe.
// Geen `.png` in het pad: een segment met een letterlijke punt (`qr[.]png`)
// wordt door Start niet als server-route geregistreerd — getest. Wat de
// mailclient doet hangt af van het content-type, niet van de bestandsnaam.
// De underscore achter `$code_` houdt deze route los van de ticketpagina.
export const Route = createFileRoute('/t/$code_/qr')({
  server: {
    handlers: {
      GET: async ({ params }: { params: { code: string } }) => {
        const ticket = await laadPublicTicket(params.code)
        if (!ticket) return new Response('Niet gevonden', { status: 404 })

        const png = await qrPng(ticket.code)
        return new Response(new Uint8Array(png), {
          headers: {
            'content-type': 'image/png',
            // Kort cachen: de QR verandert niet, maar we willen geen plaatjes
            // van ingetrokken tickets eindeloos in proxies laten hangen.
            'cache-control': 'public, max-age=300',
          },
        })
      },
    },
  },
})
