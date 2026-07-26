import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { SiteFooter, SiteNav, SitePage } from '#/components/discovery/site'

// "Mijn Ticket" (fase I): kopers hebben geen account, dus zoeken hun ticket op
// via de code of de ticketlink die ze per mail/WhatsApp kregen. We sturen door
// naar de bestaande publieke ticketpagina /t/{code}.
export const Route = createFileRoute('/mijn-ticket')({ component: MijnTicket })

// Haalt de code uit een geplakte link of gebruikt de ruwe invoer.
function haalCode(invoer: string): string {
  const trimmed = invoer.trim()
  const idx = trimmed.indexOf('/t/')
  const code = idx >= 0 ? trimmed.slice(idx + 3) : trimmed
  return code.replace(/[?#].*$/, '').replace(/\/+$/, '')
}

function MijnTicket() {
  const navigate = useNavigate()
  const [invoer, setInvoer] = useState('')
  const [fout, setFout] = useState<string | null>(null)

  function zoek(e: React.FormEvent) {
    e.preventDefault()
    const code = haalCode(invoer)
    if (!code.includes('.')) {
      setFout('Vul een geldige ticketcode of ticketlink in.')
      return
    }
    navigate({ to: '/t/$code', params: { code } })
  }

  return (
    <SitePage>
      <SiteNav active="ticket" />
      <div className="mx-auto max-w-[520px] px-6 py-20">
        <h1 className="mb-2 text-[28px] font-extrabold">Mijn Ticket</h1>
        <p className="mb-8 text-[15px] text-[#64748B]">
          Plak hieronder je ticketlink of ticketcode uit de mail of WhatsApp om je ticket met QR-code te openen.
        </p>
        <form onSubmit={zoek} className="flex flex-col gap-3">
          <input
            value={invoer}
            onChange={(e) => setInvoer(e.target.value)}
            placeholder="Ticketlink of code…"
            className="w-full rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3.5 text-[14px] outline-none focus:border-[#2563EB]"
          />
          {fout && <p className="text-[13px] font-semibold text-[#EF4444]">{fout}</p>}
          <button
            type="submit"
            className="rounded-full bg-[#2563EB] py-3.5 text-[15px] font-bold text-white hover:bg-[#1D4ED8]"
          >
            Open mijn ticket
          </button>
        </form>
      </div>
      <SiteFooter />
    </SitePage>
  )
}
