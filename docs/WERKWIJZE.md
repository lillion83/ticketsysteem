# Werkwijze: van bug naar live

Wat je doet als je een bug vindt of iets wil wijzigen. Dit document beschrijft de
**route**; de precieze deploy-commando's staan in `infra/DEPLOY.md` en worden hier
niet herhaald, zodat er één bron van waarheid is.

Het belangrijkste in één regel: **een `git push` zet niets live.** Deployen is een
aparte, expliciete stap die je zelf geeft.

## Wie werkt waar

| Plek | Rol |
| --- | --- |
| De laptop (Windows, Git Bash) | bug vinden, kleine wijzigingen, testen |
| `/home/amresh/dev/ticketsysteem` op InterServer (poort 3300) | waar Claude werkt |
| `/home/amresh/ticketsysteem` op InterServer | **alleen productie**, krijgt alleen een deploy |

De laptop en de dev-map zijn gelijkwaardige werkplekken; ze praten met elkaar via
`origin/main`. Productie haalt daar alleen op. Zie `infra/DEPLOY.md` voor de
volledige omgevingsmatrix.

---

## 1. Bug melden

Wat het snelst tot een oplossing leidt:

- **In welke omgeving.** `tickets.mijnonline.shop` is productie,
  `test-tickets.mijnonline.shop` is test, poort 3300 is dev. Een bug op productie
  met echte tickets is een ander gesprek dan een bug op testdata.
- **Waar** je was: de URL of de pagina.
- **Wat** je deed, wat je verwachtte, wat er gebeurde.
- **Met welke rol** je was ingelogd (admin, organisator of koper). De drie
  dashboards zijn andere code: `/platform`, `/admin` en `/mijn-ticket`.
- Bij een foutmelding in de browser: de melding zelf. Bij iets dat op de server
  misgaat: `pm2 logs ticketsysteem --lines 30`.

## 2. Bouwen en testen in dev

Nooit in de productiemap. Standaard gaat dit in de dev-map tegen
`ticketsysteem_dev` op poort 3300.

Meekijken vanaf de laptop gaat via een tunnel, want 3300 staat niet open op
internet:

```bash
ssh -L 3300:localhost:3300 amresh@162.35.176.40
```

Laat dat venster open staan en open `http://localhost:3300` in je browser.

**Gaat het om de scanner of iets op een telefoon**, gebruik dan de
test-omgeving in plaats van dev: de camera-API eist https, en dat heeft alleen
`test-tickets.mijnonline.shop`. Starten in de dev-map:

```bash
npm run dev:test
```

Daarna <https://test-tickets.mijnonline.shop> (gebruiker `amresh`, wachtwoord
buiten Git). Staat de server uit, dan geeft Caddy een 502.

> Laat dev (3300) en test (3200) niet standaard allebei aan staan. InterServer
> heeft 1,9 GB RAM; start wat je nodig hebt en stop het daarna.

## 3. Raakt de wijziging de database?

Dan hoort er een migratie bij. Altijd genereren, nooit met de hand SQL in de
database:

```bash
npm run db:generate    # maakt drizzle/NNNN_*.sql uit src/db/schema.ts
npm run db:migrate     # voert die uit op ticketsysteem_dev
```

Dat `.sql`-bestand gaat mee in de commit, en op productie draait later exact
hetzelfde bestand. Daarom is dit het moment waarop je een migratie leert
vertrouwen: draait hij hier schoon, dan verrast hij je straks niet.

## 4. Committen en pushen

Daarna staat het op GitHub — en nog niet live. Op de andere werkplek ophalen:

```bash
git pull
```

Bij nieuwe dependencies of migraties erna:

```bash
npm ci && npm run db:migrate
```

Trek altijd eerst op vóór je zelf begint, anders krijg je een merge die je niet
nodig had.

## 5. Deployen

Dit gebeurt niet automatisch omdat de code klaar is — het is jouw beslissing.
De procedure staat in **`infra/DEPLOY.md`**, sectie "Uitrollen (elke keer)". In
grote lijnen:

1. `git status` in de productiemap moet leeg zijn.
2. `git pull && npm ci`
3. **Back-up** — geen back-up, niet deployen. Het script staat buiten de repo:
   `/home/amresh/backup-scripts/app-backup.sh`.
4. `npm run db:omgeving:prod` als controle.
5. `npm run db:migrate:prod`, dan `npm run build && pm2 restart ticketsysteem`.

Let op het `:prod`. `npm run db:migrate` werkt daar niet meer, en dat is opzet.

## 6. Verifiëren

- De pagina waar de bug zat, op productie.
- `pm2 logs ticketsysteem --lines 30` op verse fouten.
- Bij een migratie: kijk of de data er nog is zoals verwacht.

Een `ENOENT ... /assets/...js` in het errorlog van vlak vóór de herstart is oud
(een browsertabblad met de vorige assets), geen serverfout.

## Als het misgaat

Alleen de code stuk? Terug naar de vorige commit — zie het rollbackpad in
`infra/DEPLOY.md`. Ook de database stuk? Dan de dump terugzetten, **inclusief de
`COMMENT ON DATABASE`-regel**: die zit niet in de dump, en zonder hem staat
productie daarna onbeschermd tegen de seed-scripts.

Eén nuance die op een verkoopdag telt: **een restore gooit alles weg wat sinds de
dump is verkocht of gescand.** Vooruit repareren is dan bijna altijd beter.
Terugzetten is voor een kapotte migratie, niet voor een lelijke bug.

## Wat nu bewust niet meer kan

- **Seeden of wachtwoorden resetten op productie.** `db:seed`, `db:seed-admin` en
  `db:reset-admin-password` weigeren daar (`src/db/guard.ts`). Moet er echt data in
  productie gewijzigd worden, dan is dat handwerk met `psql` en een dump ervoor —
  bewust ongemakkelijk.
- **Ontwikkelen in de productiemap.** Daar staat geen `.env`, dus `npm run dev` en
  `npm run db:migrate` falen met een melding.
- **Een dev- of testserver met de echte mailkey of een productie-URL.** De app
  weigert dan te starten (`src/lib/env-assert.ts`), want anders gaat er echte mail
  uit met werkende productielinks.

Bij twijfel over waar je zit, in welke map dan ook:

```bash
npm run db:omgeving
```

Dat toont database, `APP_ENV`, de marker op de database en of die twee met elkaar
kloppen.
