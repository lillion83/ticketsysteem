import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
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
import { eventCategories } from '#/components/discovery/data'
import { ticketBericht, whatsappLink } from '#/lib/whatsapp'
import { kortCode } from '#/lib/scanResult'

type Categorie = (typeof eventCategories)[number]

export const Route = createFileRoute('/admin/events/$eventId')({
  loader: async ({ params }) => {
    const [event, types, tickets, baseUrl, sprekers, agenda, faq] = await Promise.all([
      getEvent({ data: params.eventId }),
      listTicketTypes({ data: params.eventId }),
      listTickets({ data: { eventId: params.eventId } }),
      getPublicBaseUrl(),
      listSprekers({ data: params.eventId }),
      listAgenda({ data: params.eventId }),
      listFaq({ data: params.eventId }),
    ])
    return { event, types, tickets, baseUrl, sprekers, agenda, faq }
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

function EventDetail() {
  const { event, types } = Route.useLoaderData()

  return (
    <div className="flex flex-col gap-8">
      <EventSectie />
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
  const [categorie, setCategorie] = useState<Categorie | ''>(event.categorie ?? '')
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{event.naam}</h1>
          <p className="text-sm text-gray-500">
            {new Date(event.datum_start).toLocaleString('nl-NL')}
            {event.locatie ? ` · ${event.locatie}` : ''} · {event.status}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/admin/events/$eventId/deur"
            params={{ eventId: event.id }}
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            Deur &amp; rapportage
          </Link>
          <Link
            to="/scan/$eventId"
            params={{ eventId: event.id }}
            className="rounded bg-black px-3 py-1 text-sm font-medium text-white"
          >
            Scannen
          </Link>
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            {open ? 'Annuleren' : 'Bewerken'}
          </button>
        </div>
      </div>

      {open && (
        <form
          onSubmit={opslaan}
          className="mt-4 grid gap-3 rounded border border-gray-200 p-4"
        >
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Naam</span>
            <input
              required
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Start</span>
              <input
                type="datetime-local"
                required
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Eind</span>
              <input
                type="datetime-local"
                required
                value={eind}
                onChange={(e) => setEind(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2"
              />
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Locatie</span>
            <input
              value={locatie}
              onChange={(e) => setLocatie(e.target.value)}
              className="rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={reEntry}
                onChange={(e) => setReEntry(e.target.checked)}
              />
              <span className="text-sm">Re-entry toegestaan</span>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Status</span>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2"
              >
                <option value="concept">concept</option>
                <option value="actief">actief</option>
                <option value="afgelopen">afgelopen</option>
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Categorie (publiek)</span>
            <select
              value={categorie}
              onChange={(e) => setCategorie(e.target.value as Categorie | '')}
              className="rounded border border-gray-300 px-3 py-2"
            >
              <option value="">— geen —</option>
              {eventCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Beschrijving (publiek)</span>
            <textarea
              value={beschrijving}
              onChange={(e) => setBeschrijving(e.target.value)}
              rows={4}
              className="rounded border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium">Cover-afbeelding URL (publiek)</span>
            <input
              value={coverUrl}
              onChange={(e) => setCoverUrl(e.target.value)}
              placeholder="https://…"
              className="rounded border border-gray-300 px-3 py-2"
            />
          </label>
          {fout && <p className="text-sm text-red-600">{fout}</p>}
          <button
            type="submit"
            className="justify-self-start rounded bg-black px-4 py-2 text-sm font-medium text-white"
          >
            Opslaan
          </button>
        </form>
      )}
    </section>
  )
}

// Generieke opmaak voor een beheersectie met een lijst + verwijderknoppen.
function ContentSectie({
  titel,
  leeg,
  children,
}: {
  titel: string
  leeg: boolean
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">{titel}</h2>
      {leeg && <p className="mb-3 text-sm text-gray-500">Nog niets toegevoegd.</p>}
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  )
}

function VerwijderKnop({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="text-sm text-red-600 hover:underline" type="button">
      Verwijderen
    </button>
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
    await createSpreker({ data: { event_id: event.id, naam, rol, avatar_url: avatarUrl } })
    setNaam('')
    setRol('')
    setAvatarUrl('')
    router.invalidate()
  }

  return (
    <ContentSectie titel="Sprekers / Line-up (publiek)" leeg={sprekers.length === 0}>
      {sprekers.map((s) => (
        <div key={s.id} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2">
          <span className="text-sm">
            <strong>{s.naam}</strong>
            {s.rol ? ` · ${s.rol}` : ''}
          </span>
          <VerwijderKnop
            onClick={async () => {
              await deleteSpreker({ data: s.id })
              router.invalidate()
            }}
          />
        </div>
      ))}
      <form onSubmit={toevoegen} className="mt-2 flex flex-wrap gap-2">
        <input
          required
          value={naam}
          onChange={(e) => setNaam(e.target.value)}
          placeholder="Naam"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          value={rol}
          onChange={(e) => setRol(e.target.value)}
          placeholder="Rol (bv. DJ)"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="Avatar-URL"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-black px-4 py-2 text-sm font-medium text-white">
          Toevoegen
        </button>
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
    await createAgenda({ data: { event_id: event.id, tijd, titel, subtitel, beschrijving } })
    setTijd('')
    setTitel('')
    setSubtitel('')
    setBeschrijving('')
    router.invalidate()
  }

  return (
    <ContentSectie titel="Agenda (publiek)" leeg={agenda.length === 0}>
      {agenda.map((a) => (
        <div key={a.id} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2">
          <span className="text-sm">
            <strong>{a.tijd}</strong> · {a.titel}
            {a.subtitel ? ` — ${a.subtitel}` : ''}
          </span>
          <VerwijderKnop
            onClick={async () => {
              await deleteAgenda({ data: a.id })
              router.invalidate()
            }}
          />
        </div>
      ))}
      <form onSubmit={toevoegen} className="mt-2 flex flex-wrap gap-2">
        <input
          required
          value={tijd}
          onChange={(e) => setTijd(e.target.value)}
          placeholder="Tijd (bv. 09.00)"
          className="w-28 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          required
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          placeholder="Titel"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          value={subtitel}
          onChange={(e) => setSubtitel(e.target.value)}
          placeholder="Subtitel"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          value={beschrijving}
          onChange={(e) => setBeschrijving(e.target.value)}
          placeholder="Beschrijving"
          className="w-full rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-black px-4 py-2 text-sm font-medium text-white">
          Toevoegen
        </button>
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
    <ContentSectie titel="Veelgestelde vragen (publiek)" leeg={faq.length === 0}>
      {faq.map((f) => (
        <div key={f.id} className="flex items-center justify-between rounded border border-gray-200 px-3 py-2">
          <span className="text-sm">
            <strong>{f.vraag}</strong>
            {f.antwoord ? ` — ${f.antwoord}` : ''}
          </span>
          <VerwijderKnop
            onClick={async () => {
              await deleteFaq({ data: f.id })
              router.invalidate()
            }}
          />
        </div>
      ))}
      <form onSubmit={toevoegen} className="mt-2 flex flex-wrap gap-2">
        <input
          required
          value={vraag}
          onChange={(e) => setVraag(e.target.value)}
          placeholder="Vraag"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          value={antwoord}
          onChange={(e) => setAntwoord(e.target.value)}
          placeholder="Antwoord"
          className="flex-1 rounded border border-gray-300 px-3 py-2 text-sm"
        />
        <button type="submit" className="rounded bg-black px-4 py-2 text-sm font-medium text-white">
          Toevoegen
        </button>
      </form>
    </ContentSectie>
  )
}

function TicketTypesSectie() {
  const { event, types } = Route.useLoaderData()
  const router = useRouter()
  const [bewerkId, setBewerkId] = useState<string | null>(null)
  const [nieuw, setNieuw] = useState(false)

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Tickettypes</h2>
        <button
          onClick={() => {
            setNieuw((v) => !v)
            setBewerkId(null)
          }}
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
        >
          {nieuw ? 'Annuleren' : 'Type toevoegen'}
        </button>
      </div>

      <table className="w-full border border-gray-200 text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Naam</th>
            <th className="px-3 py-2">Prijs (SRD)</th>
            <th className="px-3 py-2">Inkoop (SRD)</th>
            <th className="px-3 py-2">Verkocht / beschikbaar</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {types.map((t) =>
            bewerkId === t.id ? (
              <tr key={t.id}>
                <td colSpan={5} className="px-3 py-2">
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
              <tr key={t.id} className="border-t border-gray-200">
                <td className="px-3 py-2">{t.naam}</td>
                <td className="px-3 py-2">{t.prijs_srd}</td>
                <td className="px-3 py-2">{t.inkoopprijs_srd}</td>
                <td className="px-3 py-2">
                  {t.aantal_verkocht} / {t.aantal_beschikbaar}
                </td>
                <td className="px-3 py-2 text-right">
                  <button
                    onClick={() => {
                      setBewerkId(t.id)
                      setNieuw(false)
                    }}
                    className="text-blue-600 hover:underline"
                  >
                    bewerken
                  </button>
                </td>
              </tr>
            ),
          )}
          {types.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-3 text-gray-500">
                Nog geen tickettypes.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {nieuw && (
        <div className="mt-3 rounded border border-gray-200 p-4">
          <TypeForm
            eventId={event.id}
            onKlaar={() => {
              setNieuw(false)
              router.invalidate()
            }}
          />
        </div>
      )}
    </section>
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
    <form onSubmit={opslaan} className="flex flex-col gap-2">
      <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Naam</span>
          <input
            required
            value={naam}
            onChange={(e) => setNaam(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Prijs (SRD)</span>
          <input
            required
            value={prijs}
            onChange={(e) => setPrijs(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Inkoop (SRD)</span>
          <input
            required
            value={inkoop}
            onChange={(e) => setInkoop(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium">Beschikbaar</span>
          <input
            required
            value={aantal}
            onChange={(e) => setAantal(e.target.value)}
            className="rounded border border-gray-300 px-2 py-1"
          />
        </label>
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">Kenmerken (één per regel)</span>
        <textarea
          value={features}
          onChange={(e) => setFeatures(e.target.value)}
          rows={3}
          placeholder="Volledige toegang&#10;Toegang tot event-app"
          className="rounded border border-gray-300 px-2 py-1"
        />
      </label>
      {fout && <p className="text-sm text-red-600">{fout}</p>}
      <button type="submit" className="justify-self-start self-start rounded bg-black px-3 py-1 text-sm font-medium text-white">
        Opslaan
      </button>
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
    <span className="inline-flex items-center gap-3 whitespace-nowrap">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-blue-600 hover:underline"
      >
        ticket
      </a>
      <button
        onClick={viaWhatsapp}
        disabled={!waLink}
        title={waLink ? undefined : 'Geen bruikbaar telefoonnummer'}
        className="text-green-700 hover:underline disabled:text-gray-400 disabled:no-underline"
      >
        whatsapp
      </button>
      <button
        onClick={viaMail}
        disabled={bezig || !ticket.koper_email}
        title={ticket.koper_email ? undefined : 'Geen e-mailadres'}
        className="text-blue-600 hover:underline disabled:text-gray-400 disabled:no-underline"
      >
        {bezig ? 'bezig…' : 'mail'}
      </button>
      {fout && <span className="text-xs text-red-600">{fout}</span>}
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
  const [kanaal, setKanaal] = useState('')
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
          verkoopkanaal: kanaal || null,
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
      setKanaal('')
      router.invalidate()
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Uitgeven mislukt')
    } finally {
      setBezig(false)
    }
  }

  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Ticket uitgeven</h2>
      {types.length === 0 ? (
        <p className="text-sm text-gray-500">Maak eerst een tickettype aan.</p>
      ) : (
        <form
          onSubmit={verkopen}
          className="grid gap-3 rounded border border-gray-200 p-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Kopersnaam</span>
              <input
                required
                value={naam}
                onChange={(e) => setNaam(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Tickettype</span>
              <select
                value={typeId}
                onChange={(e) => setTypeId(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2"
              >
                {types.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.naam}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Telefoon</span>
              <input
                value={telefoon}
                onChange={(e) => setTelefoon(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">E-mail</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded border border-gray-300 px-3 py-2"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">Verkoopkanaal</span>
              <input
                value={kanaal}
                onChange={(e) => setKanaal(e.target.value)}
                placeholder="whatsapp, contant, …"
                className="rounded border border-gray-300 px-3 py-2"
              />
            </label>
          </div>
          {fout && <p className="text-sm text-red-600">{fout}</p>}
          {laatste && (
            <div className="flex flex-wrap items-center gap-3 rounded bg-green-50 px-3 py-2 text-sm text-green-800">
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
          <button
            type="submit"
            disabled={bezig}
            className="justify-self-start rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {bezig ? 'Bezig…' : 'Verkocht'}
          </button>
        </form>
      )}
    </section>
  )
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
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Verkooplijst ({lijst.length})</h2>
        <input
          value={zoek}
          onChange={(e) => setZoek(e.target.value)}
          placeholder="Zoek op naam, telefoon, e-mail"
          className="rounded border border-gray-300 px-3 py-1 text-sm"
        />
      </div>

      <table className="w-full border border-gray-200 text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Naam</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Code</th>
            <th className="px-3 py-2">Contact</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2">Levering</th>
            <th className="px-3 py-2"></th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {lijst.map((t) => (
            <tr key={t.id} className="border-t border-gray-200">
              <td className="px-3 py-2">{t.koper_naam}</td>
              <td className="px-3 py-2">{t.type_naam}</td>
              <td className="px-3 py-2 font-mono tracking-wider text-gray-700">
                {kortCode(t.code)}
              </td>
              <td className="px-3 py-2 text-gray-600">
                {t.koper_telefoon || t.koper_email || '—'}
              </td>
              <td className="px-3 py-2">
                {t.ingetrokken_op ? (
                  <span className="text-red-600">ingetrokken</span>
                ) : t.gebruikt_op ? (
                  <span className="text-gray-500">gebruikt</span>
                ) : (
                  <span className="text-green-700">geldig</span>
                )}
              </td>
              <td className="px-3 py-2 text-gray-600">
                {t.geleverd_via ? (
                  <>
                    {t.geleverd_via}
                    {t.geleverd_op && (
                      <span className="block text-xs text-gray-400">
                        {new Date(t.geleverd_op).toLocaleString('nl-NL')}
                      </span>
                    )}
                  </>
                ) : (
                  '—'
                )}
              </td>
              <td className="px-3 py-2">
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
              <td className="px-3 py-2 text-right">
                {!t.ingetrokken_op && (
                  <button
                    onClick={() => intrekken(t.id)}
                    className="text-red-600 hover:underline"
                  >
                    intrekken
                  </button>
                )}
              </td>
            </tr>
          ))}
          {lijst.length === 0 && (
            <tr>
              <td colSpan={8} className="px-3 py-3 text-gray-500">
                Geen tickets.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}
