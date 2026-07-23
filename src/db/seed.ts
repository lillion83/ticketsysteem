import { closeDb, db } from './index'
import { events, organizations, ticketTypes } from './schema'

// Seed voor Fase A: één organisatie, één testevent, twee tickettypes.
// Draaien met: npm run db:seed  (vereist een migratie-gedraaide database)
async function seed() {
  const [organisatie] = await db
    .insert(organizations)
    .values({
      naam: 'Amresh Tickets',
      contactpersoon: 'Amresh',
      telefoon: '+597 000000',
    })
    .returning()

  const [event] = await db
    .insert(events)
    .values({
      organization_id: organisatie.id,
      naam: 'Testevent',
      datum_start: new Date('2026-08-01T20:00:00Z'),
      datum_eind: new Date('2026-08-02T02:00:00Z'),
      locatie: 'Binnenlocatie Paramaribo',
      re_entry_toegestaan: false,
      status: 'concept',
    })
    .returning()

  await db.insert(ticketTypes).values([
    {
      event_id: event.id,
      organization_id: organisatie.id,
      naam: 'Regulier',
      prijs_srd: '150.00',
      inkoopprijs_srd: '100.00',
      aantal_beschikbaar: '150',
    },
    {
      event_id: event.id,
      organization_id: organisatie.id,
      naam: 'VIP',
      prijs_srd: '350.00',
      inkoopprijs_srd: '250.00',
      aantal_beschikbaar: '50',
    },
  ])

  console.log('Seed klaar:')
  console.log(`  organisatie: ${organisatie.naam} (${organisatie.id})`)
  console.log(`  event:       ${event.naam} (${event.id})`)
  console.log('  tickettypes: Regulier, VIP')
}

seed()
  .then(async () => {
    await closeDb()
    process.exit(0)
  })
  .catch(async (err) => {
    console.error('Seed mislukt:', err)
    await closeDb()
    process.exit(1)
  })
