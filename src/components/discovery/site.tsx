import type { CSSProperties, ReactNode } from 'react'
import { Link } from '@tanstack/react-router'

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

// ── Iconen (outline-stijl, zoals het ontwerp; geen icon-library) ────────────

type IconProps = { className?: string; stroke?: string }

export function BellIcon({ stroke = '#fff' }: IconProps) {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

export function PinIcon({ stroke = '#94A3B8', size = 14 }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
      <path d="M12 21s-7-6.4-7-11a7 7 0 0 1 14 0c0 4.6-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  )
}

export function UsersIcon({ stroke = '#94A3B8', size = 13 }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}

export function HeartIcon({ stroke = '#0F172A', size = 16 }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2">
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8Z" />
    </svg>
  )
}

export function CheckIcon({ stroke = '#22C55E', size = 16 }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.5" strokeLinecap="round">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  )
}

export function SearchIcon({ stroke = '#fff', size = 15 }: IconProps & { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="2.5">
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
  { key: 'ticket', label: 'My Ticket', to: '/events' },
]

export function SiteNav({ active }: { active?: NavKey }) {
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
            className={active === l.key ? 'text-[#0F172A]' : 'text-[#334155] hover:text-[#0F172A]'}
          >
            {l.label}
          </Link>
        ))}
      </div>
      <div className="flex items-center gap-3.5">
        <Link
          to="/events/new"
          className="rounded-full bg-[#2563EB] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-[#1D4ED8]"
        >
          + Organiseer een Event
        </Link>
        <div className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#0F172A]" title="Notificaties">
          <BellIcon />
        </div>
        <div className="flex h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-full bg-[#E2E8F0]">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="#94A3B8">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4.4 3.6-8 8-8s8 3.6 8 8" />
          </svg>
        </div>
      </div>
    </nav>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────

const footerColumns: Array<{ title: string; links: Array<{ label: string; to?: string }> }> = [
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
    links: [{ label: 'Helpcentrum' }, { label: 'Voorwaarden' }, { label: 'Privacybeleid' }, { label: 'Contact' }],
  },
  {
    title: 'Company',
    links: [{ label: 'Over Ons' }, { label: 'Vacatures' }, { label: 'Blog' }, { label: 'Partners' }],
  },
]

export function SiteFooter() {
  return (
    <footer className="bg-[#0F172A] px-6 pb-7 pt-14 text-[#94A3B8] md:px-12">
      <div className="mx-auto grid max-w-[1280px] gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div className="mb-3 text-[20px] font-extrabold text-white">Event.</div>
          <p className="max-w-[280px] text-[13px] leading-relaxed">
            Het toonaangevende platform voor het vinden en creëren van events. Verbind met community&apos;s en ontdek
            jouw passies.
          </p>
          <div className="mt-4.5 flex gap-2.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#1E293B]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#94A3B8">
                  <rect x="2" y="2" width="20" height="20" rx="5" />
                </svg>
              </div>
            ))}
          </div>
        </div>
        {footerColumns.map((col) => (
          <div key={col.title}>
            <div className="mb-4 text-[13px] font-bold text-white">{col.title}</div>
            <div className="flex flex-col gap-2.5 text-[13px]">
              {col.links.map((link) =>
                link.to ? (
                  <Link key={link.label} to={link.to} className="text-[#94A3B8] hover:text-white">
                    {link.label}
                  </Link>
                ) : (
                  <a key={link.label} href="#" className="text-[#94A3B8] hover:text-white">
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
    <div className="min-h-screen bg-white font-['Manrope',sans-serif] text-[#0F172A] antialiased">{children}</div>
  )
}
