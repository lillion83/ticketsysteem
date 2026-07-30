import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { createEvent, listEvents } from '#/server/events'
import { eventCategories } from '#/components/discovery/data'
import { CoverUpload } from '#/components/cover-upload'

type Categorie = (typeof eventCategories)[number]

export const Route = createFileRoute('/admin/events/')({
  loader: () => listEvents(),
  component: EventsOverzicht,
})

const statusStijl: Record<string, string> = {
  actief: 'bg-[#DCFCE7] text-[#16A34A]',
  concept: 'bg-[#F1F5F9] text-[#64748B]',
  afgelopen: 'bg-[#FEF3C7] text-[#B45309]',
}

function EventsOverzicht() {
  const events = Route.useLoaderData()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [naam, setNaam] = useState('')
  const [start, setStart] = useState('')
  const [eind, setEind] = useState('')
  const [locatie, setLocatie] = useState('')
  const [reEntry, setReEntry] = useState(false)
  const [categorie, setCategorie] = useState<Categorie | ''>('')
  const [beschrijving, setBeschrijving] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
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
          categorie: categorie || null,
          beschrijving: beschrijving || null,
          cover_afbeelding_url: coverUrl || null,
        },
      })
      setOpen(false)
      setNaam('')
      setStart('')
      setEind('')
      setLocatie('')
      setReEntry(false)
      setCategorie('')
      setBeschrijving('')
      setCoverUrl('')
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
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight">Events</h1>
          <p className="text-[13px] text-[#64748B]">Beheer je evenementen en tickettypes</p>
        </div>
        <button
          onClick={() => setOpen((v) => !v)}
          className="rounded-full bg-[#2563EB] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-[#1D4ED8]"
        >
          {open ? 'Annuleren' : '+ Nieuw event'}
        </button>
      </div>

      {open && (
        <form onSubmit={opslaan} className="mb-6 grid gap-4 rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <Veld label="Naam">
            <input required value={naam} onChange={(e) => setNaam(e.target.value)} className={inputCls} />
          </Veld>
          <div className="grid gap-4 sm:grid-cols-2">
            <Veld label="Start">
              <input type="datetime-local" required value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
            </Veld>
            <Veld label="Eind">
              <input type="datetime-local" required value={eind} onChange={(e) => setEind(e.target.value)} className={inputCls} />
            </Veld>
          </div>
          <Veld label="Locatie">
            <input value={locatie} onChange={(e) => setLocatie(e.target.value)} className={inputCls} />
          </Veld>
          <Veld label="Categorie (publiek)">
            <select value={categorie} onChange={(e) => setCategorie(e.target.value as Categorie | '')} className={inputCls}>
              <option value="">— geen —</option>
              {eventCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Veld>
          <Veld label="Beschrijving (publiek)">
            <textarea value={beschrijving} onChange={(e) => setBeschrijving(e.target.value)} rows={3} className={inputCls} />
          </Veld>
          <Veld label="Cover-afbeelding (publiek)">
            <CoverUpload value={coverUrl} onChange={setCoverUrl} />
          </Veld>
          <label className="flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={reEntry} onChange={(e) => setReEntry(e.target.checked)} className="h-4 w-4 accent-[#2563EB]" />
            Re-entry toegestaan
          </label>
          {fout && <p className="text-[14px] font-semibold text-[#DC2626]">{fout}</p>}
          <button
            type="submit"
            disabled={bezig}
            className="justify-self-start rounded-full bg-[#2563EB] px-6 py-2.5 text-[14px] font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
          >
            {bezig ? 'Bezig…' : 'Opslaan'}
          </button>
        </form>
      )}

      {events.length === 0 ? (
        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-10 text-center text-[#64748B] shadow-sm">
          Nog geen evenementen. Maak je eerste event aan.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white shadow-sm">
          {events.map((event, i) => (
            <Link
              key={event.id}
              to="/admin/events/$eventId"
              params={{ eventId: event.id }}
              className={`flex items-center justify-between px-5 py-4 hover:bg-[#F8FAFC] ${i > 0 ? 'border-t border-[#E5E7EB]' : ''}`}
            >
              <div>
                <div className="text-[15px] font-bold">{event.naam}</div>
                <div className="text-[13px] text-[#64748B]">
                  {new Date(event.datum_start).toLocaleString('nl-NL')}
                  {event.locatie ? ` · ${event.locatie}` : ''}
                </div>
              </div>
              <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${statusStijl[event.status] ?? statusStijl.concept}`}>
                {event.status}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

const inputCls =
  'w-full rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-2.5 text-[14px] outline-none focus:border-[#2563EB]'

function Veld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold">{label}</span>
      {children}
    </label>
  )
}
