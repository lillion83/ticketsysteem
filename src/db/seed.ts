import { closeDb, db } from './index'
import {
  eventAgenda,
  eventFaq,
  eventSprekers,
  events,
  organizations,
  ticketTypes,
} from './schema'

// Seed: één organisatie, één actief (publiek zichtbaar) testevent met
// tickettypes én discovery-inhoud (categorie, beschrijving, sprekers, agenda, FAQ).
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
      naam: 'Global AI & Big Data Expo 2026',
      datum_start: new Date('2026-08-01T20:00:00Z'),
      datum_eind: new Date('2026-08-02T02:00:00Z'),
      locatie: 'Torarica Hotel, Paramaribo',
      re_entry_toegestaan: false,
      status: 'actief',
      categorie: 'Tech',
      beschrijving:
        'Ontdek de transformerende kracht van Artificial Intelligence. De Global AI & Big Data Expo 2026 is de toonaangevende conferentie om te ontdekken hoe AI en Big Data industrieën ontwrichten.\n\nWe duiken diep in predictive analytics, neurale netwerken en automatiseringsstrategieën. Doe praktische kennis op over het benutten van data voor bedrijfsgroei.',
      cover_afbeelding_url: null,
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
      aantal_verkocht: '42',
    },
    {
      event_id: event.id,
      organization_id: organisatie.id,
      naam: 'VIP',
      prijs_srd: '350.00',
      inkoopprijs_srd: '250.00',
      aantal_beschikbaar: '50',
      aantal_verkocht: '8',
    },
  ])

  await db.insert(eventSprekers).values([
    { event_id: event.id, organization_id: organisatie.id, naam: 'Elena Fisher', rol: 'Head of AI at Google', volgorde: '0' },
    { event_id: event.id, organization_id: organisatie.id, naam: 'David Chen', rol: 'Data Scientist', volgorde: '1' },
    { event_id: event.id, organization_id: organisatie.id, naam: 'Michael Tan', rol: 'Robotics Engineer', volgorde: '2' },
  ])

  await db.insert(eventAgenda).values([
    {
      event_id: event.id,
      organization_id: organisatie.id,
      tijd: '20.00',
      titel: 'Keynote: The Rise of Generative AI',
      subtitel: 'Hoofdzaal · Elena Fisher',
      beschrijving: 'Een diepgaande blik op de markttrends en voorspellingen voor het volgende decennium van AI.',
      volgorde: '0',
    },
    {
      event_id: event.id,
      organization_id: organisatie.id,
      tijd: '21.30',
      titel: 'Breakout: Building LLM Apps',
      subtitel: 'Zaal 204 · David Chen',
      beschrijving: null,
      volgorde: '1',
    },
  ])

  await db.insert(eventFaq).values([
    { event_id: event.id, organization_id: organisatie.id, vraag: 'Moet ik een laptop meenemen?', antwoord: null, volgorde: '0' },
    {
      event_id: event.id,
      organization_id: organisatie.id,
      vraag: 'Is lunch inbegrepen?',
      antwoord: 'Ja, een gratis buffetlunch met vegetarische, veganistische en halal opties.',
      volgorde: '1',
    },
  ])

  console.log('Seed klaar:')
  console.log(`  organisatie: ${organisatie.naam} (${organisatie.id})`)
  console.log(`  event:       ${event.naam} (${event.id}) — status actief`)
  console.log('  tickettypes: Regulier, VIP · sprekers/agenda/FAQ toegevoegd')
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
