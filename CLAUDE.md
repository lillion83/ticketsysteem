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
- Brevo voor transactionele mail
- Deploy: VPS met Caddy + PM2

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

## Werkwijze

Ik bouw in fases (A t/m F, zie `docs/PLAN.md` sectie 5). Per sessie doen we
één fase.

- Begin een fase met een kort plan van aanpak vóór je code schrijft.
- Aan het eind van een fase: benoem het checkpoint uit het plan en vertel me
  precies welke commando's ik moet draaien om het te verifiëren.
- Werk niet vooruit op een volgende fase, ook niet "alvast even".
- Bij een ontwerpkeuze die het plan niet dekt: vraag het, ga niet gokken.

## Omgeving

- Ik werk op Windows met Git Bash. Geef commando's die daar werken.
- De VPS draait Ubuntu 24.04.
- Leg terminal- en serverstappen uit alsof ik ze voor het eerst doe.
