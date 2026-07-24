# Deploy op de VPS

Doel: het ticketsysteem draaien op `https://tickets.mijnonline.shop`, zodat de
scanner op een telefoon werkt. De camera-API eist HTTPS — zonder certificaat
geen scanner.

Opzet: **Caddy** (HTTPS + reverse proxy, poort 443) → **PM2** (de Node-app,
poort 3100). Poort 3100 blijft dicht in de firewall; al het verkeer loopt via
Caddy. Naast webwinkri (3000) en uptime-kuma (3001) op dezelfde server.

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

### 4. Productie-omgeving: `.env.local`

Maak in de projectmap op de VPS een `.env.local` (staat in `.gitignore` via
`*.local`, komt dus nooit in Git):

```
DATABASE_URL=postgresql://...
TICKET_SECRET=...
BETTER_AUTH_SECRET=...
BETTER_AUTH_URL=https://tickets.mijnonline.shop
PUBLIC_BASE_URL=https://tickets.mijnonline.shop
BREVO_API_KEY=...
BREVO_AFZENDER_NAAM=Ticketsysteem
BREVO_AFZENDER_EMAIL=...
PORT=3100
```

Let op:

- **`BETTER_AUTH_URL` moet exact het https-adres zijn.** Staat hier nog
  `localhost`, dan weigert inloggen met `INVALID_ORIGIN`.
- **`TICKET_SECRET` moet gelijk blijven** aan wat gebruikt is bij het uitgeven
  van bestaande tickets. Verandert hij, dan verifieert geen enkele bestaande
  QR-code meer.
- `PORT=3100` — moet overeenkomen met de poort in het Caddy-siteblok.

## Uitrollen (elke keer)

```bash
git pull
```

```bash
npm ci
```

```bash
npm run db:migrate
```

```bash
npm run build
```

Eerste keer starten:

```bash
pm2 start ecosystem.config.cjs && pm2 save
```

Daarna volstaat:

```bash
pm2 restart ticketsysteem
```

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

## Aandachtspunt: welke database?

De productie-app en de ontwikkelomgeving wijzen nu naar dezelfde Postgres op
deze VPS. Zolang er nog getest wordt, komen testtickets dus in dezelfde
database als de echte verkoop. Voor het echte event: een aparte database
aanmaken en `DATABASE_URL` in `.env.local` daarheen wijzen.
