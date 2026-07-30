# Test-database

Een aparte database (`ticketsysteem_test`) los van de dev-database
(`ticketsysteem_dev`), zodat je vrij kunt seeden en experimenteren zonder je
dev-data te vervuilen. Zelfde Postgres-server, andere database.

> **De database `ticketsysteem` — zonder achtervoegsel — is PRODUCTIE.** Dev is
> `ticketsysteem_dev`, test is `ticketsysteem_test`. Tot 30 juli 2026 was
> `ticketsysteem` óók de dev-database; kom je die aanname nog ergens tegen, dan is
> die tekst verouderd.

> Dit is **alleen** een aparte database + env + scripts. Er is (nog) geen
> testframework; je draait de app of de migraties handmatig tegen de test-DB.

## Hoe het werkt

- **`.env.test`** bevat de test-config: `DATABASE_URL` wijst naar
  `ticketsysteem_test`, `APP_ENV=test`, en de app draait op poort **3200** (via
  `PORT` in `.env.test`, zodat de testomgeving náást de dev-server — en op
  InterServer ook náást productie op 3100 — kan draaien). Dit bestand is
  gitignored; `.env.test.example` is het gedeelde sjabloon.
- **Drie drizzle-configs**, elk met een eigen env-bestand én een verwachte
  omgeving:

  | Config | Env-bestand | Verwacht `APP_ENV` | Script |
  |---|---|---|---|
  | `drizzle.config.ts` | `.env` | `development` | `db:migrate` |
  | `drizzle.config.test.ts` | `.env.test` | `test` | `db:migrate:test` |
  | `drizzle.config.prod.ts` | `.env.production` | `production` | `db:migrate:prod` |

  Alle drie bouwen op `drizzle.shared.ts`, dat het env-bestand zelf parseert en
  **hard faalt** als het bestand ontbreekt of als `APP_ENV` niet klopt. Zo kan één
  verkeerd commando niet meer de verkeerde database migreren.

  Bewust losse configbestanden in plaats van `ENV_FILE=.env.test` vooraf: npm
  draait scripts op Windows via cmd.exe — ook vanuit Git Bash — en cmd kent die
  prefix niet. Met `--config` werkt hetzelfde script op Windows en op InterServer.
  De oude `ENV_FILE`-fallback is weg: die viel terug op `.env` en kon zo ongevraagd
  productie raken.
- De seed- en dev-scripts met `:test` gebruiken `--env-file=.env.test`.
- **`npm run db:omgeving:test`** vertelt je waar je zit: database, `APP_ENV`,
  marker en of ze met elkaar kloppen.

## Eenmalige setup

1. **Maak de database aan.** De app-gebruiker (`ticket`) mag zelf geen databases
   aanmaken, dus dit gaat als Postgres-superuser:

   ```bash
   sudo -u postgres psql -c "CREATE DATABASE ticketsysteem_test OWNER ticket;"
   ```

2. **Zet de omgevingsmarker.** Zonder deze regel weigeren de seedscripts: een
   database zonder marker kan voor hen ook productie zijn.

   ```bash
   sudo -u postgres psql -c "COMMENT ON DATABASE ticketsysteem_test IS 'app_env=test';"
   ```

3. **Maak `.env.test`** (als die er nog niet is): kopieer `.env.test.example`
   naar `.env.test` en vul de waarden in. `APP_ENV=test` is verplicht. De geheimen
   mogen afwijken van `.env`; `TICKET_SECRET` hoort te verschillen van productie.

4. **Draai de migraties** tegen de test-DB:

   ```bash
   npm run db:migrate:test
   ```

5. **Seed** (optioneel): demo-data en/of het admin-account.

   ```bash
   npm run db:seed:test
   npm run db:seed-admin:test
   ```

## De app tegen de test-DB draaien

```bash
npm run dev:test
```

Draait op <http://localhost:3200> tegen `ticketsysteem_test`. De gewone
`npm run dev` blijft op de dev-database (poort uit `PORT` in `.env`: 3000 op de
laptop, 3300 in de dev-map op InterServer).

## Scripts (overzicht)

| Script                       | Doet                                     |
| ---------------------------- | ---------------------------------------- |
| `npm run dev:test`           | App op poort 3200 tegen de test-DB       |
| `npm run db:migrate:test`    | Migraties uitvoeren op de test-DB        |
| `npm run db:migrate:prod`    | Migraties op productie (alleen prod-map) |
| `npm run db:seed:test`       | Demo-data seeden in de test-DB           |
| `npm run db:seed-admin:test` | Admin-account aanmaken in de test-DB     |
| `npm run db:omgeving`        | Waar wijst mijn config heen? (dev)       |
| `npm run db:omgeving:test`   | Idem, test                               |
| `npm run db:omgeving:prod`   | Idem, productie                          |

## Schoon beginnen

Wil je de test-DB helemaal leegmaken en opnieuw opbouwen:

```bash
sudo -u postgres psql -c "DROP DATABASE ticketsysteem_test;"
sudo -u postgres psql -c "CREATE DATABASE ticketsysteem_test OWNER ticket;"
sudo -u postgres psql -c "COMMENT ON DATABASE ticketsysteem_test IS 'app_env=test';"
npm run db:migrate:test
```

Die `COMMENT`-regel niet vergeten: een verse `CREATE DATABASE` heeft geen marker,
en dan weigeren de seedscripts. Hetzelfde geldt na een `pg_restore` — `pg_dump`
neemt de comment niet mee.

## Productiedata in dev of test zetten

Handig om een dashboardwijziging op echte data te testen. Zelfde Postgres-server,
dus dit gaat in seconden:

```bash
pg_dump "<prod-url>" -Fc -f /tmp/nu.dump
pg_restore -d "<dev-url>" --clean --no-owner /tmp/nu.dump
sudo -u postgres psql -c "COMMENT ON DATABASE ticketsysteem_dev IS 'app_env=development';"
```

Twee dingen om te weten:

- `--clean` gooit ook de omgevingsmarker weg; vandaar de derde regel. Sla je die
  over, dan weigeren de seedscripts op je eigen dev-database.
- **Teruggezette ticketcodes verifiëren niet in dev**, want dev heeft een ander
  `TICKET_SECRET`. Dat is opzet: anders zou een dev-ticket aan de echte deur groen
  scannen.

## Let op

- **Poort van Postgres:** op InterServer draait Postgres op `5432`. Op een laptop
  kan dat afwijken (bv. `5433`); pas dan de poort in `DATABASE_URL` in `.env.test`
  aan.
- De test-DB deelt de Postgres-server met dev; het is puur een aparte database,
  geen aparte server.
