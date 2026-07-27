# Test-database

Een aparte database (`ticketsysteem_test`) los van de dev-database
(`ticketsysteem`), zodat je vrij kunt seeden en experimenteren zonder je
dev-data te vervuilen. Zelfde Postgres-server, andere database.

> Dit is **alleen** een aparte database + env + scripts. Er is (nog) geen
> testframework; je draait de app of de migraties handmatig tegen de test-DB.

## Hoe het werkt

- **`.env.test`** bevat de test-config: `DATABASE_URL` wijst naar
  `ticketsysteem_test`, en de app draait op poort **3200** (via `PORT` in
  `.env.test`, zodat de testomgeving náást de dev-server op 3000 — en op de VPS
  ook náást productie op 3100 — kan draaien). Dit bestand is gitignored;
  `.env.test.example` is het gedeelde sjabloon.
- **`drizzle.config.ts`** laadt standaard `.env`, maar kijkt naar de omgevings-
  variabele `ENV_FILE`. `db:migrate:test` zet `ENV_FILE=.env.test`, waardoor de
  migraties tegen de test-DB draaien.
- De seed- en dev-scripts met `:test` gebruiken `--env-file=.env.test`.

## Eenmalige setup

1. **Maak de database aan.** De app-gebruiker (`ticket`) mag zelf geen databases
   aanmaken, dus dit gaat als Postgres-superuser:

   ```bash
   sudo -u postgres psql -c "CREATE DATABASE ticketsysteem_test OWNER ticket;"
   ```

2. **Maak `.env.test`** (als die er nog niet is): kopieer `.env.test.example`
   naar `.env.test` en vul de waarden in (mag dezelfde geheimen als `.env`).

3. **Draai de migraties** tegen de test-DB:

   ```bash
   npm run db:migrate:test
   ```

4. **Seed** (optioneel): demo-data en/of het admin-account.

   ```bash
   npm run db:seed:test
   npm run db:seed-admin:test
   ```

## De app tegen de test-DB draaien

```bash
npm run dev:test
```

Draait op <http://localhost:3200> tegen `ticketsysteem_test`. De gewone
`npm run dev` (poort 3000) blijft ongewijzigd op de dev-database.

## Scripts (overzicht)

| Script                       | Doet                                 |
| ---------------------------- | ------------------------------------ |
| `npm run dev:test`           | App op poort 3200 tegen de test-DB   |
| `npm run db:migrate:test`    | Migraties uitvoeren op de test-DB    |
| `npm run db:seed:test`       | Demo-data seeden in de test-DB       |
| `npm run db:seed-admin:test` | Admin-account aanmaken in de test-DB |

## Schoon beginnen

Wil je de test-DB helemaal leegmaken en opnieuw opbouwen:

```bash
sudo -u postgres psql -c "DROP DATABASE ticketsysteem_test;"
sudo -u postgres psql -c "CREATE DATABASE ticketsysteem_test OWNER ticket;"
npm run db:migrate:test
```

## Let op

- **Poort van Postgres:** op de VPS draait Postgres op `5432`. Op een laptop kan
  dat afwijken (bv. `5433`); pas dan de poort in `DATABASE_URL` in `.env.test`
  aan.
- De test-DB deelt de Postgres-server met dev; het is puur een aparte database,
  geen aparte server.
