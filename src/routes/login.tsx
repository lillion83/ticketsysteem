import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { signIn } from '#/lib/auth-client'

export const Route = createFileRoute('/login')({ component: LoginPage })

function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [wachtwoord, setWachtwoord] = useState('')
  const [fout, setFout] = useState<string | null>(null)
  const [bezig, setBezig] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFout(null)
    setBezig(true)
    const { error } = await signIn.email({ email, password: wachtwoord })
    setBezig(false)
    if (error) {
      setFout('Inloggen mislukt. Controleer e-mail en wachtwoord.')
      return
    }
    navigate({ to: '/admin' })
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <h1 className="mb-6 text-2xl font-bold">Inloggen</h1>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">E-mail</span>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">Wachtwoord</span>
          <input
            type="password"
            required
            value={wachtwoord}
            onChange={(e) => setWachtwoord(e.target.value)}
            className="rounded border border-gray-300 px-3 py-2"
          />
        </label>
        {fout && <p className="text-sm text-red-600">{fout}</p>}
        <button
          type="submit"
          disabled={bezig}
          className="rounded bg-black px-4 py-2 font-medium text-white disabled:opacity-50"
        >
          {bezig ? 'Bezig…' : 'Inloggen'}
        </button>
      </form>
    </div>
  )
}
