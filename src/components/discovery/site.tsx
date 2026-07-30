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
// cover-afbeelding heeft. Neemt `cover` (url) als die er wel is.
const categoryColors: Record<string, [string, string]> = {
  Muziek: ['#FFF7ED', '#FFEDD5'],
  Tech: ['#EFF6FF', '#DBEAFE'],
  Business: ['#F0FDF4', '#DCFCE7'],
  'Art & Design': ['#FDF4FF', '#FAE8FF'],
  Health: ['#FEF2F2', '#FEE2E2'],
  Sports: ['#F0FDFA', '#CCFBF1'],
  'Food & Drink': ['#FFFBEB', '#FEF3C7'],
}

export function coverStyle(
  categorie: string | null,
  cover?: string | null,
): CSSProperties {
  if (cover)
    return {
      backgroundImage: `url(${cover})`,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    }
  const [a, b] = categoryColors[categorie ?? ''] ?? ['#F1F5F9', '#E2E8F0']
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
  cover?: string | null
  className?: string
  children?: ReactNode
}) {
  const [lightboxOpen, setLightboxOpen] = useState(false)

  return (
    <>
      <div className={className} style={coverStyle(categorie, cover)}>
        {children}
        {/* Organisatoren zetten prijzen, line-up en tijden ín de flyer, en een
            crop kan daar iets van afsnijden. Dus altijd een uitweg naar de hele
            flyer. Een <button> is vanzelf met het toetsenbord te bedienen; de
            knop ligt over de hele banner. */}
        {cover && (
          <button
            type="button"
            onClick={() => setLightboxOpen(true)}
            aria-label="Bekijk volledige flyer"
            className="absolute inset-0 flex cursor-pointer items-end justify-end"
          >
            <span
              aria-hidden
              className="absolute inset-x-0 bottom-0 h-1/3 bg-[linear-gradient(transparent,rgba(15,23,42,0.7))]"
            />
            <span className="relative m-4 inline-flex items-center gap-2 rounded-full bg-black/45 px-3.5 py-2 text-[13px] font-bold text-white">
              <ExpandIcon />
              Bekijk volledige flyer
            </span>
          </button>
        )}
      </div>

      {lightboxOpen && cover && <FlyerLightbox cover={cover} onClose={() => setLightboxOpen(false)} />}
    </>
  )
}

/**
 * De hele flyer, niets afgesneden. Zelfde opzet als ReserveerModal (overlay met
 * klik-buiten-sluit, role="dialog"), aangevuld met Escape en een focus trap —
 * er valt hier weinig te focussen, dus die mag niet naar de pagina eronder
 * weglopen.
 */
function FlyerLightbox({ cover, onClose }: { cover: string; onClose: () => void }) {
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
        <img src={cover} alt="Volledige flyer" className="max-h-full max-w-full object-contain" />
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

export function BellIcon({ stroke = '#fff' }: IconProps) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

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

export function UsersIcon({
  stroke = '#94A3B8',
  size = 13,
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
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

type NavKey = 'home' | 'events' | 'categories' | 'ticket'

const navLinks: Array<{ key: NavKey; label: string; to: string }> = [
  { key: 'home', label: 'Home', to: '/' },
  { key: 'events', label: 'Events', to: '/events' },
  { key: 'categories', label: 'Categories', to: '/events' },
  { key: 'ticket', label: 'Mijn Ticket', to: '/mijn-ticket' },
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
    <nav className="sticky top-0 z-20 flex items-center justify-between border-b border-[#E5E7EB] bg-white px-6 py-5 md:px-12">
      <Link to="/" className="text-[22px] font-extrabold text-[#0F172A]">
        Event.
      </Link>
      <div className="hidden gap-9 text-[15px] font-semibold md:flex">
        {navLinks.map((l) => (
          <Link
            key={l.key}
            to={l.to}
            className={
              active === l.key
                ? 'text-[#0F172A]'
                : 'text-[#334155] hover:text-[#0F172A]'
            }
          >
            {l.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-3.5">
        <CurrencyToggle />
        {/* Organisatoren/admins hebben al een organisatie: stuur ze naar hun
            dashboard i.p.v. de organiseer-onboarding. Kopers/uitgelogd houden de
            "Organiseer"-knop (/events/new leidt kopers zelf naar /word-organisator). */}
        {isOrganisator ? (
          <button
            onClick={() => navigate({ to: homePathForRole(user?.rol) })}
            className="hidden rounded-full bg-[#2563EB] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-[#1D4ED8] sm:inline-block"
          >
            Dashboard
          </button>
        ) : (
          <Link
            to="/events/new"
            className="hidden rounded-full bg-[#2563EB] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-[#1D4ED8] sm:inline-block"
          >
            + Organiseer een Event
          </Link>
        )}
        <div
          className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#0F172A]"
          title="Notificaties"
        >
          <BellIcon />
        </div>
        {user ? (
          <AccountMenu user={user} />
        ) : (
          <Link
            to="/mijn-ticket"
            className="rounded-full border border-[#E5E7EB] px-4 py-2 text-[14px] font-bold text-[#0F172A] hover:bg-[#F8FAFC]"
          >
            Inloggen
          </Link>
        )}
      </div>
    </nav>
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
    <div className="flex items-center rounded-full border border-[#E5E7EB] p-0.5 text-[12px] font-bold">
      {(['SRD', 'USD'] as const).map((c) => (
        <button
          key={c}
          onClick={() => setCurrency(c)}
          aria-pressed={currency === c}
          className={`rounded-full px-2.5 py-1 transition ${
            currency === c
              ? 'bg-[#2563EB] text-white'
              : 'text-[#64748B] hover:text-[#0F172A]'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────

const footerColumns: Array<{
  title: string
  links: Array<{ label: string; to?: string }>
}> = [
  {
    title: 'Platform',
    links: [
      { label: 'Events Bekijken', to: '/events' },
      { label: 'Event Aanmaken', to: '/events/new' },
      { label: 'Prijzen' },
      { label: 'App Downloaden' },
    ],
  },
  {
    title: 'Support',
    links: [
      { label: 'Helpcentrum' },
      { label: 'Voorwaarden' },
      { label: 'Privacybeleid' },
      { label: 'Contact' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Over Ons' },
      { label: 'Vacatures' },
      { label: 'Blog' },
      { label: 'Partners' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="bg-[#0F172A] px-6 pb-7 pt-14 text-[#94A3B8] md:px-12">
      <div className="mx-auto grid max-w-[1280px] gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="mb-3 text-[20px] font-extrabold text-white">
            Event.
          </div>
          <p className="max-w-[280px] text-[13px] leading-relaxed">
            Het toonaangevende platform voor het vinden en creëren van events.
            Verbind met community&apos;s en ontdek jouw passies.
          </p>
          <div className="mt-4.5 flex gap-2.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#1E293B]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#94A3B8">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                </svg>
              </div>
            ))}
          </div>
        </div>
        {footerColumns.map((col) => (
          <div key={col.title}>
            <div className="mb-4 text-[13px] font-bold text-white">
              {col.title}
            </div>
            <div className="flex flex-col gap-2.5 text-[13px]">
              {col.links.map((link) =>
                link.to ? (
                  <Link
                    key={link.label}
                    to={link.to}
                    className="text-[#94A3B8] hover:text-white"
                  >
                    {link.label}
                  </Link>
                ) : (
                  <a
                    key={link.label}
                    href="#"
                    className="text-[#94A3B8] hover:text-white"
                  >
                    {link.label}
                  </a>
                ),
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="mx-auto mt-9 max-w-[1280px] border-t border-[#1E293B] pt-6 text-center text-[12px]">
        © 2026 Event. Alle rechten voorbehouden.
      </div>
    </footer>
  )
}

// Paginawrapper met Manrope-lettertype en witte achtergrond.
export function SitePage({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-white font-['Manrope',sans-serif] text-[#0F172A] antialiased">
      {children}
    </div>
  )
}
