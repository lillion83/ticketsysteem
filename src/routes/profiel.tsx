import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { SiteFooter, SiteNav, SitePage } from '#/components/discovery/site'
import { signOut } from '#/lib/auth-client'
import { getCurrentUser } from '#/server/session'
import { ROL_LABEL, homePathForRole } from '#/lib/rol'
import type { Rol } from '#/lib/rol'

// Profiel (fase J): toont wie je bent en welke rol je hebt, met een snelkoppeling
// naar het dashboard dat bij je rol hoort.
export const Route = createFileRoute('/profiel')({
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login', search: { redirect: '/profiel' } })
    return { user }
  },
  loader: ({ context }) => context.user,
  component: Profiel,
})

const rolBadge: Record<Rol, string> = {
  admin: 'bg-[#EDE9FE] text-[#6D28D9]',
  organisator: 'bg-[#DBEAFE] text-[#2563EB]',
  koper: 'bg-[#DCFCE7] text-[#16A34A]',
}

const rolUitleg: Record<Rol, string> = {
  admin: 'Je beheert het platform en ziet alle organisatoren en events.',
  organisator: 'Je beheert je eigen organisatie: events, tickets en de deur.',
  koper: 'Je ziet hier de tickets die je hebt gekocht of gereserveerd.',
}

function Profiel() {
  const user = Route.useLoaderData()
  const navigate = useNavigate()
  const rol = user.rol as Rol

  async function uitloggen() {
    await signOut()
    navigate({ to: '/login' })
  }

  return (
    <SitePage>
      <SiteNav />
      <div className="mx-auto max-w-[560px] px-6 py-16">
        <h1 className="mb-6 text-[28px] font-extrabold">Profiel</h1>

        <div className="rounded-2xl border border-[#E5E7EB] bg-white p-6 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-[#2563EB] to-[#7C3AED] text-[18px] font-extrabold text-white">
              {user.email.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="text-[17px] font-extrabold">{user.name || user.email.split('@')[0]}</div>
              <div className="text-[13px] text-[#64748B]">{user.email}</div>
            </div>
          </div>

          <dl className="mt-6 grid grid-cols-[120px_1fr] gap-x-4 gap-y-3 text-[14px]">
            <dt className="text-[#64748B]">Rol</dt>
            <dd className="m-0">
              <span className={`rounded-full px-3 py-1 text-[12px] font-bold ${rolBadge[rol]}`}>{ROL_LABEL[rol]}</span>
            </dd>
            <dt className="text-[#64748B]">Toegang</dt>
            <dd className="m-0 text-[#334155]">{rolUitleg[rol]}</dd>
          </dl>

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              onClick={() => navigate({ to: homePathForRole(rol) })}
              className="rounded-full bg-[#2563EB] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-[#1D4ED8]"
            >
              Naar mijn dashboard
            </button>
            <button
              onClick={uitloggen}
              className="rounded-full border border-[#E5E7EB] bg-white px-5 py-2.5 text-[14px] font-semibold text-[#0F172A] hover:border-[#CBD5E1]"
            >
              Uitloggen
            </button>
          </div>
        </div>
      </div>
      <SiteFooter />
    </SitePage>
  )
}
