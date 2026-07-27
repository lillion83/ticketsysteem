import { Link } from '@tanstack/react-router'
import type { MijnTicket, MijnTicketStatus } from '#/server/mijnTickets'

// Gedeeld door de "Mijn Tickets"-overzichtspagina en de event-detailpagina.

export const statusStijl: Record<
  MijnTicketStatus,
  { label: string; cls: string }
> = {
  geldig: { label: 'Geldig', cls: 'bg-[#DCFCE7] text-[#16A34A]' },
  gebruikt: { label: 'Gebruikt', cls: 'bg-[#F1F5F9] text-[#64748B]' },
  ingetrokken: { label: 'Ingetrokken', cls: 'bg-[#FEE2E2] text-[#DC2626]' },
}

// Eén ticketrij binnen een event: klikbaar naar de publieke ticketpagina, met
// tickettype als titel en de status-badge rechts.
export function TicketRij({ ticket }: { ticket: MijnTicket }) {
  const stijl = statusStijl[ticket.status]
  return (
    <Link
      to="/t/$code"
      params={{ code: ticket.code }}
      className="flex items-center justify-between gap-4 rounded-[14px] border border-[#E5E7EB] p-4 transition hover:shadow-md"
    >
      <div className="min-w-0">
        <div className="text-[15px] font-extrabold">{ticket.type_naam}</div>
        <div className="truncate text-[12.5px] text-[#94A3B8]">
          {ticket.code}
        </div>
      </div>
      <span
        className={`whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-bold ${stijl.cls}`}
      >
        {stijl.label}
      </span>
    </Link>
  )
}
