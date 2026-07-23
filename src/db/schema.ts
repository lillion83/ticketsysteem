import {
  boolean,
  index,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

// Resultaat van een scan. Exact de zes waarden uit PLAN.md sectie 4 (regel 149).
export const scanResultaat = pgEnum('scan_resultaat', [
  'groen',
  'rood_al_gebruikt',
  'rood_ongeldig',
  'rood_ingetrokken',
  'rood_verkeerd_event',
  'groen_re_entry',
])

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  naam: text('naam').notNull(),
  contactpersoon: text('contactpersoon'),
  telefoon: text('telefoon'),
  aangemaakt_op: timestamp('aangemaakt_op', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const events = pgTable(
  'events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    naam: text('naam').notNull(),
    datum_start: timestamp('datum_start', { withTimezone: true }).notNull(),
    datum_eind: timestamp('datum_eind', { withTimezone: true }).notNull(),
    locatie: text('locatie'),
    re_entry_toegestaan: boolean('re_entry_toegestaan')
      .notNull()
      .default(false),
    status: text('status').notNull().default('concept'),
    aangemaakt_op: timestamp('aangemaakt_op', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('events_organization_id_idx').on(t.organization_id)],
)

export const ticketTypes = pgTable(
  'ticket_types',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    event_id: uuid('event_id')
      .notNull()
      .references(() => events.id),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    naam: text('naam').notNull(),
    prijs_srd: numeric('prijs_srd', { precision: 12, scale: 2 }).notNull(),
    inkoopprijs_srd: numeric('inkoopprijs_srd', {
      precision: 12,
      scale: 2,
    }).notNull(),
    aantal_beschikbaar: numeric('aantal_beschikbaar').notNull(),
    aantal_verkocht: numeric('aantal_verkocht').notNull().default('0'),
  },
  (t) => [
    index('ticket_types_organization_id_idx').on(t.organization_id),
    index('ticket_types_event_id_idx').on(t.event_id),
  ],
)

export const tickets = pgTable(
  'tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    event_id: uuid('event_id')
      .notNull()
      .references(() => events.id),
    ticket_type_id: uuid('ticket_type_id')
      .notNull()
      .references(() => ticketTypes.id),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    // {uuid}.{hmac} — zie harde regel 1. Unique, want dit is de scan-lookup.
    code: text('code').notNull(),
    koper_naam: text('koper_naam'),
    koper_telefoon: text('koper_telefoon'),
    koper_email: text('koper_email'),
    verkocht_op: timestamp('verkocht_op', { withTimezone: true }),
    // FK naar de user-tabel volgt zodra Better Auth er staat (Fase A, latere stap).
    verkocht_door_user_id: uuid('verkocht_door_user_id'),
    verkoopkanaal: text('verkoopkanaal'),
    geleverd_via: text('geleverd_via'),
    geleverd_op: timestamp('geleverd_op', { withTimezone: true }),
    gebruikt_op: timestamp('gebruikt_op', { withTimezone: true }),
    // Scanner-sessie of user; betekenis wordt vastgezet zodra auth er is.
    gebruikt_door: uuid('gebruikt_door'),
    ingetrokken_op: timestamp('ingetrokken_op', { withTimezone: true }),
    ingetrokken_reden: text('ingetrokken_reden'),
  },
  (t) => [
    uniqueIndex('tickets_code_idx').on(t.code),
    index('tickets_organization_id_idx').on(t.organization_id),
    index('tickets_event_id_idx').on(t.event_id),
  ],
)

export const scannerSessions = pgTable(
  'scanner_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    event_id: uuid('event_id')
      .notNull()
      .references(() => events.id),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    token_hash: text('token_hash').notNull(),
    label: text('label'),
    vervalt_op: timestamp('vervalt_op', { withTimezone: true }),
    ingetrokken_op: timestamp('ingetrokken_op', { withTimezone: true }),
    laatste_sync: timestamp('laatste_sync', { withTimezone: true }),
  },
  (t) => [
    index('scanner_sessions_organization_id_idx').on(t.organization_id),
    index('scanner_sessions_event_id_idx').on(t.event_id),
  ],
)

export const scans = pgTable(
  'scans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticket_id: uuid('ticket_id')
      .notNull()
      .references(() => tickets.id),
    event_id: uuid('event_id')
      .notNull()
      .references(() => events.id),
    // Harde regel 3: organization_id op elke tabel, ook waar het via een join
    // afleidbaar is. Elke lees-query filtert erop.
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    scanner_sessie_id: uuid('scanner_sessie_id').references(
      () => scannerSessions.id,
    ),
    tijdstip_client: timestamp('tijdstip_client', { withTimezone: true }),
    tijdstip_server: timestamp('tijdstip_server', { withTimezone: true })
      .notNull()
      .defaultNow(),
    resultaat: scanResultaat('resultaat').notNull(),
    // Idempotentie: dezelfde scan twee keer ontvangen mag nooit dubbel tellen.
    client_scan_uuid: uuid('client_scan_uuid').notNull(),
  },
  (t) => [
    uniqueIndex('scans_client_scan_uuid_idx').on(t.client_scan_uuid),
    index('scans_organization_id_idx').on(t.organization_id),
    index('scans_ticket_id_idx').on(t.ticket_id),
    index('scans_event_id_idx').on(t.event_id),
  ],
)
