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

// Status van een ticketaanvraag (heette in fase G "reservering"; de tabel en de
// enum houden die naam, alleen de UI-taal is gewijzigd — zie Migratieplan §1.3).
//
// nieuw       → UI "Wacht op betaling"
// betaald     → UI "Betaald — klaar om te sturen" (migratie 0012)
// afgehandeld → UI "Ticket verzonden / Afgerond"
// geannuleerd → expliciet ingetrokken door de organisator (migratie 0012)
// verlopen    → vervalt_op gepasseerd zonder betaling (migratie 0012)
//
// 'afgewezen' is UITGEFASEERD (Migratieplan §6.8): sinds migratie 0012 schrijft
// niets het meer, 'geannuleerd' heeft het vervangen. De waarde blijft in de enum
// staan omdat Postgres een enumwaarde niet kan droppen zolang oude rijen hem
// dragen — en die rijen weg-updaten is een datamigratie zonder opbrengst. Lees je
// statussen, dan hoort 'afgewezen' overal bij 'geannuleerd'.
export const reserveringStatus = pgEnum('reservering_status', [
  'nieuw',
  'afgehandeld',
  'afgewezen',
  'betaald',
  'geannuleerd',
  'verlopen',
])

// Hoe een bezoeker betaalt. Bewust een aparte tabel per event in plaats van een
// enum-array op events: Uni5Pay/Mope kunnen er later bij zonder enum-migratie, en
// elke methode draagt zijn eigen config (rekeningnummer, telefoonnummer).
export const betaalmethodeSoort = pgEnum('betaalmethode_soort', [
  'whatsapp',
  'bank',
  'contant',
  'online',
])

// Rol van een gebruiker (fase J). admin = platform-breed overzicht (leest
// cross-org, de enige uitzondering op harde regel 3); organisator = beheert de
// eigen org; koper = ziet eigen tickets. Default 'koper'.
export const gebruikerRol = pgEnum('gebruiker_rol', [
  'admin',
  'organisator',
  'koper',
])

// Vaste categorie-taxonomie voor de publieke discovery-front-end. Spiegelt de
// categorieën uit het ontwerp; UI-labels blijven Nederlands.
//
// Deze acht vervingen op 2026-07-30 de oude, uit een generiek ontwerp overgenomen
// reeks (Muziek, Tech, Business, Food & Drink, Health, Art & Design, Sports). Die
// paste niet op wat er in Suriname te doen is: geen Nightlife, geen Cultuur &
// Festival, wél een Tech-categorie waar niets in zat. Migratie 0011 zet bestaande
// rijen om; die mapping staat in het migratiebestand.
export const eventCategorie = pgEnum('event_categorie', [
  'Muziek & Concerten',
  'Nightlife',
  'Cultuur & Festival',
  'Food & Drinks',
  'Business & Netwerk',
  'Sport & Outdoor',
  'Workshops',
  'Familie & Kids',
])

// --- Better Auth (core) ---
// Infrastructuurtabellen van Better Auth. Bewust Engelse camelCase-veldnamen:
// de drizzle-adapter matcht op deze JS-sleutels. DB-kolommen blijven snake_case
// (projectconventie). Ids zijn uuid zodat ze aansluiten op de rest van het schema
// (auth-config: advanced.database.generateId = 'uuid'). Organization-plugin komt
// pas in fase 2; voor nu draagt de user zijn organization_id mee (harde regel 3).
export const user = pgTable('user', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  image: text('image'),
  // Tenant van de ingelogde gebruiker. Elke gescoopte query leest hierop.
  organizationId: uuid('organization_id').references(() => organizations.id),
  // Rol bepaalt welk dashboard de gebruiker ziet (fase J). Default 'koper';
  // wordt 'organisator' bij het aanmaken van een organisatie en 'admin' voor het
  // platformbeheeraccount.
  rol: gebruikerRol('rol').notNull().default('koper'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const session = pgTable('session', {
  id: uuid('id').primaryKey(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  token: text('token').notNull().unique(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const account = pgTable('account', {
  id: uuid('id').primaryKey(),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  userId: uuid('user_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  idToken: text('id_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at', {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
    withTimezone: true,
  }),
  scope: text('scope'),
  password: text('password'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

export const verification = pgTable('verification', {
  id: uuid('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

// --- Domein ---

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
    // Publieke discovery-velden (fase 2). Nullable: bestaande events hoeven ze
    // niet te hebben, en alleen `status = 'actief'` events zijn publiek zichtbaar.
    categorie: eventCategorie('categorie'),
    beschrijving: text('beschrijving'),
    cover_afbeelding_url: text('cover_afbeelding_url'),
    // Verkoopinstellingen (migratie 0012). verkoop_actief = false → de publieke
    // eventpagina toont alleen flyer en informatie: geen tickettypes, geen
    // aanvraagformulier. Default true zodat bestaande events identiek werken.
    verkoop_actief: boolean('verkoop_actief').notNull().default(true),
    // Vrije tekst die de bezoeker direct na zijn aanvraag te zien krijgt.
    betaalinstructies: text('betaalinstructies'),
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
    // Kenmerken die bij dit ticket horen (publieke discovery). USD-prijs bestaat
    // bewust niet als kolom: de gebruiker vult alleen SRD in, het platform rekent
    // USD-weergave om via de vaste koers (zie src/components/discovery/currency.ts).
    features: text('features').array(),
  },
  (t) => [
    index('ticket_types_organization_id_idx').on(t.organization_id),
    index('ticket_types_event_id_idx').on(t.event_id),
  ],
)

// --- Publieke event-inhoud (fase 2, discovery-front-end) ---
// Sprekers/line-up, agenda en FAQ per event. Elke tabel draagt organization_id
// (harde regel 3) en een `volgorde` voor stabiele sortering in de UI.

export const eventSprekers = pgTable(
  'event_sprekers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    event_id: uuid('event_id')
      .notNull()
      .references(() => events.id),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    naam: text('naam').notNull(),
    rol: text('rol'),
    avatar_url: text('avatar_url'),
    volgorde: numeric('volgorde').notNull().default('0'),
  },
  (t) => [
    index('event_sprekers_organization_id_idx').on(t.organization_id),
    index('event_sprekers_event_id_idx').on(t.event_id),
  ],
)

export const eventAgenda = pgTable(
  'event_agenda',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    event_id: uuid('event_id')
      .notNull()
      .references(() => events.id),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    tijd: text('tijd').notNull(),
    titel: text('titel').notNull(),
    subtitel: text('subtitel'),
    beschrijving: text('beschrijving'),
    volgorde: numeric('volgorde').notNull().default('0'),
  },
  (t) => [
    index('event_agenda_organization_id_idx').on(t.organization_id),
    index('event_agenda_event_id_idx').on(t.event_id),
  ],
)

export const eventFaq = pgTable(
  'event_faq',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    event_id: uuid('event_id')
      .notNull()
      .references(() => events.id),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    vraag: text('vraag').notNull(),
    antwoord: text('antwoord'),
    volgorde: numeric('volgorde').notNull().default('0'),
  },
  (t) => [
    index('event_faq_organization_id_idx').on(t.organization_id),
    index('event_faq_event_id_idx').on(t.event_id),
  ],
)

// Betaalmethoden per event (migratie 0012). Bepaalt wat de bezoeker ziet ná zijn
// aanvraag: een WhatsApp-knop, bankgegevens, of een tekst over contant betalen.
// `soort = 'online'` is gereserveerd voor Uni5Pay/Mope en wordt nog nergens
// aangeboden — er is geen online betaling (harde regel 6).
export const eventBetaalmethoden = pgTable(
  'event_betaalmethoden',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    event_id: uuid('event_id')
      .notNull()
      .references(() => events.id),
    organization_id: uuid('organization_id')
      .notNull()
      .references(() => organizations.id),
    soort: betaalmethodeSoort('soort').notNull(),
    // 'uni5pay' | 'mope' | null — alleen gevuld bij soort = 'online'.
    provider: text('provider'),
    // Vrije configuratie per methode: telefoonnummer, rekeningnummer, adres.
    config: text('config'),
    actief: boolean('actief').notNull().default(true),
    volgorde: numeric('volgorde').notNull().default('0'),
  },
  (t) => [
    index('event_betaalmethoden_organization_id_idx').on(t.organization_id),
    index('event_betaalmethoden_event_id_idx').on(t.event_id),
  ],
)

// Publieke ticketaanvragen (fase G, toen "reserveringen"): een bezoeker vraagt
// een ticket aan zonder account. De organisator registreert de betaling en geeft
// het ticket uit. organization_id staat erop (harde regel 3).
export const reserveringen = pgTable(
  'reserveringen',
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
    naam: text('naam').notNull(),
    email: text('email'),
    telefoon: text('telefoon'),
    aantal: numeric('aantal').notNull().default('1'),
    opmerking: text('opmerking'),
    status: reserveringStatus('status').notNull().default('nieuw'),
    // Betaalspoor (migratie 0012). betaalreferentie is nu een vrij kenmerk voor
    // bank/WhatsApp; als er ooit een provider bijkomt vult die hier zijn
    // transactie-id in, zonder tweede tabel.
    betaald_op: timestamp('betaald_op', { withTimezone: true }),
    betaalmethode: text('betaalmethode'),
    betaalreferentie: text('betaalreferentie'),
    vervalt_op: timestamp('vervalt_op', { withTimezone: true }),
    aangemaakt_op: timestamp('aangemaakt_op', { withTimezone: true })
      .notNull()
      .defaultNow(),
    afgehandeld_op: timestamp('afgehandeld_op', { withTimezone: true }),
  },
  (t) => [
    index('reserveringen_organization_id_idx').on(t.organization_id),
    index('reserveringen_event_id_idx').on(t.event_id),
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
    // Koppeling naar het koper-account (fase K), gevuld bij uitgifte of bij de
    // eerste login met dit e-mailadres. Nullable: niet elk ticket heeft een koper
    // die inlogt.
    koper_user_id: uuid('koper_user_id').references(() => user.id),
    verkocht_op: timestamp('verkocht_op', { withTimezone: true }),
    // Verwijst naar de verkopende gebruiker (Better Auth). Nu altijd Amresh;
    // straks kan het de organisator zijn zonder migratie (PLAN §8).
    verkocht_door_user_id: uuid('verkocht_door_user_id').references(
      () => user.id,
    ),
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
    index('tickets_koper_user_id_idx').on(t.koper_user_id),
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
