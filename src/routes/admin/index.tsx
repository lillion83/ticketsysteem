import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { createEvent, listEvents } from '#/server/events'

export const Route = createFileRoute('/admin/')({
  loader: () => listEvents(),
  component: EventsOverzicht,
})

function EventsOverzicht() {
  const events = Route.useLoaderData()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [naam, setNaam] = useState('')
  const [start, setStart] = useState('')
  const [eind, setEind] = useState('')
  const [locatie, setLocatie] = useState('')
  const [reEntry, setReEntry] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  async function opslaan(e: React.FormEvent) {
    e.preventDefault()
    setFout(null)
    setBezig(true)
    try {
      await createEvent({
        data: {
          naam,
          datum_start: new Date(start).toISOString(),
          datum_eind: new Date(eind).toISOString(),
          locatie: locatie || null,
          re_entry_toegestaan: reEntry,
          status: 'concept',
        },
      })
      setOpen(false)
      setNaam('')
      setStart('')
      setEind('')
      setLocatie('')
      setReEntry(false)
      router.invalidate()
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Opslaan mislukt')
    } finally {
      setBezig(false)
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Evenementen</h1>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded bg-black px-4 py-2 text-sm font-medium text-white"
        >
          {open ? 'Annuleren' : 'Nieuw event'}
        </button>
      </div>

      {open && (
        <form
          onSubmit={opslaan}
          className="mb-6 grid gap-3 rounded border border-gray-200 p-4"
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
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={reEntry}
              onChange={(e) => setReEntry(e.target.checked)}
            />
            <span className="text-sm">Re-entry toegestaan</span>
          </label>
          {fout && <p className="text-sm text-red-600">{fout}</p>}
          <button
            type="submit"
            disabled={bezig}
            className="justify-self-start rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {bezig ? 'Bezig…' : 'Opslaan'}
          </button>
        </form>
      )}

      {events.length === 0 ? (
        <p className="text-gray-500">Nog geen evenementen.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded border border-gray-200">
          {events.map((event) => (
            <li key={event.id}>
              <Link
                to="/admin/events/$eventId"
                params={{ eventId: event.id }}
                className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
              >
                <div>
                  <div className="font-medium">{event.naam}</div>
                  <div className="text-sm text-gray-500">
                    {new Date(event.datum_start).toLocaleString('nl-NL')}
                    {event.locatie ? ` · ${event.locatie}` : ''}
                  </div>
                </div>
                <span className="text-sm text-gray-400">{event.status}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
