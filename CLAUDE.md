# CLAUDE.md

## Project

E-ticketsysteem met QR-codes en een deurscanner. Eén evenement in fase 1, maar
multi-tenant opgezet vanaf dag één. Amresh verkoopt tickets handmatig (contant
ingekocht bij de organisator), levert ze via WhatsApp en mail, en scant ze aan
de deur met een PWA.

Het volledige plan staat in `docs/PLAN.md`. **Lees dat bij twijfel over scope of
datamodel — dit bestand bevat alleen de regels, niet de context.**

## Stack

- TanStack Start (React)
- PostgreSQL + Drizzle ORM
- Better Auth (met organization plugin)
- Tailwind CSS 4
- Resend voor transactionele mail
- Deploy: InterServer met Caddy + PM2

## Harde regels — hier nooit van afwijken zonder te overleggen

1. **Ticketcodes zijn `{uuid}.{hmac}`.** HMAC-SHA256 over `event_id + ticket_id`,
   afgekapt tot 16 tekens, met `TICKET_SECRET` uit de env. Nooit oplopende
   nummers. Nooit persoonsgegevens in de code.

2. **De scan is één atomaire UPDATE.** Nooit eerst SELECT en dan UPDATE.

   ```sql
   UPDATE tickets SET gebruikt_op = now(), gebruikt_door = $2
   WHERE code = $1 AND gebruikt_op IS NULL
   RETURNING *;
   ```

   Rij terug = groen. Geen rij = rood, en pas dán ophalen waarom.

3. **`organization_id` op elke tabel**, ook als het via een join afleidbaar is.
   Elke query die data leest, filtert erop. Geen uitzonderingen.

4. **Scan-uploads zijn idempotent.** Elke scan heeft een client-side UUID
   (`client_scan_uuid`, unique). Dezelfde scan twee keer ontvangen mag nooit
   dubbel tellen.

5. **Geen IndexedDB.** Onder de 200 tickets past de lijst in `localStorage`.
   Volledige sync elke keer, geen delta-sync. Hou het simpel.

6. **Geen betaallogica, geen ledger, geen refunds.** Buiten scope. Als een taak
   daarheen neigt: stoppen en vragen.

## Conventies

- **Database:** tabel- en kolomnamen in het Nederlands (`gebruikt_op`,
  `verkocht_door_user_id`), snake_case.
- **Code:** variabelen en functies in het Engels, behalve waar ze direct een
  DB-veld spiegelen.
- **UI-teksten:** Nederlands. Bedragen in SRD.
- **Migraties:** altijd via `drizzle-kit generate`, nooit handmatig SQL in de db.
- Geen nieuwe dependencies zonder het even te melden en te motiveren.
- **Elk script dat data wijzigt of verwijdert roept `weigerOpProductie()` aan**
  (`src/db/guard.ts`), als eerste regel. Zonder die regel erodeert de vangrail bij
  het eerste volgende script.

## Werkwijze

Ik bouw in fases (A t/m F in `docs/PLAN.md` sectie 5; de tweede reeks G t/m K
staat in sectie 10). Per sessie doen we één fase.

- Begin een fase met een kort plan van aanpak vóór je code schrijft.
- Aan het eind van een fase: benoem het checkpoint uit het plan en vertel me
  precies welke commando's ik moet draaien om het te verifiëren.
- Werk niet vooruit op een volgende fase, ook niet "alvast even".
- Bij een ontwerpkeuze die het plan niet dekt: vraag het, ga niet gokken.

Voor losse bugs en wijzigingen buiten een fase geldt de route in
`docs/WERKWIJZE.md`: bouwen en testen in de dev-map, committen en pushen, en
**pas deployen als Amresh daar expliciet ja op zegt**. Een push zet niets live;
zeg dat ook als hij ervan uitgaat dat het al draait.

## Omgeving

**Namen.** "InterServer" is de online server (`162.35.176.40`, Ubuntu 24.04) die
`https://tickets.mijnonline.shop` draait. "De laptop" is Amresh' Windows-machine.
Gebruik het woord "VPS" niet: dat verwees zowel naar de server als naar de
werkplek, en dat was precies de verwarring.

**Claude Code draait op InterServer zelf.** Er is geen tweede machine — alleen
twee mappen:

| Map | Wat | Database | Poort |
|---|---|---|---|
| `/home/amresh/ticketsysteem` | **PRODUCTIE** | `ticketsysteem` | 3100 (PM2) |
| `/home/amresh/dev/ticketsysteem` | dev, hier werk je | `ticketsysteem_dev` | 3300 |
| idem, `.env.test` | test | `ticketsysteem_test` | 3200 |

**In de productiemap wordt niet ontwikkeld.** Nooit `npm run dev`, nooit een
seed-script, nooit een losse `npm run build`. Die map krijgt alleen de
deployprocedure uit `infra/DEPLOY.md`, en `git status` hoort daar altijd leeg te
zijn. Werk je aan code, dan is de dev-map de plek.

- **Bij twijfel over waar je zit: `npm run db:omgeving`.** Dat toont database,
  `APP_ENV`, marker en of ze met elkaar kloppen. Doe dit vóór elk db-commando
  waarvan je de uitkomst niet zeker weet.
- Migreren: `db:migrate` (dev), `db:migrate:test`, `db:migrate:prod`. Er is geen
  commando dat "de standaard" database pakt — dat was juist het probleem.
- Amresh werkt op Windows met Git Bash; geef hem commando's die daar werken. Draai
  je zelf iets, dan is dat Ubuntu. Benoem welke van de twee je bedoelt.
- InterServer heeft 1,9 GB RAM. Niet twee builds tegelijk, en laat dev- en
  test-server niet standaard allebei aan staan.
- Leg terminal- en serverstappen uit alsof hij ze voor het eerst doet.
