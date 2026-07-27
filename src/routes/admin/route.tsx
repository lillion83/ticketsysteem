import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { signOut } from '#/lib/auth-client'
import { getCurrentUser } from '#/server/session'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login' })
    // Kopers (Google/e-mailcode, fase K) hebben geen organisatie en horen niet in
    // de admin — stuur ze naar de publieke site.
    if (!user.organizationId) throw redirect({ to: '/' })
    return { user }
  },
  component: AdminLayout,
})

// Twee initialen uit de e-mail voor de avatar (geen naam op de org-user).
function initials(email: string): string {
  const naam = email.split('@')[0]
  return naam.slice(0, 2).toUpperCase()
}

function AdminLayout() {
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()

  async function uitloggen() {
    await signOut()
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen bg-[#F1F5F9] text-[#0F172A] md:grid md:grid-cols-[244px_1fr]">
      {/* Zijbalk */}
      <aside className="sticky top-0 hidden h-screen flex-col gap-1.5 self-start border-r border-[#E5E7EB] bg-white px-4 py-5 md:flex">
        <Link to="/admin" className="px-2.5 pb-4 pt-1 text-[21px] font-extrabold tracking-tight">
          Ticket<span className="text-[#2563EB]">beheer</span>
        </Link>
        <div className="px-2.5 pb-1.5 pt-3 text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
          Beheer
        </div>
        <nav className="flex flex-col gap-1">
          <NavItem to="/admin" exact icon={<GridIcon />}>
            Dashboard
          </NavItem>
          <NavItem to="/admin/events" icon={<CalendarIcon />}>
            Events
          </NavItem>
        </nav>
        <div className="flex-1" />
        <hr className="mx-1 my-3 border-[#E5E7EB]" />
        <button
          onClick={uitloggen}
          className="flex items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-[14px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
        >
          <LogoutIcon />
          Uitloggen
        </button>
      </aside>

      {/* Hoofdkolom */}
      <div className="min-w-0">
        {/* Mobiele topbalk (geen zijbalk op klein scherm) */}
        <div className="flex items-center justify-between border-b border-[#E5E7EB] bg-white px-5 py-3 md:hidden">
          <Link to="/admin" className="text-[18px] font-extrabold">
            Ticket<span className="text-[#2563EB]">beheer</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link to="/admin/events" className="text-[14px] font-semibold text-[#2563EB]">
              Events
            </Link>
            <button onClick={uitloggen} className="text-[14px] font-semibold text-[#64748B]">
              Uitloggen
            </button>
          </div>
        </div>

        {/* Topbar met gebruikerschip */}
        <header className="hidden items-center justify-end gap-4 px-7 pt-5 md:flex">
          <div className="relative grid h-10 w-10 place-items-center rounded-full border border-[#E5E7EB] bg-white" title="Notificaties">
            <BellIcon />
          </div>
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#7C3AED] text-[13px] font-extrabold text-white">
              {initials(user.email)}
            </div>
            <div className="leading-tight">
              <div className="text-[14px] font-bold">{user.email}</div>
              <div className="text-[12px] text-[#64748B]">Organisator</div>
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1200px] px-5 py-6 md:px-7">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

// ── Navigatie-item ──────────────────────────────────────────────────────────

function NavItem({
  to,
  exact,
  icon,
  children,
}: {
  to: string
  exact?: boolean
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: exact ?? false }}
      className="flex items-center gap-3 rounded-[10px] px-2.5 py-2.5 text-[14px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#0F172A]"
      activeProps={{ className: 'bg-[#EFF6FF] text-[#2563EB] hover:bg-[#EFF6FF] hover:text-[#2563EB]' }}
    >
      {icon}
      {children}
    </Link>
  )
}

// ── Iconen (inline SVG, zelfde stijl als de discovery-front-end) ─────────────

function GridIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M15 3H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h7M18 12H9M15 8l4 4-4 4" />
    </svg>
  )
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#64748B" strokeWidth="2" strokeLinecap="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
