import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { getEvent, updateEvent } from '#/server/events'
import {
  createTicketType,
  listTicketTypes,
  updateTicketType,
} from '#/server/ticketTypes'
import { issueTicket, listTickets, revokeTicket } from '#/server/tickets'
import {
  getPublicBaseUrl,
  markDelivered,
  sendTicketMail,
} from '#/server/delivery'
import {
  createAgenda,
  createFaq,
  createSpreker,
  deleteAgenda,
  deleteFaq,
  deleteSpreker,
  listAgenda,
  listFaq,
  listSprekers,
} from '#/server/eventContent'
import {
  annuleerTicketaanvraag,
  betaalEnVerstuur,
  listTicketaanvragen,
  markeerBetaald,
  ticketsVoorAanvraag,
} from '#/server/ticketaanvragen'
import { eventCategories } from '#/components/discovery/data'
import { CoverUpload } from '#/components/cover-upload'
import { ticketBericht, whatsappLink } from '#/lib/whatsapp'
import { kortCode } from '#/lib/scanResult'
import {
  VERKOOPKANAAL_LABEL,
  VERKOOPKANALEN,
  verkoopkanaalLabel,
} from '#/lib/verkoopkanaal'
import type { Verkoopkanaal } from '#/lib/verkoopkanaal'

type Categorie = (typeof eventCategories)[number]

export const Route = createFileRoute('/admin/events/$eventId')({
  loader: async ({ params }) => {
    const [
      event,
      types,
      tickets,
      baseUrl,
      sprekers,
      agenda,
      faq,
      ticketaanvragen,
    ] = await Promise.all([
      getEvent({ data: params.eventId }),
      listTicketTypes({ data: params.eventId }),
      listTickets({ data: { eventId: params.eventId } }),
      getPublicBaseUrl(),
      listSprekers({ data: params.eventId }),
      listAgenda({ data: params.eventId }),
      listFaq({ data: params.eventId }),
      listTicketaanvragen({ data: params.eventId }),
    ])
    return {
      event,
      types,
      tickets,
      baseUrl,
      sprekers,
      agenda,
      faq,
      ticketaanvragen,
    }
  },
  component: EventDetail,
})

// ISO → waarde voor <input type="datetime-local"> (lokale tijd, zonder seconden).
function toLocalInput(iso: string | Date): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

// ── Gedeelde huisstijl-helpers ───────────────────────────────────────────────

const inputCls =
  'w-full rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-2.5 text-[14px] outline-none focus:border-[#2563EB]'
const inputSm =
  'w-full rounded-[9px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-[13.5px] outline-none focus:border-[#2563EB]'

function Kaart({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6 ${className}`}
    >
      {children}
    </div>
  )
}

function Veld({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold">{label}</span>
      {children}
    </label>
  )
}

function PrimaryBtn({
  children,
  onClick,
  type = 'button',
  disabled,
  size = 'md',
}: {
  children: ReactNode
  onClick?: () => void
  type?: 'button' | 'submit'
  disabled?: boolean
  size?: 'sm' | 'md'
}) {
  const pad =
    size === 'sm' ? 'px-4 py-2 text-[13px]' : 'px-5 py-2.5 text-[14px]'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full bg-[#2563EB] font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-50 ${pad}`}
    >
      {children}
    </button>
  )
}

function GhostBtn({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-[13px] font-semibold text-[#0F172A] hover:border-[#CBD5E1] disabled:opacity-50"
    >
      {children}
    </button>
  )
}

/**
 * Rij keuzechips. Vaste keuzes in plaats van een vrij tekstveld — anders is de
 * rapportage achteraf waardeloos.
 */
function ChipGroep<T extends string>({
  opties,
  waarde,
  onKies,
}: {
  opties: ReadonlyArray<{ waarde: T; label: string }>
  waarde: T | null
  onKies: (waarde: T) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {opties.map((o) => (
        <button
          key={o.waarde}
          type="button"
          onClick={() => onKies(o.waarde)}
          className={`rounded-full border px-3.5 py-2 text-[13px] font-semibold ${
            o.waarde === waarde
              ? 'border-[#2563EB] bg-[#2563EB] text-white'
              : 'border-[#E5E7EB] bg-white text-[#334155] hover:border-[#93C5FD]'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function EventDetail() {
  const { event, types } = Route.useLoaderData()

  return (
    <div className="flex flex-col gap-6">
      <EventSectie />
      <TicketaanvragenSectie />
      <TicketTypesSectie />
      <SprekersSectie />
      <AgendaSectie />
      <FaqSectie />
      <UitgifteSectie
        eventId={event.id}
        types={types.map((t) => ({ id: t.id, naam: t.naam }))}
      />
      <VerkooplijstSectie />
    </div>
  )
}

const eventStatusStijl: Record<string, string> = {
  actief: 'bg-[#DCFCE7] text-[#16A34A]',
  concept: 'bg-[#F1F5F9] text-[#64748B]',
  afgelopen: 'bg-[#FEF3C7] text-[#B45309]',
}

function EventSectie() {
  const { event } = Route.useLoaderData()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [naam, setNaam] = useState(event.naam)
  const [start, setStart] = useState(toLocalInput(event.datum_start))
  const [eind, setEind] = useState(toLocalInput(event.datum_eind))
  const [locatie, setLocatie] = useState(event.locatie ?? '')
  const [reEntry, setReEntry] = useState(event.re_entry_toegestaan)
  const [status, setStatus] = useState(event.status)
  const [categorie, setCategorie] = useState<Categorie | ''>(
    event.categorie ?? '',
  )
  const [beschrijving, setBeschrijving] = useState(event.beschrijving ?? '')
  const [coverUrl, setCoverUrl] = useState(event.cover_afbeelding_url ?? '')
  const [fout, setFout] = useState<string | null>(null)

  async function opslaan(e: React.FormEvent) {
    e.preventDefault()
    setFout(null)
    try {
      await updateEvent({
        data: {
          id: event.id,
          naam,
          datum_start: new Date(start).toISOString(),
          datum_eind: new Date(eind).toISOString(),
          locatie: locatie || null,
          re_entry_toegestaan: reEntry,
          status,
          categorie: categorie || null,
          beschrijving: beschrijving || null,
          cover_afbeelding_url: coverUrl || null,
        },
      })
      setOpen(false)
      router.invalidate()
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Opslaan mislukt')
    }
  }

  return (
    <section>
      <div className="mb-1 text-[13px] text-[#64748B]">
        <Link to="/admin/events" className="hover:text-[#0F172A]">
          Events
        </Link>{' '}
        / <span className="font-semibold text-[#0F172A]">{event.naam}</span>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[24px] font-extrabold tracking-tight">
              {event.naam}
            </h1>
            <span
              className={`rounded-full px-3 py-1 text-[12px] font-bold ${eventStatusStijl[event.status] ?? eventStatusStijl.concept}`}
            >
              {event.status}
            </span>
          </div>
          <p className="text-[13px] text-[#64748B]">
            {new Date(event.datum_start).toLocaleString('nl-NL')}
            {event.locatie ? ` · ${event.locatie}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/admin/events/$eventId/dashboard"
            params={{ eventId: event.id }}
            className="rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-[13px] font-semibold text-[#0F172A] hover:border-[#CBD5E1]"
          >
            Dashboard
          </Link>
          <Link
            to="/admin/events/$eventId/deur"
            params={{ eventId: event.id }}
            className="rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-[13px] font-semibold text-[#0F172A] hover:border-[#CBD5E1]"
          >
            Deur &amp; rapportage
          </Link>
          <Link
            to="/scan/$eventId"
            params={{ eventId: event.id }}
            className="rounded-full bg-[#2563EB] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#1D4ED8]"
          >
            Scannen
          </Link>
          <GhostBtn onClick={() => setOpen((v) => !v)}>
            {open ? 'Annuleren' : 'Bewerken'}
          </GhostBtn>
        </div>
      </div>

      {open && (
        <Kaart className="mt-4">
          <form onSubmit={opslaan} className="grid gap-4">
            <Veld label="Naam">
              <input
                required
                value={naam}
                onChange={(e) => setNaam(e.target.value)}
                className={inputCls}
              />
            </Veld>
            <div className="grid gap-4 sm:grid-cols-2">
              <Veld label="Start">
                <input
                  type="datetime-local"
                  required
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className={inputCls}
                />
              </Veld>
              <Veld label="Eind">
                <input
                  type="datetime-local"
                  required
                  value={eind}
                  onChange={(e) => setEind(e.target.value)}
                  className={inputCls}
                />
              </Veld>
            </div>
            <Veld label="Locatie">
              <input
                value={locatie}
                onChange={(e) => setLocatie(e.target.value)}
                className={inputCls}
              />
            </Veld>
            <div className="grid items-end gap-4 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-[14px]">
                <input
                  type="checkbox"
                  checked={reEntry}
                  onChange={(e) => setReEntry(e.target.checked)}
                  className="h-4 w-4 accent-[#2563EB]"
                />
                Re-entry toegestaan
              </label>
              <Veld label="Status">
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className={inputCls}
                >
                  <option value="concept">concept</option>
                  <option value="actief">actief</option>
                  <option value="afgelopen">afgelopen</option>
                </select>
              </Veld>
            </div>
            <Veld label="Categorie (publiek)">
              <select
                value={categorie}
                onChange={(e) => setCategorie(e.target.value as Categorie | '')}
                className={inputCls}
              >
                <option value="">— geen —</option>
                {eventCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Veld>
            <Veld label="Beschrijving (publiek)">
              <textarea
                value={beschrijving}
                onChange={(e) => setBeschrijving(e.target.value)}
                rows={4}
                className={inputCls}
              />
            </Veld>
            <Veld label="Cover-afbeelding (publiek)">
              <CoverUpload value={coverUrl} onChange={setCoverUrl} />
            </Veld>
            {fout && (
              <p className="text-[14px] font-semibold text-[#DC2626]">{fout}</p>
            )}
            <PrimaryBtn type="submit">Opslaan</PrimaryBtn>
          </form>
        </Kaart>
      )}
    </section>
  )
}

// Generieke kaart voor een beheersectie met een lijst + verwijderknoppen.
function ContentSectie({
  titel,
  leeg,
  children,
}: {
  titel: string
  leeg: boolean
  children: ReactNode
}) {
  return (
    <Kaart>
      <h2 className="mb-4 text-[16px] font-extrabold">{titel}</h2>
      {leeg && (
        <p className="mb-3 text-[13.5px] text-[#64748B]">
          Nog niets toegevoegd.
        </p>
      )}
      <div className="flex flex-col gap-2">{children}</div>
    </Kaart>
  )
}

function VerwijderKnop({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[13px] font-semibold text-[#DC2626] hover:underline"
      type="button"
    >
      Verwijderen
    </button>
  )
}

function RijItem({
  children,
  actie,
}: {
  children: ReactNode
  actie: ReactNode
}) {
  return (
    <div className="flex items-center justify-between rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-2.5">
      <span className="text-[13.5px]">{children}</span>
      {actie}
    </div>
  )
}

function SprekersSectie() {
  const { event, sprekers } = Route.useLoaderData()
  const router = useRouter()
  const [naam, setNaam] = useState('')
  const [rol, setRol] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')

  async function toevoegen(e: React.FormEvent) {
    e.preventDefault()
    await createSpreker({
      data: { event_id: event.id, naam, rol, avatar_url: avatarUrl },
    })
    setNaam('')
    setRol('')
    setAvatarUrl('')
    router.invalidate()
  }

  return (
    <ContentSectie
      titel="Sprekers / Line-up (publiek)"
      leeg={sprekers.length === 0}
    >
      {sprekers.map((s) => (
        <RijItem
          key={s.id}
          actie={
            <VerwijderKnop
              onClick={async () => {
                await deleteSpreker({ data: s.id })
                router.invalidate()
              }}
            />
          }
        >
          <strong>{s.naam}</strong>
          {s.rol ? ` · ${s.rol}` : ''}
        </RijItem>
      ))}
      <form onSubmit={toevoegen} className="mt-2 flex flex-wrap gap-2">
        <input
          required
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
          placeholder="Naam"
          className={`flex-1 ${inputSm}`}
        />
        <input
          value={rol}
          onChange={(e) => setRol(e.target.value)}
          placeholder="Rol (bv. DJ)"
          className={`flex-1 ${inputSm}`}
        />
        <input
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="Avatar-URL"
          className={`flex-1 ${inputSm}`}
        />
        <PrimaryBtn type="submit" size="sm">
          Toevoegen
        </PrimaryBtn>
      </form>
    </ContentSectie>
  )
}

function AgendaSectie() {
  const { event, agenda } = Route.useLoaderData()
  const router = useRouter()
  const [tijd, setTijd] = useState('')
  const [titel, setTitel] = useState('')
  const [subtitel, setSubtitel] = useState('')
  const [beschrijving, setBeschrijving] = useState('')

  async function toevoegen(e: React.FormEvent) {
    e.preventDefault()
    await createAgenda({
      data: { event_id: event.id, tijd, titel, subtitel, beschrijving },
    })
    setTijd('')
    setTitel('')
    setSubtitel('')
    setBeschrijving('')
    router.invalidate()
  }

  return (
    <ContentSectie titel="Agenda (publiek)" leeg={agenda.length === 0}>
      {agenda.map((a) => (
        <RijItem
          key={a.id}
          actie={
            <VerwijderKnop
              onClick={async () => {
                await deleteAgenda({ data: a.id })
                router.invalidate()
              }}
            />
          }
        >
          <strong>{a.tijd}</strong> · {a.titel}
          {a.subtitel ? ` — ${a.subtitel}` : ''}
        </RijItem>
      ))}
      <form onSubmit={toevoegen} className="mt-2 flex flex-wrap gap-2">
        <input
          required
          value={tijd}
          onChange={(e) => setTijd(e.target.value)}
          placeholder="Tijd (bv. 09.00)"
          className={`w-28 ${inputSm}`}
        />
        <input
          required
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          placeholder="Titel"
          className={`flex-1 ${inputSm}`}
        />
        <input
          value={subtitel}
          onChange={(e) => setSubtitel(e.target.value)}
          placeholder="Subtitel"
          className={`flex-1 ${inputSm}`}
        />
        <input
          value={beschrijving}
          onChange={(e) => setBeschrijving(e.target.value)}
          placeholder="Beschrijving"
          className={`w-full ${inputSm}`}
        />
        <PrimaryBtn type="submit" size="sm">
          Toevoegen
        </PrimaryBtn>
      </form>
    </ContentSectie>
  )
}

function FaqSectie() {
  const { event, faq } = Route.useLoaderData()
  const router = useRouter()
  const [vraag, setVraag] = useState('')
  const [antwoord, setAntwoord] = useState('')

  async function toevoegen(e: React.FormEvent) {
    e.preventDefault()
    await createFaq({ data: { event_id: event.id, vraag, antwoord } })
    setVraag('')
    setAntwoord('')
    router.invalidate()
  }

  return (
    <ContentSectie
      titel="Veelgestelde vragen (publiek)"
      leeg={faq.length === 0}
    >
      {faq.map((f) => (
        <RijItem
          key={f.id}
          actie={
            <VerwijderKnop
              onClick={async () => {
                await deleteFaq({ data: f.id })
                router.invalidate()
              }}
            />
          }
        >
          <strong>{f.vraag}</strong>
          {f.antwoord ? ` — ${f.antwoord}` : ''}
        </RijItem>
      ))}
      <form onSubmit={toevoegen} className="mt-2 flex flex-wrap gap-2">
        <input
          required
          value={vraag}
          onChange={(e) => setVraag(e.target.value)}
          placeholder="Vraag"
          className={`flex-1 ${inputSm}`}
        />
        <input
          value={antwoord}
          onChange={(e) => setAntwoord(e.target.value)}
          placeholder="Antwoord"
          className={`flex-1 ${inputSm}`}
        />
        <PrimaryBtn type="submit" size="sm">
          Toevoegen
        </PrimaryBtn>
      </form>
    </ContentSectie>
  )
}

// ── Ticketaanvragen ──────────────────────────────────────────────────────────
// Heette "Reserveringen"; de tabel houdt die naam, de UI niet meer. Het woord
// "reservering" komt hier bewust nergens meer voor (Migratieplan §5).

type Ticketaanvraag = ReturnType<
  typeof Route.useLoaderData
>['ticketaanvragen'][number]

/** DB-status → label en badgekleur, één op één uit het ontwerp. */
const AANVRAAG_STATUS: Record<string, { label: string; cls: string }> = {
  nieuw: { label: 'Wacht op betaling', cls: 'bg-[#FEF3C7] text-[#B45309]' },
  betaald: { label: 'Betaald', cls: 'bg-[#DBEAFE] text-[#1D4ED8]' },
  afgehandeld: {
    label: 'Ticket verzonden',
    cls: 'bg-[#DCFCE7] text-[#15803D]',
  },
  geannuleerd: { label: 'Geannuleerd', cls: 'bg-[#FEE2E2] text-[#B91C1C]' },
  // Historische waarde van vóór migratie 0012; toont hetzelfde label.
  afgewezen: { label: 'Geannuleerd', cls: 'bg-[#FEE2E2] text-[#B91C1C]' },
  verlopen: { label: 'Verlopen', cls: 'bg-[#F1F5F9] text-[#94A3B8]' },
}

function statusInfo(status: string) {
  return (
    AANVRAAG_STATUS[status] ?? {
      label: status,
      cls: 'bg-[#F1F5F9] text-[#475569]',
    }
  )
}

function StatusBadge({ status }: { status: string }) {
  const { label, cls } = statusInfo(status)
  return (
    <span
      className={`flex-none rounded-full px-2.5 py-1 text-[11px] font-extrabold whitespace-nowrap ${cls}`}
    >
      {label}
    </span>
  )
}

/** Bedrag van een aanvraag: aantal × prijs van het tickettype. */
function aanvraagBedrag(a: Ticketaanvraag): string {
  const bedrag = Number(a.prijs_srd) * Math.max(Number(a.aantal), 1)
  return `SRD ${bedrag.toLocaleString('nl-NL')}`
}

function relatieveTijd(datum: Date | string): string {
  const min = Math.round((Date.now() - new Date(datum).getTime()) / 60000)
  if (min < 1) return 'zojuist'
  if (min < 60) return `${min} min geleden`
  const uur = Math.round(min / 60)
  if (uur < 24) return `${uur} uur geleden`
  const dag = Math.round(uur / 24)
  return dag === 1 ? 'gisteren' : `${dag} dagen geleden`
}

const TABS = [
  { key: 'alles', label: 'Alles' },
  { key: 'nieuw', label: 'Wacht op betaling' },
  { key: 'betaald', label: 'Betaald' },
] as const

function TicketaanvragenSectie() {
  const { ticketaanvragen } = Route.useLoaderData()
  const router = useRouter()
  const [tab, setTab] = useState<(typeof TABS)[number]['key']>('alles')
  const [openId, setOpenId] = useState<string | null>(null)
  const [selectie, setSelectie] = useState<Array<string>>([])
  const [bulkOpen, setBulkOpen] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  const wacht = ticketaanvragen.filter((a) => a.status === 'nieuw')
  const betaald = ticketaanvragen.filter((a) => a.status === 'betaald')
  const afgerond = ticketaanvragen.filter((a) => a.status === 'afgehandeld')

  const lijst =
    tab === 'nieuw' ? wacht : tab === 'betaald' ? betaald : ticketaanvragen
  const detail = ticketaanvragen.find((a) => a.id === openId) ?? null

  function toggleSelectie(id: string) {
    setSelectie((s) =>
      s.includes(id) ? s.filter((x) => x !== id) : [...s, id],
    )
  }

  /** Bulkactie: elke aanvraag apart, zodat één fout de rest niet blokkeert. */
  async function bulkAfhandelen() {
    setFout(null)
    setBezig(true)
    const mislukt: Array<string> = []
    for (const id of selectie) {
      try {
        await betaalEnVerstuur({ data: id })
      } catch (err) {
        const naam = ticketaanvragen.find((a) => a.id === id)?.naam ?? id
        mislukt.push(
          `${naam}: ${err instanceof Error ? err.message : 'mislukt'}`,
        )
      }
    }
    setSelectie([])
    setBezig(false)
    if (mislukt.length > 0) setFout(mislukt.join(' · '))
    await router.invalidate()
  }

  return (
    <Kaart>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[16px] font-extrabold">
          Ticketaanvragen
          {wacht.length > 0 && (
            <span className="ml-2 rounded-full bg-[#FEF3C7] px-2.5 py-0.5 text-[11px] font-bold text-[#B45309]">
              {wacht.length} wacht op betaling
            </span>
          )}
        </h2>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-2.5">
        <Tegel
          waarde={wacht.length}
          label="Wacht op betaling"
          kleur="#F59E0B"
        />
        <Tegel
          waarde={betaald.length}
          label="Klaar om te sturen"
          kleur="#2563EB"
        />
        <Tegel waarde={afgerond.length} label="Afgerond" kleur="#16A34A" />
      </div>

      <div className="mb-3 flex gap-5 border-b border-[#E5E7EB]">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`-mb-px border-b-2 pb-2.5 text-[13.5px] font-extrabold ${
              tab === t.key
                ? 'border-[#2563EB] text-[#2563EB]'
                : 'border-transparent text-[#94A3B8] hover:text-[#64748B]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {fout && (
        <p className="mb-2 text-[13.5px] font-semibold text-[#DC2626]">
          {fout}
        </p>
      )}

      {ticketaanvragen.length === 0 ? (
        <p className="text-[13.5px] text-[#64748B]">
          Nog geen ticketaanvragen. Zodra iemand op de eventpagina een ticket
          aanvraagt, verschijnt hij hier.
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
          <div className="flex flex-col gap-2">
            {lijst.length === 0 ? (
              <p className="text-[13.5px] text-[#64748B]">
                Geen aanvragen in deze weergave.
              </p>
            ) : (
              lijst.map((a) => (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-[14px] border bg-white p-3.5 ${
                    a.id === openId
                      ? 'border-[#2563EB]'
                      : 'border-[#E5E7EB] hover:border-[#93C5FD]'
                  }`}
                >
                  {bulkOpen && (
                    <input
                      type="checkbox"
                      checked={selectie.includes(a.id)}
                      onChange={() => toggleSelectie(a.id)}
                      disabled={a.status !== 'nieuw' && a.status !== 'betaald'}
                      className="h-4 w-4 flex-none accent-[#2563EB]"
                      aria-label={`Selecteer ${a.naam}`}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => setOpenId(a.id === openId ? null : a.id)}
                    className="flex min-w-0 flex-1 flex-col gap-1 text-left"
                  >
                    <div className="flex items-start justify-between gap-2.5">
                      <div className="min-w-0">
                        <div className="truncate text-[14.5px] font-extrabold">
                          {a.naam}
                        </div>
                        <div className="truncate text-[12.5px] text-[#64748B]">
                          {a.aantal}× {a.type_naam}
                          {verkoopkanaalLabel(a.betaalmethode)
                            ? ` · ${verkoopkanaalLabel(a.betaalmethode)}`
                            : ''}
                        </div>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[12px] text-[#94A3B8]">
                        {relatieveTijd(a.aangemaakt_op)}
                      </span>
                      <span className="text-[13.5px] font-extrabold">
                        {aanvraagBedrag(a)}
                      </span>
                    </div>
                  </button>
                </div>
              ))
            )}

            {/* Bulk is bewust secundair: de hoofdinteractie is één aanvraag. */}
            {!bulkOpen ? (
              <button
                type="button"
                onClick={() => setBulkOpen(true)}
                className="mt-1 py-2 text-[13px] font-semibold text-[#64748B] hover:text-[#0F172A]"
              >
                Meerdere tegelijk afhandelen
              </button>
            ) : (
              <div className="mt-1 flex flex-wrap items-center gap-3 rounded-[12px] bg-[#F8FAFC] px-3.5 py-2.5">
                <span className="text-[13px] text-[#64748B]">
                  {selectie.length} geselecteerd
                </span>
                <PrimaryBtn
                  size="sm"
                  disabled={selectie.length === 0 || bezig}
                  onClick={bulkAfhandelen}
                >
                  {bezig ? 'Bezig…' : 'Betaald & ticket sturen'}
                </PrimaryBtn>
                <GhostBtn
                  onClick={() => {
                    setBulkOpen(false)
                    setSelectie([])
                  }}
                >
                  Klaar
                </GhostBtn>
              </div>
            )}
          </div>

          <div className="lg:border-l lg:border-[#E5E7EB] lg:pl-4">
            {detail ? (
              <AanvraagDetail
                key={detail.id}
                aanvraag={detail}
                onKlaar={() => router.invalidate()}
              />
            ) : (
              <p className="rounded-[14px] bg-[#F8FAFC] px-4 py-6 text-[13px] text-[#64748B]">
                Kies een aanvraag om hem af te handelen.
              </p>
            )}
          </div>
        </div>
      )}
    </Kaart>
  )
}

function Tegel({
  waarde,
  label,
  kleur,
}: {
  waarde: number
  label: string
  kleur: string
}) {
  return (
    <div className="rounded-[12px] border border-[#E5E7EB] bg-white px-3.5 py-3">
      <div
        className="text-[20px] leading-none font-extrabold"
        style={{ color: kleur }}
      >
        {waarde}
      </div>
      <div className="mt-1.5 text-[11.5px] font-bold text-[#64748B]">
        {label}
      </div>
    </div>
  )
}

/**
 * Detail van één aanvraag: contactgegevens, de statustijdlijn, en één primaire
 * actie die per status verandert. De leverknoppen verschijnen zodra er tickets
 * zijn — ze hangen aan de bestaande sendTicketMail / markDelivered.
 */
function AanvraagDetail({
  aanvraag,
  onKlaar,
}: {
  aanvraag: Ticketaanvraag
  onKlaar: () => void
}) {
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [tickets, setTickets] = useState<Array<LeverbaarTicket> | null>(null)

  const isAf =
    aanvraag.status === 'afgehandeld' ||
    aanvraag.status === 'geannuleerd' ||
    aanvraag.status === 'afgewezen' ||
    aanvraag.status === 'verlopen'

  // Vier vaste stappen; welke afgevinkt zijn volgt uit de status en het
  // betaalspoor, niet uit losse clientstate.
  const gedaan =
    aanvraag.status === 'afgehandeld'
      ? 3
      : aanvraag.status === 'betaald'
        ? 1
        : 0
  const stappen = [
    { label: 'Aangevraagd', tijd: aanvraag.aangemaakt_op },
    { label: 'Betaling ontvangen', tijd: aanvraag.betaald_op },
    { label: 'Ticket verzonden', tijd: aanvraag.afgehandeld_op },
    { label: 'Afgerond', tijd: aanvraag.afgehandeld_op },
  ]

  async function actie(fn: () => Promise<unknown>) {
    setFout(null)
    setBezig(true)
    try {
      await fn()
      onKlaar()
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Actie mislukt')
    } finally {
      setBezig(false)
    }
  }

  async function laadTickets() {
    setFout(null)
    try {
      setTickets(await ticketsVoorAanvraag({ data: aanvraag.id }))
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Tickets ophalen mislukt')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="text-[16px] font-extrabold">{aanvraag.naam}</div>
        <div className="text-[13px] text-[#64748B]">
          {aanvraag.aantal}× {aanvraag.type_naam}
        </div>
      </div>

      <div className="overflow-hidden rounded-[12px] border border-[#E5E7EB] text-[13px]">
        <Regel label="Telefoon" waarde={aanvraag.telefoon} mono />
        <Regel label="E-mail" waarde={aanvraag.email} />
        <Regel label="Bedrag" waarde={aanvraagBedrag(aanvraag)} vet laatste />
      </div>

      {aanvraag.opmerking && (
        <p className="rounded-[12px] bg-[#F8FAFC] px-3.5 py-2.5 text-[13px] text-[#475569]">
          “{aanvraag.opmerking}”
        </p>
      )}

      <div>
        <div className="mb-3 text-[13px] font-extrabold">Status</div>
        <div className="flex flex-col">
          {stappen.map((s, i) => (
            <div key={s.label} className="flex items-start gap-3">
              <div className="flex flex-none flex-col items-center self-stretch">
                {i <= gedaan ? (
                  <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#22C55E] text-[12px] font-extrabold text-white">
                    ✓
                  </span>
                ) : (
                  <span className="h-[22px] w-[22px] rounded-full border-2 border-[#E2E8F0] bg-white" />
                )}
                {i < stappen.length - 1 && (
                  <span className="min-h-[18px] w-0.5 flex-1 bg-[#E5E7EB]" />
                )}
              </div>
              <div className="pb-3.5">
                <div className="text-[13.5px] font-semibold">{s.label}</div>
                <div className="text-[12px] text-[#94A3B8]">
                  {i <= gedaan && s.tijd
                    ? relatieveTijd(s.tijd)
                    : i <= gedaan
                      ? 'zojuist'
                      : 'nog niet'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {aanvraag.status === 'nieuw' && (
        <p className="rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] px-3.5 py-3 text-[13px] leading-relaxed text-[#78350F]">
          {verkoopkanaalLabel(aanvraag.betaalmethode)
            ? `Deze bezoeker koos ${verkoopkanaalLabel(aanvraag.betaalmethode)}. `
            : ''}
          Zodra het geld binnen is, druk je op de knop hieronder — ticket en QR
          gaan er meteen uit.
        </p>
      )}

      {aanvraag.status === 'afgehandeld' && (
        <div>
          <div className="mb-1 text-[13px] font-extrabold">Stuur ticket</div>
          <div className="mb-2.5 text-[12.5px] text-[#64748B]">
            Zelfde QR-code, kies waar hij heen gaat.
          </div>
          {tickets === null ? (
            <GhostBtn onClick={laadTickets}>Tickets ophalen</GhostBtn>
          ) : tickets.length === 0 ? (
            <p className="text-[13px] text-[#64748B]">
              Geen tickets gevonden bij deze aanvraag. Zoek de koper op in de
              verkooplijst hieronder.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {tickets.map((t) => (
                <div
                  key={t.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] border border-[#E5E7EB] px-3.5 py-2.5"
                >
                  <span className="font-mono text-[12px] font-semibold tracking-wider">
                    {kortCode(t.code)}
                  </span>
                  <LeverKnoppen ticket={t} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {fout && (
        <p className="text-[13px] font-semibold text-[#DC2626]">{fout}</p>
      )}

      {!isAf && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            disabled={bezig}
            onClick={() => actie(() => betaalEnVerstuur({ data: aanvraag.id }))}
            className="w-full rounded-full bg-[#2563EB] py-3.5 text-[14.5px] font-extrabold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            {bezig
              ? 'Bezig…'
              : aanvraag.status === 'betaald'
                ? 'Ticket sturen'
                : 'Betaling ontvangen & ticket sturen'}
          </button>
          <div className="flex gap-2">
            {aanvraag.status === 'nieuw' && (
              <GhostBtn
                disabled={bezig}
                onClick={() =>
                  actie(() => markeerBetaald({ data: { id: aanvraag.id } }))
                }
              >
                Alleen betaling registreren
              </GhostBtn>
            )}
            <button
              type="button"
              disabled={bezig}
              onClick={() =>
                actie(() => annuleerTicketaanvraag({ data: aanvraag.id }))
              }
              className="flex-1 rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-[13px] font-semibold text-[#DC2626] hover:border-[#FCA5A5] disabled:opacity-50"
            >
              Annuleren
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Regel({
  label,
  waarde,
  mono,
  vet,
  laatste,
}: {
  label: string
  waarde: string | null
  mono?: boolean
  vet?: boolean
  laatste?: boolean
}) {
  return (
    <div
      className={`flex justify-between gap-3 px-3.5 py-2.5 ${
        laatste ? '' : 'border-b border-[#F1F5F9]'
      }`}
    >
      <span className="text-[#64748B]">{label}</span>
      <span
        className={`truncate ${mono ? 'font-mono text-[12.5px]' : ''} ${
          vet ? 'font-extrabold' : 'font-semibold'
        }`}
      >
        {waarde || '—'}
      </span>
    </div>
  )
}

function TicketTypesSectie() {
  const { event, types } = Route.useLoaderData()
  const router = useRouter()
  const [bewerkId, setBewerkId] = useState<string | null>(null)
  const [nieuw, setNieuw] = useState(false)

  return (
    <Kaart>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-[16px] font-extrabold">Tickettypes</h2>
        <GhostBtn
          onClick={() => {
            setNieuw((v) => !v)
            setBewerkId(null)
          }}
        >
          {nieuw ? 'Annuleren' : '+ Type toevoegen'}
        </GhostBtn>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[13.5px]">
          <thead>
            <tr className="text-left text-[#64748B]">
              <th className="rounded-l-[9px] bg-[#F8FAFC] px-4 py-2.5 font-bold">
                Naam
              </th>
              <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">
                Prijs (SRD)
              </th>
              <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">
                Inkoop (SRD)
              </th>
              <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">
                Verkocht / beschikbaar
              </th>
              <th className="rounded-r-[9px] bg-[#F8FAFC] px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) =>
              bewerkId === t.id ? (
                <tr key={t.id}>
                  <td colSpan={5} className="px-1 py-2">
                    <TypeForm
                      eventId={event.id}
                      initial={t}
                      onKlaar={() => {
                        setBewerkId(null)
                        router.invalidate()
                      }}
                    />
                  </td>
                </tr>
              ) : (
                <tr key={t.id} className="border-t border-[#E5E7EB]">
                  <td className="px-4 py-3 font-semibold">{t.naam}</td>
                  <td className="px-4 py-3 tabular-nums">{t.prijs_srd}</td>
                  <td className="px-4 py-3 tabular-nums">
                    {t.inkoopprijs_srd}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {t.aantal_verkocht} / {t.aantal_beschikbaar}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setBewerkId(t.id)
                        setNieuw(false)
                      }}
                      className="text-[13px] font-semibold text-[#2563EB] hover:underline"
                    >
                      bewerken
                    </button>
                  </td>
                </tr>
              ),
            )}
            {types.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-4 text-[#64748B]">
                  Nog geen tickettypes.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {nieuw && (
        <div className="mt-4 rounded-[14px] border border-[#E5E7EB] bg-[#F8FAFC] p-4">
          <TypeForm
            eventId={event.id}
            onKlaar={() => {
              setNieuw(false)
              router.invalidate()
            }}
          />
        </div>
      )}
    </Kaart>
  )
}

type TypeInitial = {
  id: string
  naam: string
  prijs_srd: string
  inkoopprijs_srd: string
  aantal_beschikbaar: string
  features: Array<string> | null
}

function TypeForm({
  eventId,
  initial,
  onKlaar,
}: {
  eventId: string
  initial?: TypeInitial
  onKlaar: () => void
}) {
  const [naam, setNaam] = useState(initial?.naam ?? '')
  const [prijs, setPrijs] = useState(initial?.prijs_srd ?? '')
  const [inkoop, setInkoop] = useState(initial?.inkoopprijs_srd ?? '')
  const [aantal, setAantal] = useState(initial?.aantal_beschikbaar ?? '')
  // Features: één per regel in de textarea.
  const [features, setFeatures] = useState((initial?.features ?? []).join('\n'))
  const [fout, setFout] = useState<string | null>(null)

  async function opslaan(e: React.FormEvent) {
    e.preventDefault()
    setFout(null)
    try {
      const payload = {
        event_id: eventId,
        naam,
        prijs_srd: prijs,
        inkoopprijs_srd: inkoop,
        aantal_beschikbaar: aantal,
        features: features.split('\n'),
      }
      if (initial) {
        await updateTicketType({ data: { ...payload, id: initial.id } })
      } else {
        await createTicketType({ data: payload })
      }
      onKlaar()
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Opslaan mislukt')
    }
  }

  return (
    <form onSubmit={opslaan} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
        <Veld label="Naam">
          <input
            required
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            className={inputSm}
          />
        </Veld>
        <Veld label="Prijs (SRD)">
          <input
            required
            value={prijs}
            onChange={(e) => setPrijs(e.target.value)}
            className={inputSm}
          />
        </Veld>
        <Veld label="Inkoop (SRD)">
          <input
            required
            value={inkoop}
            onChange={(e) => setInkoop(e.target.value)}
            className={inputSm}
          />
        </Veld>
        <Veld label="Beschikbaar">
          <input
            required
            value={aantal}
            onChange={(e) => setAantal(e.target.value)}
            className={inputSm}
          />
        </Veld>
      </div>
      <Veld label="Kenmerken (één per regel)">
        <textarea
          value={features}
          onChange={(e) => setFeatures(e.target.value)}
          rows={3}
          placeholder="Volledige toegang&#10;Toegang tot event-app"
          className={inputSm}
        />
      </Veld>
      {fout && (
        <p className="text-[14px] font-semibold text-[#DC2626]">{fout}</p>
      )}
      <PrimaryBtn type="submit" size="sm">
        Opslaan
      </PrimaryBtn>
    </form>
  )
}

type LeverbaarTicket = {
  id: string
  code: string
  koper_naam: string | null
  koper_telefoon: string | null
  koper_email: string | null
}

/**
 * Levering van één ticket: link naar de publieke ticketpagina, WhatsApp met
 * voorgevulde tekst, en mail via Brevo. Zelfde knoppen direct na uitgifte en in
 * de verkooplijst, zodat versturen nooit een omweg is.
 */
function LeverKnoppen({ ticket }: { ticket: LeverbaarTicket }) {
  const { event, baseUrl } = Route.useLoaderData()
  const router = useRouter()
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  const url = `${baseUrl}/t/${ticket.code}`
  const waLink = whatsappLink(
    ticket.koper_telefoon,
    ticketBericht({
      koperNaam: ticket.koper_naam,
      eventNaam: event.naam,
      datum: event.datum_start,
      locatie: event.locatie,
      ticketUrl: url,
    }),
  )

  async function viaWhatsapp() {
    if (!waLink) return
    // Eerst openen (binnen de klik, anders blokkeert de browser het venster),
    // daarna pas de levering vastleggen.
    window.open(waLink, '_blank', 'noopener')
    try {
      await markDelivered({ data: { ticketId: ticket.id, kanaal: 'whatsapp' } })
      router.invalidate()
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Markeren mislukt')
    }
  }

  async function viaMail() {
    setFout(null)
    setBezig(true)
    try {
      await sendTicketMail({ data: { ticketId: ticket.id } })
      router.invalidate()
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Mail versturen mislukt')
    } finally {
      setBezig(false)
    }
  }

  return (
    <span className="inline-flex items-center gap-3 whitespace-nowrap text-[13px] font-semibold">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-[#2563EB] hover:underline"
      >
        ticket
      </a>
      <button
        onClick={viaWhatsapp}
        disabled={!waLink}
        title={waLink ? undefined : 'Geen bruikbaar telefoonnummer'}
        className="text-[#16A34A] hover:underline disabled:text-[#94A3B8] disabled:no-underline"
      >
        whatsapp
      </button>
      <button
        onClick={viaMail}
        disabled={bezig || !ticket.koper_email}
        title={ticket.koper_email ? undefined : 'Geen e-mailadres'}
        className="text-[#2563EB] hover:underline disabled:text-[#94A3B8] disabled:no-underline"
      >
        {bezig ? 'bezig…' : 'mail'}
      </button>
      {fout && (
        <span className="text-[12px] font-normal text-[#DC2626]">{fout}</span>
      )}
    </span>
  )
}

function UitgifteSectie({
  eventId,
  types,
}: {
  eventId: string
  types: Array<{ id: string; naam: string }>
}) {
  const router = useRouter()
  const [typeId, setTypeId] = useState(types[0]?.id ?? '')
  const [naam, setNaam] = useState('')
  const [telefoon, setTelefoon] = useState('')
  const [email, setEmail] = useState('')
  const [kanaal, setKanaal] = useState<Verkoopkanaal>('contant')
  const [fout, setFout] = useState<string | null>(null)
  const [laatste, setLaatste] = useState<LeverbaarTicket | null>(null)
  const [bezig, setBezig] = useState(false)

  async function verkopen(e: React.FormEvent) {
    e.preventDefault()
    setFout(null)
    setLaatste(null)
    setBezig(true)
    try {
      const ticket = await issueTicket({
        data: {
          event_id: eventId,
          ticket_type_id: typeId,
          koper_naam: naam,
          koper_telefoon: telefoon || null,
          koper_email: email || null,
          verkoopkanaal: kanaal,
        },
      })
      setLaatste({
        id: ticket.id,
        code: ticket.code,
        koper_naam: ticket.koper_naam,
        koper_telefoon: ticket.koper_telefoon,
        koper_email: ticket.koper_email,
      })
      setNaam('')
      setTelefoon('')
      setEmail('')
      setKanaal('contant')
      router.invalidate()
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Uitgeven mislukt')
    } finally {
      setBezig(false)
    }
  }

  return (
    <Kaart>
      <h2 className="text-[16px] font-extrabold">Direct ticket verkopen</h2>
      <p className="mb-4 text-[13px] text-[#64748B]">
        Aan de deur, per telefoon of contant. Het ticket gaat er direct uit.
      </p>
      {types.length === 0 ? (
        <p className="text-[13.5px] text-[#64748B]">
          Maak eerst een tickettype aan.
        </p>
      ) : (
        <form onSubmit={verkopen} className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Veld label="Kopersnaam">
              <input
                required
                value={naam}
                onChange={(e) => setNaam(e.target.value)}
                className={inputCls}
              />
            </Veld>
            <Veld label="Tickettype">
              <select
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                className={inputCls}
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.naam}
                  </option>
                ))}
              </select>
            </Veld>
            <Veld label="Telefoon">
              <input
                value={telefoon}
                onChange={(e) => setTelefoon(e.target.value)}
                className={inputCls}
              />
            </Veld>
            <Veld label="E-mail">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCls}
              />
            </Veld>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-bold">Verkoopkanaal</span>
            <span className="text-[12.5px] text-[#64748B]">
              Voor je rapportage achteraf.
            </span>
            <ChipGroep
              opties={VERKOOPKANALEN.map((k) => ({
                waarde: k,
                label: VERKOOPKANAAL_LABEL[k],
              }))}
              waarde={kanaal}
              onKies={setKanaal}
            />
          </div>
          {fout && (
            <p className="text-[14px] font-semibold text-[#DC2626]">{fout}</p>
          )}
          {laatste && (
            <div className="flex flex-wrap items-center gap-3 rounded-[12px] bg-[#DCFCE7] px-3.5 py-2.5 text-[13.5px] text-[#166534]">
              <span>
                Ticket uitgegeven voor {laatste.koper_naam} (code{' '}
                <span className="font-mono font-semibold tracking-wider">
                  {kortCode(laatste.code)}
                </span>
                ). Versturen:
              </span>
              <LeverKnoppen ticket={laatste} />
            </div>
          )}
          <PrimaryBtn type="submit" disabled={bezig}>
            {bezig ? 'Bezig…' : 'Verkoop afronden & ticket sturen'}
          </PrimaryBtn>
        </form>
      )}
    </Kaart>
  )
}

const ticketStatus: Record<string, { cls: string; tekst: string }> = {
  geldig: { cls: 'bg-[#DCFCE7] text-[#16A34A]', tekst: 'Geldig' },
  gebruikt: { cls: 'bg-[#DBEAFE] text-[#2563EB]', tekst: 'Gebruikt' },
  ingetrokken: { cls: 'bg-[#FEE2E2] text-[#DC2626]', tekst: 'Ingetrokken' },
}

function VerkooplijstSectie() {
  // Lijst komt altijd rechtstreeks uit de loader-data, zodat nieuw uitgegeven of
  // ingetrokken tickets meteen kloppen na router.invalidate(). Zoeken filtert
  // lokaal — onder de 200 tickets is de hele lijst toch al in het geheugen.
  const { tickets } = Route.useLoaderData()
  const router = useRouter()
  const [zoek, setZoek] = useState('')

  const term = zoek.trim().toLowerCase()
  const lijst = term
    ? tickets.filter(
        (t) =>
          (t.koper_naam ?? '').toLowerCase().includes(term) ||
          (t.koper_telefoon ?? '').toLowerCase().includes(term) ||
          (t.koper_email ?? '').toLowerCase().includes(term),
      )
    : tickets

  async function intrekken(ticketId: string) {
    const reden = window.prompt('Reden voor intrekken?')
    if (reden === null) return
    await revokeTicket({ data: { ticketId, reden } })
    await router.invalidate()
  }

  return (
    <Kaart>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-[16px] font-extrabold">
          Verkooplijst ({lijst.length})
        </h2>
        <input
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Zoek op naam, telefoon, e-mail"
          className={`sm:w-72 ${inputSm}`}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
          <thead>
            <tr className="text-left text-[#64748B]">
              <th className="rounded-l-[9px] bg-[#F8FAFC] px-4 py-2.5 font-bold">
                Naam
              </th>
              <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">Type</th>
              <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">Code</th>
              <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">Contact</th>
              <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">Status</th>
              <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">Levering</th>
              <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">Versturen</th>
              <th className="rounded-r-[9px] bg-[#F8FAFC] px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {lijst.map((t) => {
              const st = t.ingetrokken_op
                ? 'ingetrokken'
                : t.gebruikt_op
                  ? 'gebruikt'
                  : 'geldig'
              const badge = ticketStatus[st]
              return (
                <tr key={t.id} className="border-t border-[#E5E7EB]">
                  <td className="px-4 py-3 font-semibold">{t.koper_naam}</td>
                  <td className="px-4 py-3">{t.type_naam}</td>
                  <td className="px-4 py-3 font-mono tracking-wider text-[#334155]">
                    {kortCode(t.code)}
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">
                    {t.koper_telefoon || t.koper_email || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-bold ${badge.cls}`}
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-current" />
                      {badge.tekst}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[#64748B]">
                    {t.geleverd_via ? (
                      <>
                        {t.geleverd_via}
                        {t.geleverd_op && (
                          <span className="block text-[11px] text-[#94A3B8]">
                            {new Date(t.geleverd_op).toLocaleString('nl-NL')}
                          </span>
                        )}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!t.ingetrokken_op && (
                      <LeverKnoppen
                        ticket={{
                          id: t.id,
                          code: t.code,
                          koper_naam: t.koper_naam,
                          koper_telefoon: t.koper_telefoon,
                          koper_email: t.koper_email,
                        }}
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {!t.ingetrokken_op && (
                      <button
                        onClick={() => intrekken(t.id)}
                        className="text-[13px] font-semibold text-[#DC2626] hover:underline"
                      >
                        intrekken
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
            {lijst.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-4 text-[#64748B]">
                  Geen tickets.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Kaart>
  )
}
