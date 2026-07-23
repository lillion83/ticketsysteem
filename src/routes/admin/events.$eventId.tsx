import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getEvent, updateEvent } from '#/server/events'
import {
  createTicketType,
  listTicketTypes,
  updateTicketType,
} from '#/server/ticketTypes'
import { issueTicket, listTickets, revokeTicket } from '#/server/tickets'

export const Route = createFileRoute('/admin/events/$eventId')({
  loader: async ({ params }) => {
    const [event, types, tickets] = await Promise.all([
      getEvent({ data: params.eventId }),
      listTicketTypes({ data: params.eventId }),
      listTickets({ data: { eventId: params.eventId } }),
    ])
    return { event, types, tickets }
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
      <UitgifteSectie
        eventId={event.id}
        types={types.map((t) => ({ id: t.id, naam: t.naam }))}
      />
      <VerkooplijstSectie eventId={event.id} />
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
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
        >
          {open ? 'Annuleren' : 'Bewerken'}
        </button>
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
    <form onSubmit={opslaan} className="grid grid-cols-5 items-end gap-2">
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
        <span className="text-xs font-medium">Prijs</span>
        <input
          required
          value={prijs}
          onChange={(e) => setPrijs(e.target.value)}
          className="rounded border border-gray-300 px-2 py-1"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs font-medium">Inkoop</span>
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
      <button
        type="submit"
        className="rounded bg-black px-3 py-1 text-sm font-medium text-white"
      >
        Opslaan
      </button>
      {fout && <p className="col-span-5 text-sm text-red-600">{fout}</p>}
    </form>
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
  const [melding, setMelding] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  async function verkopen(e: React.FormEvent) {
    e.preventDefault()
    setFout(null)
    setMelding(null)
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
      setMelding(`Ticket uitgegeven voor ${ticket.koper_naam}.`)
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
        <p className="text-sm text-gray-500">
          Maak eerst een tickettype aan.
        </p>
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
          {melding && <p className="text-sm text-green-700">{melding}</p>}
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

type TicketRij = Awaited<ReturnType<typeof listTickets>>[number]

function VerkooplijstSectie({ eventId }: { eventId: string }) {
  const { tickets } = Route.useLoaderData()
  const [zoek, setZoek] = useState('')
  const [rijen, setRijen] = useState<TicketRij[] | null>(null)

  const lijst = rijen ?? tickets

  async function zoeken(e: React.FormEvent) {
    e.preventDefault()
    const resultaat = await listTickets({ data: { eventId, zoek } })
    setRijen(resultaat)
  }

  async function intrekken(ticketId: string) {
    const reden = window.prompt('Reden voor intrekken?')
    if (reden === null) return
    await revokeTicket({ data: { ticketId, reden } })
    const resultaat = await listTickets({ data: { eventId, zoek } })
    setRijen(resultaat)
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Verkooplijst ({lijst.length})
        </h2>
        <form onSubmit={zoeken} className="flex gap-2">
          <input
            value={zoek}
            onChange={(e) => setZoek(e.target.value)}
            placeholder="Zoek op naam, telefoon, e-mail"
            className="rounded border border-gray-300 px-3 py-1 text-sm"
          />
          <button
            type="submit"
            className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            Zoeken
          </button>
        </form>
      </div>

      <table className="w-full border border-gray-200 text-sm">
        <thead className="bg-gray-50 text-left">
          <tr>
            <th className="px-3 py-2">Naam</th>
            <th className="px-3 py-2">Type</th>
            <th className="px-3 py-2">Contact</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {lijst.map((t) => (
            <tr key={t.id} className="border-t border-gray-200">
              <td className="px-3 py-2">{t.koper_naam}</td>
              <td className="px-3 py-2">{t.type_naam}</td>
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
              <td colSpan={5} className="px-3 py-3 text-gray-500">
                Geen tickets.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}
