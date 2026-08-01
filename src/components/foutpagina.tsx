import { Link } from '@tanstack/react-router'
import { useEffect } from 'react'

// Vangnet voor de hele router. Zonder deze componenten rendert TanStack de kale
// fout in de pagina, en dat betekende bij een verkeerd pad als /admin/events/new
// een Postgres-melding mét query en kolomnamen in de browser. De technische
// details gaan naar de console; de bezoeker krijgt tekst waar hij iets aan heeft.

function Kader({
  titel,
  uitleg,
  children,
}: {
  titel: string
  uitleg: string
  children?: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#F1F5F9] px-5 py-10 text-[#0F172A]">
      <div className="w-full max-w-[440px] rounded-2xl border border-[#E5E7EB] bg-white p-8 text-center shadow-sm">
        <h1 className="text-[22px] font-extrabold tracking-tight">{titel}</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-[#64748B]">
          {uitleg}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          {children}
        </div>
      </div>
    </div>
  )
}

const knopPrimair =
  'rounded-full bg-[#2563EB] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-[#1D4ED8]'
const knopSecundair =
  'rounded-full border border-[#E5E7EB] bg-white px-5 py-2.5 text-[14px] font-bold text-[#0F172A] hover:bg-[#F8FAFC]'

export function NietGevonden() {
  return (
    <Kader
      titel="Pagina niet gevonden"
      uitleg="Deze pagina bestaat niet (meer). Controleer het adres, of ga terug naar je events."
    >
      <Link to="/admin/events" className={knopPrimair}>
        Naar mijn events
      </Link>
      <Link to="/" className={knopSecundair}>
        Naar de homepage
      </Link>
    </Kader>
  )
}

export function FoutOpgetreden({ error }: { error: Error }) {
  useEffect(() => {
    // Alleen naar de console: de melding zelf kan schema- of querydetails
    // bevatten en hoort niet in de DOM.
    console.error(error)
  }, [error])

  return (
    <Kader
      titel="Er ging iets mis"
      uitleg="We konden deze pagina niet laden. Probeer het opnieuw, of ga terug naar je events."
    >
      <button onClick={() => window.location.reload()} className={knopPrimair}>
        Opnieuw proberen
      </button>
      <Link to="/admin/events" className={knopSecundair}>
        Naar mijn events
      </Link>
    </Kader>
  )
}
