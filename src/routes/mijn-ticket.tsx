import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { SiteFooter, SiteNav, SitePage } from '#/components/discovery/site'
import { authClient, signOut } from '#/lib/auth-client'
import { formatDateLine } from '#/lib/datum'
import { getCurrentUser, googleBeschikbaar } from '#/server/session'
import { listMijnTickets } from '#/server/mijnTickets'
import type { MijnTicket, MijnTicketStatus } from '#/server/mijnTickets'

// "Mijn Tickets" (fase K): kopers loggen in met Google of een e-mailcode en zien
// hun gekochte tickets met status. Zonder login blijft de losse code/link-
// opzoeker beschikbaar.
export const Route = createFileRoute('/mijn-ticket')({
  loader: async () => {
    const user = await getCurrentUser()
    if (!user) return { user: null, tickets: [] as Array<MijnTicket>, googleEnabled: await googleBeschikbaar() }
    return { user, tickets: await listMijnTickets(), googleEnabled: false }
  },
  component: MijnTicket,
})

const statusStijl: Record<MijnTicketStatus, { label: string; cls: string }> = {
  geldig: { label: 'Geldig', cls: 'bg-[#DCFCE7] text-[#16A34A]' },
  gebruikt: { label: 'Gebruikt', cls: 'bg-[#F1F5F9] text-[#64748B]' },
  ingetrokken: { label: 'Ingetrokken', cls: 'bg-[#FEE2E2] text-[#DC2626]' },
}

function MijnTicket() {
  const { user, tickets, googleEnabled } = Route.useLoaderData()

  return (
    <SitePage>
      <SiteNav active="ticket" />
      <div className="mx-auto max-w-[640px] px-6 py-16">
        <h1 className="mb-2 text-[28px] font-extrabold">Mijn Tickets</h1>
        {user ? <Overzicht email={user.email} tickets={tickets} /> : <Inloggen googleEnabled={googleEnabled} />}
        <CodeOpzoeker />
      </div>
      <SiteFooter />
    </SitePage>
  )
}

function Overzicht({ email, tickets }: { email: string; tickets: Array<MijnTicket> }) {
  const router = useRouter()

  async function uitloggen() {
    await signOut()
    router.invalidate()
  }

  return (
    <section className="mb-10">
      <div className="mb-6 flex items-center justify-between">
        <p className="text-[14px] text-[#64748B]">
          Ingelogd als <strong className="text-[#0F172A]">{email}</strong>
        </p>
        <button onClick={uitloggen} className="text-[13px] font-bold text-[#2563EB] hover:text-[#1D4ED8]">
          Uitloggen
        </button>
      </div>

      {tickets.length === 0 ? (
        <div className="rounded-[16px] border border-dashed border-[#E5E7EB] py-12 text-center text-[14px] text-[#64748B]">
          Nog geen tickets op dit account. Tickets verschijnen hier zodra de organisator ze op dit e-mailadres uitgeeft.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {tickets.map((t) => {
            const stijl = statusStijl[t.status]
            return (
              <Link
                key={t.code}
                to="/t/$code"
                params={{ code: t.code }}
                className="flex items-center justify-between gap-4 rounded-[14px] border border-[#E5E7EB] p-4 transition hover:shadow-md"
              >
                <div>
                  <div className="text-[15px] font-extrabold">{t.event_naam}</div>
                  <div className="text-[12.5px] text-[#64748B]">
                    {formatDateLine(new Date(t.datum_start))}
                    {t.locatie ? ` · ${t.locatie}` : ''} · {t.type_naam}
                  </div>
                </div>
                <span className={`whitespace-nowrap rounded-full px-3 py-1 text-[12px] font-bold ${stijl.cls}`}>
                  {stijl.label}
                </span>
              </Link>
            )
          })}
        </div>
      )}
    </section>
  )
}

function Inloggen({ googleEnabled }: { googleEnabled: boolean }) {
  const router = useRouter()
  const [stap, setStap] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  async function metGoogle() {
    setFout(null)
    await authClient.signIn.social({ provider: 'google', callbackURL: '/mijn-ticket' })
  }

  async function stuurCode(e: React.FormEvent) {
    e.preventDefault()
    setFout(null)
    setBezig(true)
    const { error } = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
    setBezig(false)
    if (error) {
      setFout(error.message ?? 'Versturen mislukt')
      return
    }
    setStap('code')
  }

  async function verifieer(e: React.FormEvent) {
    e.preventDefault()
    setFout(null)
    setBezig(true)
    const { error } = await authClient.signIn.emailOtp({ email, otp: code })
    setBezig(false)
    if (error) {
      setFout(error.message ?? 'Ongeldige code')
      return
    }
    router.invalidate()
  }

  return (
    <section className="mb-10">
      <p className="mb-6 text-[15px] text-[#64748B]">
        Log in om je tickets met status te bekijken. Tickets staan op het e-mailadres waarmee je bij de organisator hebt
        gekocht of gereserveerd.
      </p>

      {googleEnabled && (
        <>
          <button
            onClick={metGoogle}
            className="mb-5 flex w-full items-center justify-center gap-2.5 rounded-full border border-[#E5E7EB] bg-white py-3 text-[15px] font-bold text-[#0F172A] hover:bg-[#F8FAFC]"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.56c2.08-1.92 3.28-4.74 3.28-8.09Z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.56-2.76c-.98.66-2.23 1.06-3.72 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z" />
              <path fill="#FBBC05" d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z" />
            </svg>
            Inloggen met Google
          </button>

          <div className="mb-5 flex items-center gap-3 text-[12px] font-semibold text-[#94A3B8]">
            <span className="h-px flex-1 bg-[#E5E7EB]" /> of met e-mailcode{' '}
            <span className="h-px flex-1 bg-[#E5E7EB]" />
          </div>
        </>
      )}

      {stap === 'email' ? (
        <form onSubmit={stuurCode} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jouw@email.nl"
            className="w-full rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-[14px] outline-none focus:border-[#2563EB]"
          />
          {fout && <p className="text-[13px] font-semibold text-[#EF4444]">{fout}</p>}
          <button
            type="submit"
            disabled={bezig}
            className="rounded-full bg-[#2563EB] py-3 text-[15px] font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            {bezig ? 'Bezig…' : 'Stuur code'}
          </button>
        </form>
      ) : (
        <form onSubmit={verifieer} className="flex flex-col gap-3">
          <p className="text-[13px] text-[#64748B]">
            We stuurden een code naar <strong>{email}</strong>.
          </p>
          <input
            inputMode="numeric"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-cijferige code"
            className="w-full rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-[14px] tracking-[3px] outline-none focus:border-[#2563EB]"
          />
          {fout && <p className="text-[13px] font-semibold text-[#EF4444]">{fout}</p>}
          <button
            type="submit"
            disabled={bezig}
            className="rounded-full bg-[#2563EB] py-3 text-[15px] font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            {bezig ? 'Bezig…' : 'Inloggen'}
          </button>
          <button
            type="button"
            onClick={() => setStap('email')}
            className="text-[13px] font-bold text-[#64748B] hover:text-[#0F172A]"
          >
            ← Ander e-mailadres
          </button>
        </form>
      )}
    </section>
  )
}

// Losse opzoeker: open een ticket direct met de code of link uit mail/WhatsApp,
// zonder in te loggen.
function CodeOpzoeker() {
  const navigate = useNavigate()
  const [invoer, setInvoer] = useState('')
  const [fout, setFout] = useState<string | null>(null)

  function zoek(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = invoer.trim()
    const idx = trimmed.indexOf('/t/')
    const code = (idx >= 0 ? trimmed.slice(idx + 3) : trimmed).replace(/[?#].*$/, '').replace(/\/+$/, '')
    if (!code.includes('.')) {
      setFout('Vul een geldige ticketcode of ticketlink in.')
      return
    }
    navigate({ to: '/t/$code', params: { code } })
  }

  return (
    <section className="border-t border-[#E5E7EB] pt-8">
      <h2 className="mb-2 text-[16px] font-extrabold">Heb je alleen een link of code?</h2>
      <p className="mb-4 text-[13.5px] text-[#64748B]">
        Plak je ticketlink of -code uit de mail of WhatsApp om je ticket direct te openen.
      </p>
      <form onSubmit={zoek} className="flex flex-col gap-3 sm:flex-row">
        <input
          value={invoer}
          onChange={(e) => setInvoer(e.target.value)}
          placeholder="Ticketlink of code…"
          className="flex-1 rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] px-4 py-3 text-[14px] outline-none focus:border-[#2563EB]"
        />
        <button
          type="submit"
          className="rounded-full border border-[#E5E7EB] px-6 py-3 text-[14px] font-bold text-[#0F172A] hover:bg-[#F8FAFC]"
        >
          Open ticket
        </button>
      </form>
      {fout && <p className="mt-2 text-[13px] font-semibold text-[#EF4444]">{fout}</p>}
    </section>
  )
}
