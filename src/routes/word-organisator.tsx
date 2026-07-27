import { createFileRoute, Link, redirect, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { SiteNav, SitePage } from '#/components/discovery/site'
import { wordOrganisator } from '#/server/organisatie'
import { getCurrentUser } from '#/server/session'

// Organisator-onboarding (fase H). Een ingelogde gebruiker zonder organisatie
// maakt hier zijn organisatie aan en wordt organisator. `redirect` bepaalt waar
// hij daarna heen gaat (bv. terug naar de organiseer-flow); standaard /admin.
export const Route = createFileRoute('/word-organisator')({
  validateSearch: (search: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const user = await getCurrentUser()
    if (!user) {
      throw redirect({ to: '/login', search: { redirect: '/word-organisator' } })
    }
    // Al organisator → geen onboarding nodig, door naar de admin.
    if (user.organizationId) {
      throw redirect({ to: search.redirect ?? '/admin' })
    }
  },
  component: WordOrganisator,
})

function WordOrganisator() {
  const navigate = useNavigate()
  const router = useRouter()
  const { redirect: redirectTo } = Route.useSearch()
  const [naam, setNaam] = useState('')
  const [contactpersoon, setContactpersoon] = useState('')
  const [telefoon, setTelefoon] = useState('')
  const [bezig, setBezig] = useState(false)
  const [fout, setFout] = useState<string | null>(null)

  async function verzenden(e: React.FormEvent) {
    e.preventDefault()
    setFout(null)
    if (!naam.trim()) {
      setFout('Organisatienaam is verplicht')
      return
    }
    setBezig(true)
    try {
      await wordOrganisator({
        data: {
          naam,
          contactpersoon: contactpersoon.trim() || null,
          telefoon: telefoon.trim() || null,
        },
      })
      // De router heeft /admin en /events/new al beoordeeld toen we nog geen
      // organisatie hadden. Zonder invalidate draait beforeLoad niet opnieuw en
      // stuurt de organisatiecheck ons alsnog terug.
      await router.invalidate()
      navigate({ to: redirectTo ?? '/admin' })
    } catch (err) {
      setFout(err instanceof Error ? err.message : 'Aanmaken mislukt')
    } finally {
      setBezig(false)
    }
  }

  return (
    <SitePage>
      <SiteNav />

      <div className="mx-auto max-w-[560px] px-6 pb-24 pt-8 md:px-12">
        <div className="mb-3.5 text-[13px] text-[#64748B]">
          <Link to="/" className="text-[#64748B] hover:text-[#0F172A]">
            Home
          </Link>{' '}
          / <span className="font-semibold text-[#0F172A]">Word Organisator</span>
        </div>
        <h1 className="mb-2 text-[32px] font-extrabold">Word Organisator</h1>
        <p className="mb-7 text-[15px] text-[#64748B]">
          Maak je organisatie aan om events te publiceren, tickets uit te geven en aan de deur te scannen.
        </p>

        <form onSubmit={verzenden} className="rounded-[18px] border border-[#E5E7EB] p-8">
          <div className="flex flex-col gap-5">
            <Field label="Organisatienaam">
              <TextInput value={naam} onChange={setNaam} placeholder="Bijv. Torarica Events" />
            </Field>
            <Field label="Contactpersoon">
              <TextInput value={contactpersoon} onChange={setContactpersoon} placeholder="Jouw naam" />
            </Field>
            <Field label="Telefoon">
              <TextInput value={telefoon} onChange={setTelefoon} placeholder="Bijv. +597 8..." />
            </Field>
          </div>

          {fout && <p className="mt-5 text-[14px] font-semibold text-[#EF4444]">{fout}</p>}

          <div className="mt-8 flex justify-end">
            <button
              type="submit"
              disabled={bezig}
              className="rounded-full bg-[#2563EB] px-7 py-3 text-[14.5px] font-bold text-white hover:bg-[#1D4ED8] disabled:opacity-50"
            >
              {bezig ? 'Bezig…' : 'Organisatie aanmaken'}
            </button>
          </div>
        </form>
      </div>
    </SitePage>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-[13px] font-bold">{label}</label>
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
