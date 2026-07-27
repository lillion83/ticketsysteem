import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { getEvent, updateEvent } from '#/server/events'
import { createTicketType, listTicketTypes, updateTicketType } from '#/server/ticketTypes'
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

type Categorie = (typeof eventCategories)[number]

// Admin bewerkt hier de INHOUD van elk event, cross-org (fase J): eventgegevens,
// tickettypes en sprekers/agenda/faq. Bewust géén tickets uitgeven/scannen/
// reserveringen namens anderen — dat blijft bij de organisator.
export const Route = createFileRoute('/platform/events/$eventId')({
  loader: async ({ params }) => {
    const [event, types, sprekers, agenda, faq] = await Promise.all([
      getEvent({ data: params.eventId }),
      listTicketTypes({ data: params.eventId }),
      listSprekers({ data: params.eventId }),
      listAgenda({ data: params.eventId }),
      listFaq({ data: params.eventId }),
    ])
    return { event, types, sprekers, agenda, faq }
  },
  component: PlatformEventBewerken,
})

function toLocalInput(iso: string | Date): string {
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

const inputCls =
  'w-full rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-2.5 text-[14px] outline-none focus:border-[#2563EB]'
const inputSm =
  'w-full rounded-[9px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2 text-[13.5px] outline-none focus:border-[#2563EB]'

function Kaart({ children }: { children: ReactNode }) {
  return <div className="rounded-2xl border border-[#E5E7EB] bg-white p-5 shadow-sm sm:p-6">{children}</div>
}
function Veld({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[13px] font-bold">{label}</span>
      {children}
    </label>
  )
}
function PrimaryBtn({ children, disabled, size }: { children: ReactNode; disabled?: boolean; size?: 'sm' }) {
  const pad = size === 'sm' ? 'px-4 py-2 text-[13px]' : 'px-5 py-2.5 text-[14px]'
  return (
    <button type="submit" disabled={disabled} className={`rounded-full bg-[#2563EB] font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-50 ${pad}`}>
      {children}
    </button>
  )
}
function VerwijderKnop({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-[13px] font-semibold text-[#DC2626] hover:underline">
      Verwijderen
    </button>
  )
}

function PlatformEventBewerken() {
  const { event } = Route.useLoaderData()
  return (
    <div className="flex flex-col gap-6">
      <div>
        <div className="mb-1 text-[13px] text-[#64748B]">
          <Link to="/platform/events" className="hover:text-[#0F172A]">
            Alle events
          </Link>{' '}
          / <span className="font-semibold text-[#0F172A]">{event.naam}</span>
        </div>
        <h1 className="text-[24px] font-extrabold tracking-tight">{event.naam} bewerken</h1>
        <p className="text-[13px] text-[#64748B]">Als admin bewerk je hier de inhoud van dit event</p>
      </div>
      <EventSectie />
      <TicketTypesSectie />
      <SprekersSectie />
      <AgendaSectie />
      <FaqSectie />
    </div>
  )
}

function EventSectie() {
  const { event } = Route.useLoaderData()
  const router = useRouter()
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
  const [ok, setOk] = useState(false)

  async function opslaan(e: React.FormEvent) {
    e.preventDefault()
    setFout(null)
    setOk(false)
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
      setOk(true)
      router.invalidate()
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Opslaan mislukt')
    }
  }

  return (
    <Kaart>
      <h2 className="mb-4 text-[16px] font-extrabold">Eventgegevens</h2>
      <form onSubmit={opslaan} className="grid gap-4">
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
        <div className="grid items-end gap-4 sm:grid-cols-2">
          <label className="flex items-center gap-2 text-[14px]">
            <input type="checkbox" checked={reEntry} onChange={(e) => setReEntry(e.target.checked)} className="h-4 w-4 accent-[#2563EB]" />
            Re-entry toegestaan
          </label>
          <Veld label="Status">
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
              <option value="concept">concept</option>
              <option value="actief">actief</option>
              <option value="afgelopen">afgelopen</option>
            </select>
          </Veld>
        </div>
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
          <textarea value={beschrijving} onChange={(e) => setBeschrijving(e.target.value)} rows={4} className={inputCls} />
        </Veld>
        <Veld label="Cover-afbeelding URL (publiek)">
          <input value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} placeholder="https://…" className={inputCls} />
        </Veld>
        {fout && <p className="text-[14px] font-semibold text-[#DC2626]">{fout}</p>}
        {ok && <p className="text-[14px] font-semibold text-[#16A34A]">Opgeslagen ✓</p>}
        <PrimaryBtn>Opslaan</PrimaryBtn>
      </form>
    </Kaart>
  )
}

type TypeRow = {
  id: string
  naam: string
  prijs_srd: string
  inkoopprijs_srd: string
  aantal_beschikbaar: string
  aantal_verkocht: string
  features: Array<string> | null
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
        <button
          type="button"
          onClick={() => {
            setNieuw((v) => !v)
            setBewerkId(null)
          }}
          className="rounded-full border border-[#E5E7EB] bg-white px-4 py-2 text-[13px] font-semibold text-[#0F172A] hover:border-[#CBD5E1]"
        >
          {nieuw ? 'Annuleren' : '+ Type toevoegen'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-[13.5px]">
          <thead>
            <tr className="text-left text-[#64748B]">
              <th className="rounded-l-[9px] bg-[#F8FAFC] px-4 py-2.5 font-bold">Naam</th>
              <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">Prijs (SRD)</th>
              <th className="bg-[#F8FAFC] px-4 py-2.5 font-bold">Verkocht / beschikbaar</th>
              <th className="rounded-r-[9px] bg-[#F8FAFC] px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {types.map((t) =>
              bewerkId === t.id ? (
                <tr key={t.id}>
                  <td colSpan={4} className="px-1 py-2">
                    <TypeForm eventId={event.id} initial={t} onKlaar={() => { setBewerkId(null); router.invalidate() }} />
                  </td>
                </tr>
              ) : (
                <tr key={t.id} className="border-t border-[#E5E7EB]">
                  <td className="px-4 py-3 font-semibold">{t.naam}</td>
                  <td className="px-4 py-3 tabular-nums">{t.prijs_srd}</td>
                  <td className="px-4 py-3 tabular-nums">{t.aantal_verkocht} / {t.aantal_beschikbaar}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => { setBewerkId(t.id); setNieuw(false) }} className="text-[13px] font-semibold text-[#2563EB] hover:underline">
                      bewerken
                    </button>
                  </td>
                </tr>
              ),
            )}
            {types.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-[#64748B]">Nog geen tickettypes.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {nieuw && (
        <div className="mt-4 rounded-[14px] border border-[#E5E7EB] bg-[#F8FAFC] p-4">
          <TypeForm eventId={event.id} onKlaar={() => { setNieuw(false); router.invalidate() }} />
        </div>
      )}
    </Kaart>
  )
}

function TypeForm({ eventId, initial, onKlaar }: { eventId: string; initial?: TypeRow; onKlaar: () => void }) {
  const [naam, setNaam] = useState(initial?.naam ?? '')
  const [prijs, setPrijs] = useState(initial?.prijs_srd ?? '')
  const [inkoop, setInkoop] = useState(initial?.inkoopprijs_srd ?? '')
  const [aantal, setAantal] = useState(initial?.aantal_beschikbaar ?? '')
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
      if (initial) await updateTicketType({ data: { ...payload, id: initial.id } })
      else await createTicketType({ data: payload })
      onKlaar()
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Opslaan mislukt')
    }
  }

  return (
    <form onSubmit={opslaan} className="flex flex-col gap-3">
      <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
        <Veld label="Naam"><input required value={naam} onChange={(e) => setNaam(e.target.value)} className={inputSm} /></Veld>
        <Veld label="Prijs (SRD)"><input required value={prijs} onChange={(e) => setPrijs(e.target.value)} className={inputSm} /></Veld>
        <Veld label="Inkoop (SRD)"><input required value={inkoop} onChange={(e) => setInkoop(e.target.value)} className={inputSm} /></Veld>
        <Veld label="Beschikbaar"><input required value={aantal} onChange={(e) => setAantal(e.target.value)} className={inputSm} /></Veld>
      </div>
      <Veld label="Kenmerken (één per regel)">
        <textarea value={features} onChange={(e) => setFeatures(e.target.value)} rows={3} className={inputSm} />
      </Veld>
      {fout && <p className="text-[14px] font-semibold text-[#DC2626]">{fout}</p>}
      <PrimaryBtn size="sm">Opslaan</PrimaryBtn>
    </form>
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
    setNaam(''); setRol(''); setAvatarUrl(''); router.invalidate()
  }

  return (
    <Kaart>
      <h2 className="mb-4 text-[16px] font-extrabold">Sprekers / Line-up (publiek)</h2>
      {sprekers.length === 0 && <p className="mb-3 text-[13.5px] text-[#64748B]">Nog niets toegevoegd.</p>}
      <div className="flex flex-col gap-2">
        {sprekers.map((s) => (
          <div key={s.id} className="flex items-center justify-between rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-2.5 text-[13.5px]">
            <span><strong>{s.naam}</strong>{s.rol ? ` · ${s.rol}` : ''}</span>
            <VerwijderKnop onClick={async () => { await deleteSpreker({ data: s.id }); router.invalidate() }} />
          </div>
        ))}
        <form onSubmit={toevoegen} className="mt-2 flex flex-wrap gap-2">
          <input required value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="Naam" className={`flex-1 ${inputSm}`} />
          <input value={rol} onChange={(e) => setRol(e.target.value)} placeholder="Rol (bv. DJ)" className={`flex-1 ${inputSm}`} />
          <input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="Avatar-URL" className={`flex-1 ${inputSm}`} />
          <PrimaryBtn size="sm">Toevoegen</PrimaryBtn>
        </form>
      </div>
    </Kaart>
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
    setTijd(''); setTitel(''); setSubtitel(''); setBeschrijving(''); router.invalidate()
  }

  return (
    <Kaart>
      <h2 className="mb-4 text-[16px] font-extrabold">Agenda (publiek)</h2>
      {agenda.length === 0 && <p className="mb-3 text-[13.5px] text-[#64748B]">Nog niets toegevoegd.</p>}
      <div className="flex flex-col gap-2">
        {agenda.map((a) => (
          <div key={a.id} className="flex items-center justify-between rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-2.5 text-[13.5px]">
            <span><strong>{a.tijd}</strong> · {a.titel}{a.subtitel ? ` — ${a.subtitel}` : ''}</span>
            <VerwijderKnop onClick={async () => { await deleteAgenda({ data: a.id }); router.invalidate() }} />
          </div>
        ))}
        <form onSubmit={toevoegen} className="mt-2 flex flex-wrap gap-2">
          <input required value={tijd} onChange={(e) => setTijd(e.target.value)} placeholder="Tijd" className={`w-28 ${inputSm}`} />
          <input required value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="Titel" className={`flex-1 ${inputSm}`} />
          <input value={subtitel} onChange={(e) => setSubtitel(e.target.value)} placeholder="Subtitel" className={`flex-1 ${inputSm}`} />
          <input value={beschrijving} onChange={(e) => setBeschrijving(e.target.value)} placeholder="Beschrijving" className={`w-full ${inputSm}`} />
          <PrimaryBtn size="sm">Toevoegen</PrimaryBtn>
        </form>
      </div>
    </Kaart>
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
    setVraag(''); setAntwoord(''); router.invalidate()
  }

  return (
    <Kaart>
      <h2 className="mb-4 text-[16px] font-extrabold">Veelgestelde vragen (publiek)</h2>
      {faq.length === 0 && <p className="mb-3 text-[13.5px] text-[#64748B]">Nog niets toegevoegd.</p>}
      <div className="flex flex-col gap-2">
        {faq.map((f) => (
          <div key={f.id} className="flex items-center justify-between rounded-[12px] border border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-2.5 text-[13.5px]">
            <span><strong>{f.vraag}</strong>{f.antwoord ? ` — ${f.antwoord}` : ''}</span>
            <VerwijderKnop onClick={async () => { await deleteFaq({ data: f.id }); router.invalidate() }} />
          </div>
        ))}
        <form onSubmit={toevoegen} className="mt-2 flex flex-wrap gap-2">
          <input required value={vraag} onChange={(e) => setVraag(e.target.value)} placeholder="Vraag" className={`flex-1 ${inputSm}`} />
          <input value={antwoord} onChange={(e) => setAntwoord(e.target.value)} placeholder="Antwoord" className={`flex-1 ${inputSm}`} />
          <PrimaryBtn size="sm">Toevoegen</PrimaryBtn>
        </form>
      </div>
    </Kaart>
  )
}
