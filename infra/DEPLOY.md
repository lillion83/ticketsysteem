# Deploy op InterServer

Doel: het ticketsysteem draaien op `https://tickets.mijnonline.shop`, zodat de
scanner op een telefoon werkt. De camera-API eist HTTPS — zonder certificaat
geen scanner.

Opzet: **Caddy** (HTTPS + reverse proxy, poort 443) → **PM2** (de Node-app,
poort 3100). Poort 3100 blijft dicht in de firewall; al het verkeer loopt via
Caddy. Naast webwinkri (3000) en uptime-kuma (3001) op dezelfde server, plus de
test-omgeving (3200) en de dev-map (3300) die niet publiek staan.

## Eenmalig

### 1. DNS (bij Porkbun)

Voeg bij `mijnonline.shop` een record toe:

| Type | Host      | Waarde          | TTL |
| ---- | --------- | --------------- | --- |
| A    | `tickets` | `162.35.176.40` | 600 |

Controleren (vanaf elke machine):

```bash
nslookup tickets.mijnonline.shop 1.1.1.1
```

Pas doorgaan als daar `162.35.176.40` uitkomt. Caddy kan anders geen
certificaat ophalen.

### 2. Firewall

Poort 80 en 443 moeten open staan (80 is nodig voor de certificaatvalidatie):

```bash
sudo ufw status
```

### 3. Caddy: map voor losse siteblokken (vereist sudo)

Zo kan de config aangepast worden zonder root:

```bash
sudo mkdir -p /etc/caddy/sites && sudo chown amresh:amresh /etc/caddy/sites
```

Zet in `/etc/caddy/Caddyfile` deze regel (onderaan volstaat):

```
import /etc/caddy/sites/*.caddy
```

Kopieer daarna het siteblok uit deze repo:

```bash
cp infra/ticketsysteem.caddy /etc/caddy/sites/ticketsysteem.caddy
```

### 4. Productie-omgeving: `.env.production`

Maak in `/home/amresh/ticketsysteem` een `.env.production`. Kopieer
`.env.production.example` en vul de waarden in; dat sjabloon staat in Git en
beschrijft elke variabele.

**Waarom niet meer `.env.local`.** Dat is de enige bestandsnaam die nitro/vite
automatisch inleest én voorrang geeft boven `.env`. Daardoor draaide een
`npm run dev` in deze map met de productie-URL's, de echte mailkey en de
productiedatabase — een testmail ging dan werkelijk de deur uit. Nitro leest
`.env.${mode}`, dus `.env.production` wordt in dev-mode nooit aangeraakt.

Let op:

- **`.env.production` staat apart in `.gitignore`.** De regel `*.local` dekt deze
  naam niet; zonder die regel commit je de mailkey en het DB-wachtwoord.
- **`APP_ENV=production` is verplicht.** Hierop weigeren de seedscripts te draaien
  en hierop controleert `db:migrate:prod` of hij de juiste database heeft.
- **`BETTER_AUTH_URL` moet exact het https-adres zijn.** Staat hier nog
  `localhost`, dan weigert inloggen met `INVALID_ORIGIN`.
- **`TICKET_SECRET` moet gelijk blijven** aan wat gebruikt is bij het uitgeven
  van bestaande tickets. Verandert hij, dan verifieert geen enkele bestaande
  QR-code meer. Dev en test hebben bewust een ánder geheim.
- **`UPLOAD_DIR` is verplicht in productie** en wijst buiten de repo
  (`/home/amresh/ticketsysteem-data/uploads`). De app weigert te starten met een
  relatief pad: een `git clean -xdf` zou de klantdata meenemen.
- `PORT=3100` — moet overeenkomen met de poort in het Caddy-siteblok.

### 4b. Omgevingsmarker op de database

Eenmalig, en **opnieuw na elke restore**:

```bash
sudo -u postgres psql -c "COMMENT ON DATABASE ticketsysteem IS 'app_env=production';"
```

Die comment is de tweede helft van de vangrail: de seedscripts lezen hem en
weigeren op een database die als productie gemarkeerd staat, ook als het
env-bestand iets anders beweert. `pg_dump` neemt de comment **niet** mee, dus na
een restore is hij weg en staat productie onbeschermd. Controleer met
`npm run db:omgeving:prod`.

### 5. Mail: Resend

Transactionele mail loopt via [Resend](https://resend.com) (geen SMS-verificatie
nodig). Eenmalig:

1. Resend-account aanmaken (e-mail of GitHub).
2. Domein `mijnonline.shop` toevoegen in Resend → het geeft SPF/DKIM-records.
   Die als DNS-records bij **Porkbun** toevoegen en op "verified" wachten.
3. Een API-key aanmaken (begint met `re_`) en in `.env.production` als `MAIL_API_KEY`
   zetten, met `MAIL_AFZENDER_EMAIL=tickets@mijnonline.shop`.

Snel testen vóór de DNS rond is: zet tijdelijk
`MAIL_AFZENDER_EMAIL=onboarding@resend.dev` — Resend levert daarmee zonder
domeinverificatie af, maar alleen naar je eigen account-adres.

## Uitrollen (elke keer)

Alles vanuit de productiemap. Ontwikkelen gebeurt hier niet — de code komt via
`origin/main` uit de dev-map of van de laptop.

```bash
cd /home/amresh/ticketsysteem
git status --short
```

`git status` hoort **leeg** te zijn. Staat er iets, dan is er in de productiemap
gewerkt; zoek dat eerst uit in plaats van het weg te gooien.

```bash
git pull && npm ci
```

### Back-up, vóór de migratie

Geen back-up = niet deployen. Drizzle heeft geen down-migraties, dus deze dump
*is* het rollbackmechanisme.

```bash
mkdir -p /home/amresh/backups
set -a; . ./.env.production; set +a
STAMP=$(date +%F-%H%M)
pg_dump "$DATABASE_URL" -Fc -f /home/amresh/backups/ticketsysteem-$STAMP.dump
tar czf /home/amresh/backups/uploads-$STAMP.tgz -C /home/amresh/ticketsysteem-data uploads
pg_restore -l /home/amresh/backups/ticketsysteem-$STAMP.dump | head
```

Die laatste regel is de verificatie: **geen inhoudsopgave = geen back-up**, dan
stop je hier. `-Fc` (custom format) omdat je daarmee selectief kunt terugzetten.

### Migreren en herstarten

```bash
npm run db:omgeving:prod
```

Verwacht `production / ticketsysteem / marker production` en een ✓. Klopt dat
niet, dan niet verder.

```bash
npm run db:migrate:prod
```

Let op het `:prod`. `npm run db:migrate` werkt hier niet meer en dat is opzet: dat
commando viel terug op `.env` en kon zo ongevraagd productie migreren.

```bash
npm run build && pm2 restart ticketsysteem
```

> **Build en restart horen als paar te gaan**, vandaar de `&&` op één regel. De
> build overschrijft de assets in `.output/public/assets/` met nieuwe hashes,
> terwijl de draaiende server HTML blijft uitserveren die naar de óude hashes
> verwijst. Bezoekers krijgen dan `Failed to fetch dynamically imported module`
> tot de herstart. Wil je alleen weten of het bouwt? Doe dat in de dev-map.

Eerste keer starten, of na een wijziging in `cwd`/`node_args` van
`ecosystem.config.cjs`:

```bash
pm2 delete ticketsysteem; pm2 start ecosystem.config.cjs && pm2 save
```

`pm2 restart` neemt een gewijzigde `cwd` of `node_args` **niet** over: de app
draait dan door op de oude waarden en crasht op een onverwacht moment, bijvoorbeeld
bij de volgende reboot. Bij een gewone codewijziging is `pm2 restart` genoeg.

### Rollback

Alleen code (de migratie was leeg of onschuldig):

```bash
git log --oneline -3
git reset --hard <vorige-sha>
npm ci && npm run build && pm2 restart ticketsysteem
```

Code én database:

```bash
pm2 stop ticketsysteem
sudo -u postgres psql -c "DROP DATABASE ticketsysteem;" -c "CREATE DATABASE ticketsysteem OWNER ticket;"
pg_restore -d "$DATABASE_URL" --no-owner /home/amresh/backups/ticketsysteem-<stamp>.dump
sudo -u postgres psql -c "COMMENT ON DATABASE ticketsysteem IS 'app_env=production';"
git reset --hard <vorige-sha> && npm ci && npm run build
pm2 start ecosystem.config.cjs
```

Drie dingen die je hierbij moet weten:

- **Vergeet de `COMMENT`-regel niet.** Die zit niet in de dump. Zonder hem staat
  productie daarna onbeschermd tegen de seedscripts.
- **Een restore gooit alles weg wat na de dump is verkocht of gescand.** Op een
  verkoopdag is vooruit repareren bijna altijd beter dan terugrollen. Alleen bij
  een kapotte migratie is restore de juiste zet.
- Bewaar de laatste tien dumps; ruim oudere op.

Caddy herladen na een configwijziging (geen root nodig — praat met de lokale
beheerpoort):

```bash
caddy reload --config /etc/caddy/Caddyfile
```

## Controleren

```bash
pm2 list
```

```bash
curl -sI https://tickets.mijnonline.shop/login | head -3
```

Verwacht `HTTP/2 200`. Open daarna op een telefoon
`https://tickets.mijnonline.shop`, log in, en test de scanner: de camera hoort
nu om toestemming te vragen.

Logs bij problemen:

```bash
pm2 logs ticketsysteem --lines 50
```

```bash
sudo journalctl -u caddy -n 50
```

## De drie omgevingen

Alles staat op InterServer, maar in gescheiden mappen met eigen databases. Dit was
tot 30 juli 2026 níet zo: dev en productie deelden één map én één database.

| | productie | dev | test |
|---|---|---|---|
| Map | `/home/amresh/ticketsysteem` | `/home/amresh/dev/ticketsysteem` | idem dev-map |
| Database | `ticketsysteem` | `ticketsysteem_dev` | `ticketsysteem_test` |
| Poort | 3100 (PM2, via Caddy) | 3300 | 3200 |
| Env-bestand | `.env.production` | `.env` | `.env.test` |
| `APP_ENV` | `production` | `development` | `test` |
| Uploads | `/home/amresh/ticketsysteem-data/uploads` | `<dev-map>/uploads` | `<dev-map>/uploads-test` |
| Mail | echte Resend-key | leeg → console | leeg → console |
| `TICKET_SECRET` | het echte | eigen, ánder geheim | eigen, ánder geheim |

Dev en test hebben bewust een ander `TICKET_SECRET`: met hetzelfde geheim zou een
in dev aangemaakt ticket aan de echte deur groen scannen.

3300 en 3200 staan niet in Caddy en niet open in de firewall. Om ze van de laptop
te bekijken, tunnel je:

```bash
ssh -L 3300:localhost:3300 -L 3200:localhost:3200 amresh@162.35.176.40
```

Daarna in de browser op de laptop `http://localhost:3300`.

**In de productiemap wordt niet ontwikkeld.** Geen `npm run dev`, geen seed-script,
geen losse `npm run build`. De vangrails vangen een vergissing op — de seedscripts
weigeren op een als productie gemarkeerde database, en `.env` bestaat daar niet —
maar ze zijn het net, niet de regel.
