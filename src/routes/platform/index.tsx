import { Link, createFileRoute } from '@tanstack/react-router'
import { getPlatformStats } from '#/server/platform'
import type { PlatformStats } from '#/server/platform'
import { formatPrice } from '#/components/discovery/currency'
import {
  BESCHIKBAAR_KLEUR,
  BoxIcon,
  BuildingIcon,
  CheckIcon,
  CoinIcon,
  Donut,
  Kpi,
  Panel,
  TYPE_KLEUREN,
  WeekGrafiek,
} from '#/components/admin/charts'

export const Route = createFileRoute('/platform/')({
  loader: () => getPlatformStats(),
  component: PlatformDashboard,
})

function donutSegmenten(data: PlatformStats) {
  return [
    ...data.perOrg
      .filter((o) => o.uitgegeven > 0)
      .map((o, i) => ({
        naam: o.naam,
        aantal: o.uitgegeven,
        kleur: TYPE_KLEUREN[i % TYPE_KLEUREN.length],
      })),
    { naam: 'Beschikbaar', aantal: data.beschikbaar, kleur: BESCHIKBAAR_KLEUR },
  ]
}

function PlatformDashboard() {
  const data = Route.useLoaderData()

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-[24px] font-extrabold tracking-tight text-[#2563EB]">Platform-overzicht</h1>
        <p className="text-[13px] text-[#64748B]">Alle organisatoren en events op één plek</p>
      </div>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Organisatoren" waarde={data.aantalOrganisaties.toLocaleString('nl-NL')} sub="Actieve organisaties" icon={<BuildingIcon />} />
        <Kpi label="Events" waarde={data.aantalEvents.toLocaleString('nl-NL')} sub="Over alle organisatoren" icon={<CheckIcon />} />
        <Kpi label="Uitgegeven" waarde={data.uitgegeven.toLocaleString('nl-NL')} sub={`${data.beschikbaar.toLocaleString('nl-NL')} nog beschikbaar`} icon={<BoxIcon />} />
        <Kpi
          label="Verkochte waarde"
          chip="indicatie"
          waarde={formatPrice(data.waardeSrd, 'SRD')}
          sub="Platform-breed · geen uitbetalingen"
          icon={<CoinIcon />}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[5fr_7fr]">
        <Panel titel="Uitgegeven per organisator" sub="Verdeling over de capaciteit">
          <Donut
            segmenten={donutSegmenten(data)}
            centerBig={`${data.uitgegeven} / ${data.beschikbaar}`}
            centerLabel="Uitgegeven / Beschikbaar"
          />
        </Panel>
        <Panel titel="Uitgifte per dag" sub="Laatste 7 dagen · alle organisatoren">
          <WeekGrafiek reeks={data.reeks} />
        </Panel>
      </section>

      <div>
        <Link to="/platform/events" className="text-[13px] font-bold text-[#2563EB] hover:text-[#1D4ED8]">
          Alle events bekijken →
        </Link>
      </div>
    </div>
  )
}
