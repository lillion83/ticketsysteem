import type { CSSProperties, ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import {
  Link,
  useLoaderData,
  useNavigate,
  useRouter,
} from '@tanstack/react-router'
import { signOut } from '#/lib/auth-client'
import { ROL_LABEL, homePathForRole } from '#/lib/rol'
import type { Rol } from '#/lib/rol'
import { setCurrency, useCurrency } from './currency'
import { categoryStyle } from './data'

// Publieke discovery-front-end (homepage, events, detail, organiseren).
// Los van het admin/scanner-deel: geen login, geen organization-scope — dit is
// de etalage. Data is voorlopig demo-data uit `data.ts`; wire aan echte server
// functions zodra het publieke datamodel is afgesproken (staat niet in PLAN).

// Diagonale streep-placeholder die in de ontwerpen de event-foto's vervangt.
export function stripe(a: string, b: string): CSSProperties {
  return {
    backgroundImage: `repeating-linear-gradient(45deg,${a},${a} 10px,${b} 10px,${b} 20px)`,
  }
}

// Placeholder-achtergrond per categorie, gebruikt zolang een event geen echte
// cover-afbeelding heeft. Neemt `cover` (url) als die er wel is. De tint komt uit
// `categoryStyles`, zodat de tegel en de placeholder dezelfde kleurfamilie delen
// en er maar één plek is waar categoriekleuren staan.
const NEUTRAAL: [string, string] = ['#F1F5F9', '#E2E8F0']

function stripeKleuren(categorie: string | null): [string, string] {
  const stijl = categoryStyle(categorie)
  // Lichte variant boven de tint: dat geeft de streep contrast zonder te schreeuwen.
  return stijl ? ['#FBFCFE', stijl.tint] : NEUTRAAL
}

// `cover` is bewust verplicht en niet optioneel. Hem vergeten levert een kaart met
// de categorie-placeholder op, en dat ziet er niet uit als een fout maar als een
// event zonder flyer — zo verdwenen de covers ongemerkt van de homepage. Heeft een
// event echt geen afbeelding, geef dan expliciet `null` mee.
export function coverStyle(
  categorie: string | null,
  cover: string | null,
): CSSProperties {
  if (cover)
    return {
      backgroundImage: `url(${cover})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  const [a, b] = stripeKleuren(categorie)
  return stripe(a, b)
}

/**
 * Uitvergrote, vervaagde versie van de afbeelding als achtergrond, zodat er
 * naast een niet-passende flyer geen kale marges staan. Het opschalen houdt de
 * vervaagde randen buiten beeld. Puur decor, dus aria-hidden.
 */
function BlurAchtergrond({ cover }: { cover: string }) {
  return (
    <div
      aria-hidden
      className="absolute inset-0 scale-125 bg-cover bg-center blur-2xl brightness-[.55]"
      style={{ backgroundImage: `url(${cover})` }}
    />
  )
}

/**
 * De banner boven een event: de cover bijgesneden vanuit het midden, met de
 * hele flyer een klik verderop in een lightbox. Hoe de flyer in de banner valt
 * doet daarom niet zo veel — wie alles wil lezen opent hem groot.
 *
 * `children` (verlooplaag, titel) ligt bovenop; de aanroeper bepaalt de hoogte.
 */
export function EventBanner({
  categorie,
  cover,
  className = '',
  children,
}: {
  categorie: string | null
  // Verplicht, om dezelfde reden als bij `coverStyle` hierboven.
  cover: string | null
  className?: string
  children?: ReactNode
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false)

  return (
    <>
      <div className={className} style={coverStyle(categorie, cover)}>
        {/* De flyer gedimd, zodat de CTA en de titel eroverheen knallen. Alleen
            bij een echte cover: de categorie-placeholder is een lichte pastel
            streep en die wordt hier alleen maar vies van. Staat vóór `children`,
            dus de titel en de datum liggen erbovenop. */}
        {cover && <span aria-hidden className="absolute inset-0 bg-black/45" />}
        {children}
        {/* Organisatoren zetten prijzen, line-up en tijden ín de flyer, en een
            crop kan daar iets van afsnijden. Dus altijd een uitweg naar de hele
            flyer. Een <button> is vanzelf met het toetsenbord te bedienen; de
            knop ligt over de hele banner, met de CTA in het midden — daar valt
            hij op en laat hij de titel linksonder vrij.

            Geen eigen verlooplaag hier: deze knop staat ná `children` in de DOM
            en zou er dus bovenop liggen, over de titel en de datum heen. Toen de
            CTA nog rechtsonder stond maakte dat verloop hem leesbaar; in het
            midden doet het niets meer behalve de titel verduisteren. De pil
            leunt op zijn eigen achtergrond en `backdrop-blur`. */}
        {cover && (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label="Bekijk volledige flyer"
            className="group absolute inset-0 flex cursor-pointer items-center justify-center"
          >
            {/* Zelfde vorm en kleur als de primaire knoppen in de nav: vol
                dekkend, dus knalhelder op de gedimde flyer. */}
            <span className="inline-flex animate-flyer-cta items-center gap-2 rounded-full bg-[#2563EB] px-5 py-2.5 text-[14px] font-bold text-white transition-colors group-hover:bg-[#1D4ED8] motion-reduce:animate-none">
              <ExpandIcon />
              Bekijk volledige flyer
            </span>
          </button>
        )}
      </div>

      {lightboxOpen && cover && (
        <FlyerLightbox cover={cover} onClose={() => setLightboxOpen(false)} />
      )}
    </>
  )
}

/**
 * De hele flyer, niets afgesneden. Zelfde opzet als ReserveerModal (overlay met
 * klik-buiten-sluit, role="dialog"), aangevuld met Escape en een focus trap —
 * er valt hier weinig te focussen, dus die mag niet naar de pagina eronder
 * weglopen.
 */
function FlyerLightbox({
  cover,
  onClose,
}: {
  cover: string
  onClose: () => void
}) {
  const dialoog = useRef<HTMLDivElement>(null)
  const sluitKnop = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Focus naar de sluitknop, en terug naar waar hij vandaan kwam bij sluiten.
    const vorige = document.activeElement as HTMLElement | null
    sluitKnop.current?.focus()

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const focusbaar = dialoog.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusbaar || focusbaar.length === 0) return
      const eerste = focusbaar[0]
      const laatste = focusbaar[focusbaar.length - 1]
      if (e.shiftKey && document.activeElement === eerste) {
        e.preventDefault()
        laatste.focus()
      } else if (!e.shiftKey && document.activeElement === laatste) {
        e.preventDefault()
        eerste.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      vorige?.focus()
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/80 p-4"
      onClick={onClose}
      role="presentation"
    >
      <BlurAchtergrond cover={cover} />
      <div
        ref={dialoog}
        className="relative flex h-full w-full max-w-[1100px] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Volledige flyer"
      >
        <img
          src={cover}
          alt="Volledige flyer"
          className="max-h-full max-w-full object-contain"
        />
        <button
          ref={sluitKnop}
          type="button"
          onClick={onClose}
          aria-label="Sluiten"
          className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-[18px] font-bold text-white hover:bg-black/75"
        >
          ✕
        </button>
      </div>
    </div>
  )
}

// ── Iconen (outline-stijl, zoals het ontwerp; geen icon-library) ────────────

type IconProps = { className?: string; stroke?: string }

export function ExpandIcon({
  stroke = '#fff',
  size = 15,
}: IconProps & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2.2"
      strokeLinecap="round"
    >
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  )
}

export function PinIcon({
  stroke = '#94A3B8',
  size = 14,
}: IconProps & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
    >
      <path d="M12 21s-7-6.4-7-11a7 7 0 0 1 14 0c0 4.6-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

export function HeartIcon({
  stroke = '#0F172A',
  size = 16,
}: IconProps & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  )
}

export function CheckIcon({
  stroke = '#22C55E',
  size = 16,
}: IconProps & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function SearchIcon({
  stroke = '#fff',
  size = 15,
}: IconProps & { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2.5"
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

// ── Navigatie ───────────────────────────────────────────────────────────────

type NavKey = 'home' | 'events' | 'weekend' | 'ticket' | 'organiseren'

// De labels komen uit het ontwerp (Ontdek / Categorieën / Dit weekend /
// Organiseren), maar het ontwerp is één losse pagina met ankers en wij hebben
// echte routes. Twee bewuste afwijkingen:
//
// - "Categorieën" is eruit: dat anker scrolde naar het categorieblok op de
//   homepage, en bij ons zou het naar dezelfde /events wijzen als "Ontdek".
// - "Mijn Ticket" is erbij gebleven. Het staat niet in het ontwerp, maar het is
//   de enige ingang voor een koper die zijn ticket zoekt zonder in te loggen.
const navLinks: Array<{
  key: NavKey
  label: string
  to: string
  search?: Record<string, unknown>
}> = [
  { key: 'events', label: 'Ontdek', to: '/events' },
  {
    key: 'weekend',
    label: 'Dit weekend',
    to: '/events',
    search: { date: 'Dit weekend' },
  },
  { key: 'ticket', label: 'Mijn Ticket', to: '/mijn-ticket' },
  { key: 'organiseren', label: 'Organiseren', to: '/events/new' },
]

// Twee letters uit het e-mailadres als avatar-fallback (vgl. admin/route.tsx).
function initials(email: string): string {
  return email.split('@')[0].slice(0, 2).toUpperCase()
}

export function SiteNav({ active }: { active?: NavKey }) {
  const { user } = useLoaderData({ from: '__root__' })
  const navigate = useNavigate()
  const isOrganisator = Boolean(user?.organizationId)

  return (
    <header className="sticky top-0 z-20 border-b border-[#E9ECF2] bg-white/[0.98] backdrop-blur">
      <nav className="mx-auto flex max-w-[1240px] items-center gap-7 px-6 py-3.5">
        <Link
          to="/"
          className="text-[21px] font-extrabold tracking-[-0.02em] text-[#0B1220]"
        >
          Event<span className="text-[#1D4ED8]">.</span>
        </Link>
        <div className="ml-2 hidden items-center gap-1 md:flex">
          {navLinks.map((l) => (
            <Link
              key={l.key}
              to={l.to}
              search={l.search}
              className={`rounded-[9px] px-3 py-2.5 text-[14.5px] font-semibold hover:bg-[#F3F5F9] hover:text-[#0B1220] ${
                active === l.key ? 'text-[#0B1220]' : 'text-[#48515F]'
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2.5">
          <CurrencyToggle />
          {/* Organisatoren/admins hebben al een organisatie: stuur ze naar hun
              dashboard i.p.v. de organiseer-onboarding. Kopers/uitgelogd houden de
              "Event plaatsen"-knop (/events/new leidt kopers zelf naar
              /word-organisator). */}
          {isOrganisator ? (
            <button
              onClick={() => navigate({ to: homePathForRole(user?.rol) })}
              className="hidden min-h-[44px] items-center rounded-[11px] bg-[#1D4ED8] px-[18px] text-[14.5px] font-bold text-white shadow-[0_1px_2px_rgba(11,18,32,0.12)] hover:bg-[#1737A8] sm:inline-flex"
            >
              Dashboard
            </button>
          ) : (
            <Link
              to="/events/new"
              className="hidden min-h-[44px] items-center rounded-[11px] bg-[#1D4ED8] px-[18px] text-[14.5px] font-bold text-white shadow-[0_1px_2px_rgba(11,18,32,0.12)] hover:bg-[#1737A8] sm:inline-flex"
            >
              Event plaatsen
            </Link>
          )}
          {user ? (
            <AccountMenu user={user} />
          ) : (
            <Link
              to="/mijn-ticket"
              className="flex min-h-[44px] items-center rounded-[11px] px-3.5 text-[14.5px] font-semibold text-[#0B1220] hover:bg-[#F3F5F9]"
            >
              Inloggen
            </Link>
          )}
        </div>
      </nav>
    </header>
  )
}

// Account-menu rechtsboven: vervangt het vroegere dode profiel-icoon. Toont wie
// je bent + rol, snelkoppelingen en uitloggen. Sluit bij klik buiten het menu.
function AccountMenu({
  user,
}: {
  user: { email: string; rol: string; organizationId: string | null }
}) {
  const router = useRouter()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  async function uitloggen() {
    setOpen(false)
    await signOut()
    router.invalidate()
  }

  const rol = user.rol as Rol
  const isOrganisator = Boolean(user.organizationId)

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        title="Account"
        className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#7C3AED] text-[13px] font-bold text-white"
      >
        {initials(user.email)}
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[46px] z-30 w-60 overflow-hidden rounded-[14px] border border-[#E5E7EB] bg-white shadow-lg"
        >
          <div className="border-b border-[#F1F5F9] px-4 py-3">
            <div className="truncate text-[13px] font-bold text-[#0F172A]">
              {user.email}
            </div>
            <span className="mt-1 inline-block rounded-full bg-[#EFF6FF] px-2 py-0.5 text-[11px] font-bold text-[#2563EB]">
              {ROL_LABEL[rol]}
            </span>
          </div>
          <div className="flex flex-col py-1.5 text-[14px] font-semibold text-[#334155]">
            <Link
              to="/mijn-ticket"
              onClick={() => setOpen(false)}
              className="px-4 py-2 hover:bg-[#F8FAFC]"
            >
              Mijn Tickets
            </Link>
            <Link
              to="/profiel"
              onClick={() => setOpen(false)}
              className="px-4 py-2 hover:bg-[#F8FAFC]"
            >
              Profiel
            </Link>
            {isOrganisator && (
              <button
                onClick={() => {
                  setOpen(false)
                  navigate({ to: homePathForRole(user.rol) })
                }}
                className="px-4 py-2 text-left hover:bg-[#F8FAFC]"
              >
                Dashboard
              </button>
            )}
            <button
              onClick={uitloggen}
              className="px-4 py-2 text-left text-[#DC2626] hover:bg-[#FEF2F2]"
            >
              Uitloggen
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// SRD/USD-schakelaar in de header. SRD is de opgeslagen valuta; USD is een
// weergave-omrekening (zie ./currency).
function CurrencyToggle() {
  const currency = useCurrency()
  return (
    <div className="flex gap-0.5 rounded-[10px] bg-[#F3F5F9] p-[3px] text-[13px] font-bold">
      {(['SRD', 'USD'] as const).map((c) => (
        <button
          key={c}
          onClick={() => setCurrency(c)}
          aria-pressed={currency === c}
          className={`min-h-[34px] rounded-lg px-3 transition ${
            currency === c
              ? 'bg-white text-[#0B1220] shadow-[0_1px_2px_rgba(11,18,32,0.12)]'
              : 'text-[#5A6472] hover:text-[#0B1220]'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────

// Kolommen uit het ontwerp. `to` is optioneel: een link zonder route is nog niet
// gebouwd en blijft een dode `#`-link, zoals hij dat hiervoor ook was. Beter dat
// dan een label weglaten en de kolom half leeg achterlaten.
const footerColumns: Array<{
  title: string
  links: Array<{ label: string; to?: string; search?: Record<string, unknown> }>
}> = [
  {
    title: 'Ontdekken',
    links: [
      { label: 'Alle evenementen', to: '/events' },
      { label: 'Dit weekend', to: '/events', search: { date: 'Dit weekend' } },
      {
        label: 'Gratis evenementen',
        to: '/events',
        search: { prijsType: 'gratis' },
      },
      { label: 'Mijn ticket', to: '/mijn-ticket' },
    ],
  },
  {
    title: 'Organisatoren',
    links: [
      { label: 'Event plaatsen', to: '/events/new' },
      { label: 'Organisator worden', to: '/word-organisator' },
      { label: 'Scan-app' },
      { label: 'Helpcentrum' },
    ],
  },
  {
    title: 'Bedrijf',
    links: [
      { label: 'Over ons' },
      { label: 'Contact' },
      { label: 'Voorwaarden' },
      { label: 'Privacybeleid' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="bg-[#0B1220] text-[#B9C2D2]">
      <div className="mx-auto grid max-w-[1240px] grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-9 px-6 pb-7 pt-14">
        <div className="col-span-2 min-w-[220px]">
          <div className="text-[21px] font-extrabold text-white">
            Event<span className="text-[#5B84F5]">.</span>
          </div>
          <p className="mt-3 max-w-[34ch] text-[14px] leading-[1.65]">
            Het platform voor evenementen in Suriname. Ontdek wat er speelt,
            regel je ticket en organiseer je eigen event.
          </p>
        </div>
        {footerColumns.map((col) => (
          <div key={col.title}>
            <div className="text-[13px] font-bold text-white">{col.title}</div>
            <div className="mt-3.5 flex flex-col gap-0.5 text-[14px]">
              {col.links.map((link) =>
                link.to ? (
                  <Link
                    key={link.label}
                    to={link.to}
                    search={link.search}
                    className="py-[7px] text-[#B9C2D2] hover:text-white"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.label}
                    href="#"
                    className="py-[7px] text-[#B9C2D2] hover:text-white"
                  >
                    {link.label}
                  </a>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-4 border-t border-[#1D2637] px-6 pb-10 pt-5 text-[13px] text-[#8A93A3]">
        <span>© 2026 Event. Alle rechten voorbehouden.</span>
        <span>Paramaribo, Suriname · Prijzen in SRD en USD</span>
      </div>
    </footer>
  )
}

// Paginawrapper met het lettertype uit het ontwerp en een witte achtergrond.
export function SitePage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white font-['Plus_Jakarta_Sans',system-ui,sans-serif] text-[#0B1220] antialiased">
      {children}
    </div>
  )
}
