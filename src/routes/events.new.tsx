import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { SiteNav, SitePage, stripe } from '#/components/discovery/site'
import { CoverUpload, LEGE_COVER } from '#/components/cover-upload'
import type { Cover } from '#/components/cover-upload'
import { createFullEvent } from '#/server/events'
import type { FullEventInput } from '#/server/events'
import { getCurrentUser } from '#/server/session'

// Organiseer een Event — 3-staps flow (ontwerp: OrganiseerEvent.dc.html).
// Client-side formulierstate; "Publiceer Event" / "Opslaan als Concept"
// verzenden naar createFullEvent. Publiceren maakt een org-gescoopt event aan
// en vereist login: niet-ingelogde bezoekers gaan eerst naar /login en keren
// daarna hierheen terug.
export const Route = createFileRoute('/events/new')({
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login', search: { redirect: '/events/new' } })
    // Alleen organisatoren (met organisatie) mogen publiceren. Een ingelogde
    // koper zonder organisatie sturen we niet weg, maar door de organisator-
    // onboarding (fase H) en daarna terug hierheen.
    if (!user.organizationId) {
      throw redirect({ to: '/word-organisator', search: { redirect: '/events/new' } })
    }
  },
  component: OrganiseerEvent,
})

const categoryOptions = ['Muziek', 'Tech', 'Business', 'Food & Drink', 'Health', 'Art & Design', 'Sports']
const rolesByCategory: Record<string, Array<string>> = {
  Muziek: ['DJ', 'Band', 'Zanger', 'MC', 'Spreker'],
  Business: ['Spreker/Panel'],
}
const defaultRoles = ['DJ', 'Band', 'Zanger', 'MC', 'Spreker']
const stepLabels = ['Event Info', 'Tickets & Prijzen', 'Controleren & Publiceren']

type LineupEntry = { name: string; role: string }
type Tier = {
  id: number
  name: string
  desc: string
  priceSRD: number
  qty: number
  features: Array<string>
  earlyBird: boolean
  earlyBirdOriginalSRD: number
  earlyBirdOriginalUSD: number
}

function initials(name: string): string {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function OrganiseerEvent() {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)
  const [form, setForm] = useState({
    title: 'Global AI & Big Data Expo 2026',
    category: 'Muziek',
    description: 'Een avond vol live optredens, DJ-sets en visuele kunst.',
    dateStart: '2026-03-14',
    timeStart: '19:00',
    dateEnd: '2026-03-14',
    timeEnd: '23:30',
    location: 'Torarica Hotel, Paramaribo',
    organizer: 'Jouw Naam',
  })
  const [cover, setCover] = useState<Cover>(LEGE_COVER)
  const [lineupName, setLineupName] = useState('')
  const [lineupRole, setLineupRole] = useState('DJ')
  const [lineup, setLineup] = useState<Array<LineupEntry>>([
    { name: 'Elena Fisher', role: 'DJ' },
    { name: 'David Chen', role: 'Band' },
  ])
  const [tiers, setTiers] = useState<Array<Tier>>([
    {
      id: 1,
      name: 'General Admission',
      desc: 'Standaard toegang tot alle sessies',
      priceSRD: 500,
      qty: 200,
      features: ['Volledige 3-daagse toegang', 'Toegang tot event-app'],
      earlyBird: true,
      earlyBirdOriginalSRD: 750,
      earlyBirdOriginalUSD: 21,
    },
    {
      id: 2,
      name: 'VIP Access Pass',
      desc: "De ultieme ervaring met exclusieve extra's",
      priceSRD: 1500,
      qty: 50,
      features: ['Alles in General Admission', 'VIP Lounge toegang'],
      earlyBird: false,
      earlyBirdOriginalSRD: 1750,
      earlyBirdOriginalUSD: 49,
    },
  ])
  const [nextTierId, setNextTierId] = useState(3)

  const isMusic = form.category === 'Muziek'
  const roles = rolesByCategory[form.category] ?? defaultRoles
  const lineupSectionLabel = form.category === 'Business' ? 'Spreker/Panel' : 'Line-up'

  // Combineert een datum- en tijd-invoer tot een ISO-string in de lokale tijd
  // van de organisator (zelfde aanpak als het admin-formulier).
  function combineerISO(datum: string, tijd: string): string {
    return new Date(`${datum}T${tijd || '00:00'}`).toISOString()
  }

  async function verzenden(status: 'actief' | 'concept') {
    setFout(null)
    if (!form.title.trim()) {
      setFout('Titel is verplicht')
      setStep(1)
      return
    }
    if (!form.dateStart || !form.dateEnd) {
      setFout('Start- en einddatum zijn verplicht')
      setStep(1)
      return
    }
    const payload: FullEventInput = {
      naam: form.title,
      categorie: (categoryOptions.includes(form.category) ? form.category : null) as FullEventInput['categorie'],
      beschrijving: form.description || null,
      datum_start: combineerISO(form.dateStart, form.timeStart),
      datum_eind: combineerISO(form.dateEnd, form.timeEnd),
      locatie: form.location || null,
      cover_afbeelding_url: cover.url || null,
      cover_breedte: cover.breedte,
      cover_hoogte: cover.hoogte,
      cover_focus_x: cover.focusX,
      cover_focus_y: cover.focusY,
      status,
      tiers: tiers.map((t) => ({
        naam: t.name,
        prijs_srd: String(t.priceSRD),
        aantal_beschikbaar: String(t.qty),
        features: t.features,
      })),
      sprekers: lineup.map((l) => ({ naam: l.name, rol: l.role })),
    }
    setBezig(true)
    try {
      const res = await createFullEvent({ data: payload })
      // Gepubliceerd → naar de publieke detailpagina; concept → naar admin om
      // verder te bewerken (concepten zijn niet publiek zichtbaar).
      if (res.status === 'actief') {
        navigate({ to: '/events/$eventId', params: { eventId: res.id } })
      } else {
        navigate({ to: '/admin/events/$eventId', params: { eventId: res.id } })
      }
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Opslaan mislukt')
    } finally {
      setBezig(false)
    }
  }

  function updateField<TKey extends keyof typeof form>(field: TKey, value: (typeof form)[TKey]) {
    setForm((f) => ({ ...f, [field]: value }))
  }

  function addLineup() {
    const name = lineupName.trim()
    if (!name) return
    setLineup((l) => [...l, { name, role: lineupRole }])
    setLineupName('')
  }

  function updateTier<TKey extends keyof Tier>(id: number, field: TKey, value: Tier[TKey]) {
    setTiers((ts) => ts.map((t) => (t.id === id ? { ...t, [field]: value } : t)))
  }

  function addTier() {
    setTiers((ts) => [
      ...ts,
      {
        id: nextTierId,
        name: 'Nieuwe Tier',
        desc: '',
        priceSRD: 0,
        qty: 100,
        features: [],
        earlyBird: false,
        earlyBirdOriginalSRD: 0,
        earlyBirdOriginalUSD: 0,
      },
    ])
    setNextTierId((n) => n + 1)
  }

  return (
    <SitePage>
      <SiteNav />

      <div className="mx-auto max-w-[920px] px-6 pb-24 pt-8 md:px-12">
        <div className="mb-3.5 text-[13px] text-[#64748B]">
          <Link to="/" className="text-[#64748B] hover:text-[#0F172A]">
            Home
          </Link>{' '}
          / <span className="font-semibold text-[#0F172A]">Organiseer een Event</span>
        </div>
        <h1 className="mb-7 text-[32px] font-extrabold">Organiseer een Event</h1>

        {/* Stepper */}
        <div className="mb-11 flex items-center justify-center gap-4">
          {[1, 2, 3].map((n, i) => {
            const done = n < step
            const active = n === step
            return (
              <div key={n} className="flex items-center gap-4">
                <button onClick={() => setStep(n as 1 | 2 | 3)} className="flex items-center gap-2.5">
                  <span
                    className="flex h-[34px] w-[34px] items-center justify-center rounded-full text-[14px] font-extrabold"
                    style={{
                      background: done ? '#22C55E' : active ? '#2563EB' : '#F1F5F9',
                      color: done || active ? '#fff' : '#94A3B8',
                      border: active ? '2px solid #2563EB' : 'none',
                    }}
                  >
                    {done ? '✓' : n}
                  </span>
                  <span
                    className="hidden text-[14.5px] font-bold sm:inline"
                    style={{ color: done ? '#0F172A' : active ? '#2563EB' : '#94A3B8' }}
                  >
                    {stepLabels[i]}
                  </span>
                </button>
                {n < 3 && <div className="h-0.5 w-14" style={{ background: n < step ? '#22C55E' : '#E5E7EB' }} />}
              </div>
            )
          })}
        </div>

        {/* Stap 1 — Event Info */}
        {step === 1 && (
          <div className="rounded-[18px] border border-[#E5E7EB] p-8">
            <h2 className="mb-6 text-[20px] font-extrabold">Event Info</h2>
            <div className="flex flex-col gap-5">
              <Field label="Titel">
                <TextInput
                  value={form.title}
                  onChange={(v) => updateField('title', v)}
                  placeholder="Bijv. Global AI & Big Data Expo 2026"
                />
              </Field>
              <Field label="Categorie">
                <select
                  value={form.category}
                  onChange={(e) => updateField('category', e.target.value)}
                  className="w-full rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-3 text-[14px] text-[#0F172A]"
                >
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Beschrijving">
                <textarea
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  placeholder="Beschrijf je event..."
                  rows={4}
                  className="w-full resize-y rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-3 text-[14px] outline-none focus:border-[#2563EB]"
                />
              </Field>

              <Field label="Cover-afbeelding">
                <CoverUpload value={cover} onChange={setCover} groot />
              </Field>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Startdatum & Tijd">
                  <div className="flex gap-2.5">
                    <input
                      type="date"
                      value={form.dateStart}
                      onChange={(e) => updateField('dateStart', e.target.value)}
                      className="flex-1 rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-2.5 py-3 text-[13.5px]"
                    />
                    <input
                      type="time"
                      value={form.timeStart}
                      onChange={(e) => updateField('timeStart', e.target.value)}
                      className="w-[110px] rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-2.5 py-3 text-[13.5px]"
                    />
                  </div>
                </Field>
                <Field label="Einddatum & Tijd">
                  <div className="flex gap-2.5">
                    <input
                      type="date"
                      value={form.dateEnd}
                      onChange={(e) => updateField('dateEnd', e.target.value)}
                      className="flex-1 rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-2.5 py-3 text-[13.5px]"
                    />
                    <input
                      type="time"
                      value={form.timeEnd}
                      onChange={(e) => updateField('timeEnd', e.target.value)}
                      className="w-[110px] rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-2.5 py-3 text-[13.5px]"
                    />
                  </div>
                </Field>
              </div>

              <Field label="Locatie">
                <TextInput
                  value={form.location}
                  onChange={(v) => updateField('location', v)}
                  placeholder="Adres of venue naam"
                />
                <div className="relative mt-3 h-[100px] rounded-[12px]" style={stripe('#F0FDF4', '#DCFCE7')}>
                  <div className="absolute left-1/2 top-1/2 h-[22px] w-[22px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#2563EB] shadow-[0_2px_6px_rgba(0,0,0,0.3)]" />
                </div>
              </Field>

              {/* Line-up: prominent voor Muziek, anders inklapbaar */}
              {isMusic ? (
                <div className="rounded-[14px] border border-[#E5E7EB] bg-[#F8FAFC] p-5">
                  <div className="mb-3.5 text-[15px] font-extrabold">Artiesten / Line-up</div>
                  <LineupEditor
                    lineupName={lineupName}
                    setLineupName={setLineupName}
                    lineupRole={lineupRole}
                    setLineupRole={setLineupRole}
                    roles={roles}
                    onAdd={addLineup}
                    lineup={lineup}
                    onRemove={(idx) => setLineup((l) => l.filter((_, i) => i !== idx))}
                  />
                </div>
              ) : (
                <details className="rounded-[14px] border border-[#E5E7EB] bg-[#F8FAFC] p-4">
                  <summary className="cursor-pointer text-[14.5px] font-bold text-[#2563EB]">
                    + {lineupSectionLabel} toevoegen
                  </summary>
                  <div className="mt-4">
                    <LineupEditor
                      lineupName={lineupName}
                      setLineupName={setLineupName}
                      lineupRole={lineupRole}
                      setLineupRole={setLineupRole}
                      roles={roles}
                      onAdd={addLineup}
                      lineup={lineup}
                      onRemove={(idx) => setLineup((l) => l.filter((_, i) => i !== idx))}
                    />
                  </div>
                </details>
              )}

              <Field label="Organisatornaam">
                <TextInput value={form.organizer} onChange={(v) => updateField('organizer', v)} />
              </Field>
            </div>

            <div className="mt-8 flex justify-end">
              <PrimaryButton onClick={() => setStep(2)}>Volgende: Tickets & Prijzen →</PrimaryButton>
            </div>
          </div>
        )}

        {/* Stap 2 — Tickets & Prijzen */}
        {step === 2 && (
          <div className="rounded-[18px] border border-[#E5E7EB] p-8">
            <h2 className="mb-6 text-[20px] font-extrabold">Tickets & Prijzen</h2>
            <div className="flex flex-col gap-5">
              {tiers.map((t) => (
                <div key={t.id} className="relative rounded-[16px] border border-[#E5E7EB] p-[22px]">
                  <button
                    onClick={() => setTiers((ts) => ts.filter((x) => x.id !== t.id))}
                    className="absolute right-4 top-4 text-[13px] font-bold text-[#94A3B8] hover:text-[#EF4444]"
                  >
                    Verwijderen ✕
                  </button>
                  <div className="mb-4 grid gap-4 sm:grid-cols-[2fr_1fr]">
                    <SmallField label="Tiernaam">
                      <SmallInput value={t.name} onChange={(v) => updateTier(t.id, 'name', v)} />
                    </SmallField>
                    <SmallField label="Beschikbaar aantal">
                      <SmallInput
                        type="number"
                        value={String(t.qty)}
                        onChange={(v) => updateTier(t.id, 'qty', Number(v))}
                      />
                    </SmallField>
                  </div>
                  <div className="mb-4">
                    <SmallField label="Beschrijving">
                      <SmallInput value={t.desc} onChange={(v) => updateTier(t.id, 'desc', v)} />
                    </SmallField>
                  </div>
                  <div className="mb-4 grid gap-4 sm:grid-cols-2">
                    <SmallField label="Prijs SRD">
                      <SmallInput
                        type="number"
                        value={String(t.priceSRD)}
                        onChange={(v) => updateTier(t.id, 'priceSRD', Number(v))}
                      />
                    </SmallField>
                  </div>
                  <div className="mb-3.5">
                    <label className="mb-2 block text-[12.5px] font-bold">Features</label>
                    <div className="flex flex-col gap-2">
                      {t.features.map((f, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#2563EB"
                            strokeWidth="2.5"
                            className="flex-none"
                          >
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                          <input
                            value={f}
                            onChange={(e) =>
                              updateTier(
                                t.id,
                                'features',
                                t.features.map((x, i) => (i === idx ? e.target.value : x)),
                              )
                            }
                            className="flex-1 rounded-[8px] border border-[#E5E7EB] bg-[#F8FAFC] px-2.5 py-2 text-[13.5px] outline-none focus:border-[#2563EB]"
                          />
                          <button
                            onClick={() =>
                              updateTier(
                                t.id,
                                'features',
                                t.features.filter((_, i) => i !== idx),
                              )
                            }
                            className="text-[13px] text-[#94A3B8] hover:text-[#EF4444]"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => updateTier(t.id, 'features', [...t.features, ''])}
                      className="mt-2.5 text-[13px] font-bold text-[#2563EB] hover:text-[#1D4ED8]"
                    >
                      + Kenmerk toevoegen
                    </button>
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 text-[13.5px] font-semibold">
                    <input
                      type="checkbox"
                      checked={t.earlyBird}
                      onChange={() => updateTier(t.id, 'earlyBird', !t.earlyBird)}
                      className="h-4 w-4 accent-[#2563EB]"
                    />
                    Vroegboekkorting
                  </label>
                  {t.earlyBird && (
                    <div className="mt-2.5 text-[13px] text-[#64748B]">
                      Originele prijs (doorgestreept): <s>SRD {t.earlyBirdOriginalSRD}</s> /{' '}
                      <s>${t.earlyBirdOriginalUSD}</s>
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={addTier}
              className="mt-5 rounded-full border border-[#2563EB] bg-white px-[22px] py-3 text-[14px] font-bold text-[#2563EB] hover:bg-[#EFF6FF]"
            >
              + Ticket Tier Toevoegen
            </button>

            <div className="mt-8 flex justify-between">
              <SecondaryButton onClick={() => setStep(1)}>← Vorige</SecondaryButton>
              <PrimaryButton onClick={() => setStep(3)}>Volgende: Controleren →</PrimaryButton>
            </div>
          </div>
        )}

        {/* Stap 3 — Controleren & Publiceren */}
        {step === 3 && (
          <div>
            <div
              className="relative mb-6 h-[220px] overflow-hidden rounded-[18px]"
              style={
                cover.url
                  ? { backgroundImage: `url(${cover.url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : stripe('#1E293B', '#0F172A')
              }
            >
              <div className="absolute inset-0 bg-[linear-gradient(transparent_30%,rgba(0,0,0,0.75))]" />
              <div className="absolute bottom-5 left-6 text-white">
                <div className="mb-1.5 text-[24px] font-extrabold">{form.title || 'Naamloos Event'}</div>
                <div className="text-[13px] opacity-90">
                  {(form.dateStart || '—') + ' · ' + (form.timeStart || '—')} ·{' '}
                  {form.location || 'Locatie nog niet ingevuld'}
                </div>
              </div>
            </div>

            <div className="mb-5 rounded-[16px] border border-[#E5E7EB] p-[26px]">
              <h3 className="mb-3.5 text-[17px] font-extrabold">Samenvatting</h3>
              <dl className="grid grid-cols-[140px_1fr] gap-x-4 gap-y-2.5 text-[14px]">
                <dt className="text-[#64748B]">Categorie</dt>
                <dd className="m-0 font-semibold">{form.category}</dd>
                <dt className="text-[#64748B]">Beschrijving</dt>
                <dd className="m-0 font-semibold">{form.description || '—'}</dd>
                <dt className="text-[#64748B]">Locatie</dt>
                <dd className="m-0 font-semibold">{form.location || 'Locatie nog niet ingevuld'}</dd>
                <dt className="text-[#64748B]">Organisator</dt>
                <dd className="m-0 font-semibold">{form.organizer}</dd>
              </dl>
            </div>

            {lineup.length > 0 && (
              <div className="mb-5 rounded-[16px] border border-[#E5E7EB] p-[26px]">
                <h3 className="mb-4 text-[17px] font-extrabold">Line-up</h3>
                <div className="flex flex-wrap gap-3.5">
                  {lineup.map((l, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 rounded-full border border-[#E5E7EB] py-1.5 pl-1.5 pr-3.5"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F172A] text-[12px] font-extrabold text-white">
                        {initials(l.name)}
                      </div>
                      <span className="text-[13.5px] font-bold">{l.name}</span>
                      <span className="rounded-full bg-[#DBEAFE] px-2.5 py-[3px] text-[12px] font-bold text-[#2563EB]">
                        {l.role}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-8 rounded-[16px] border border-[#E5E7EB] p-[26px]">
              <h3 className="mb-4 text-[17px] font-extrabold">Tickets</h3>
              <div className="flex flex-col gap-3">
                {tiers.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between rounded-[12px] border border-[#E5E7EB] p-[14px_18px]"
                  >
                    <div>
                      <div className="text-[14.5px] font-extrabold">{t.name}</div>
                      <div className="text-[12.5px] text-[#64748B]">{t.qty} beschikbaar</div>
                    </div>
                    <div className="font-extrabold text-[#2563EB]">
                      SRD {t.priceSRD}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {fout && <p className="mb-4 text-[14px] font-semibold text-[#EF4444]">{fout}</p>}
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
              <SecondaryButton onClick={() => setStep(2)} disabled={bezig}>
                ← Vorige
              </SecondaryButton>
              <div className="flex gap-3">
                <SecondaryButton onClick={() => void verzenden('concept')} disabled={bezig}>
                  {bezig ? 'Bezig…' : 'Opslaan als Concept'}
                </SecondaryButton>
                <PrimaryButton onClick={() => void verzenden('actief')} disabled={bezig}>
                  {bezig ? 'Bezig…' : 'Publiceer Event'}
                </PrimaryButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </SitePage>
  )
}

// ── Herbruikbare veld-/knopcomponenten ──────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-bold">{label}</label>
      {children}
    </div>
  )
}

function SmallField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[12.5px] font-bold">{label}</label>
      {children}
    </div>
  )
}

function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-[10px] border border-[#E5E7EB] bg-[#F8FAFC] px-3.5 py-3 text-[14px] outline-none focus:border-[#2563EB]"
    />
  )
}

function SmallInput({
  value,
  onChange,
  type = 'text',
}: {
  value: string
  onChange: (v: string) => void
  type?: string
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-[9px] border border-[#E5E7EB] bg-[#F8FAFC] px-3 py-2.5 text-[14px] outline-none focus:border-[#2563EB]"
    />
  )
}

function PrimaryButton({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full bg-[#2563EB] px-7 py-3 text-[14.5px] font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function SecondaryButton({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="rounded-full border border-[#E5E7EB] bg-white px-6 py-3 text-[14.5px] font-bold text-[#0F172A] hover:border-[#CBD5E1] disabled:opacity-50"
    >
      {children}
    </button>
  )
}

function LineupEditor({
  lineupName,
  setLineupName,
  lineupRole,
  setLineupRole,
  roles,
  onAdd,
  lineup,
  onRemove,
}: {
  lineupName: string
  setLineupName: (v: string) => void
  lineupRole: string
  setLineupRole: (v: string) => void
  roles: Array<string>
  onAdd: () => void
  lineup: Array<LineupEntry>
  onRemove: (idx: number) => void
}) {
  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row">
        <input
          placeholder="Zoek artiest of typ naam + Enter"
          value={lineupName}
          onChange={(e) => setLineupName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              onAdd()
            }
          }}
          className="flex-1 rounded-[9px] border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#2563EB]"
        />
        <select
          value={lineupRole}
          onChange={(e) => setLineupRole(e.target.value)}
          className="rounded-[9px] border border-[#E5E7EB] bg-white px-3.5 py-2.5 text-[13.5px] text-[#0F172A]"
        >
          {roles.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button
          onClick={onAdd}
          className="whitespace-nowrap rounded-[9px] bg-[#2563EB] px-4.5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[#1D4ED8]"
        >
          + Toevoegen
        </button>
      </div>
      <div className="flex flex-wrap gap-2.5">
        {lineup.map((l, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-2 rounded-full border border-[#E5E7EB] bg-white px-3 py-1.5 text-[13px] font-semibold"
          >
            {l.name}
            <span className="rounded-full bg-[#DBEAFE] px-2 py-0.5 text-[11.5px] font-bold text-[#2563EB]">
              {l.role}
            </span>
            <button onClick={() => onRemove(i)} className="font-bold text-[#94A3B8] hover:text-[#EF4444]">
              ✕
            </button>
          </span>
        ))}
      </div>
    </>
  )
}
