import {
  Link,
  Outlet,
  createFileRoute,
  redirect,
  useNavigate,
} from '@tanstack/react-router'
import { signOut } from '#/lib/auth-client'
import { getCurrentUser } from '#/server/session'

export const Route = createFileRoute('/admin')({
  beforeLoad: async () => {
    const user = await getCurrentUser()
    if (!user) throw redirect({ to: '/login' })
    return { user }
  },
  component: AdminLayout,
})

function AdminLayout() {
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()

  async function uitloggen() {
    await signOut()
    navigate({ to: '/login' })
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-gray-200 px-6 py-3">
        <Link to="/admin" className="font-bold">
          Ticketbeheer
        </Link>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-gray-600">{user.email}</span>
          <button
            onClick={uitloggen}
            className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50"
          >
            Uitloggen
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-4xl p-6">
        <Outlet />
      </main>
    </div>
  )
}
