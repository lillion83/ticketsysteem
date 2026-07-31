// Oude naamgeving uit fase G. De implementatie is verhuisd naar
// src/server/ticketaanvragen.ts; dit bestand bestaat nog één release als brug,
// zodat een gemiste importplek niet stilletjes breekt (Migratieplan §2.1, §6.8).
//
// Nieuwe code importeert rechtstreeks uit '#/server/ticketaanvragen'.

export {
  createTicketaanvraag as createReservering,
  listTicketaanvragen as listReserveringen,
  betaalEnVerstuur as verwerkReservering,
  annuleerTicketaanvraag as afwijzenReservering,
} from '#/server/ticketaanvragen'

export type { TicketaanvraagInput as ReserveringInput } from '#/server/ticketaanvragen'
