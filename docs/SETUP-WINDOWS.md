# Lokale ontwikkelomgeving op Windows

Van een schone Windows-installatie naar een draaiende dev-server. Volg de
stappen op volgorde; elke stap eindigt met een controle die moet slagen voor je
verdergaat.

Aan het eind heb je:

| Omgeving   | URL                     | Database                |
| ---------- | ----------------------- | ----------------------- |
| dev        | <http://localhost:3000> | `ticketsysteem`         |
| test       | <http://localhost:3200> | `ticketsysteem_test`    |
| productie  | de VPS                  | staat los, blijft draaien |

De VPS wordt hierdoor niet geraakt. Alles hieronder is lokaal.

---

## 1. Git for Windows installeren

Download en installeer: <https://git-scm.com/download/win>

Klik de installer door met de standaardinstellingen. Twee schermen zijn wel van
belang:

- **"Adjusting your PATH environment"** → laat staan op _"Git from the command
  line and also from 3rd-party software"_.
- **"Configuring the line ending conversions"** → kies _"Checkout as-is, commit
  Unix-style line endings"_. De repo staat via `.gitattributes` op LF; deze
  keuze voorkomt dat elk bestand als gewijzigd verschijnt.

Je krijgt hiermee **Git Bash**, de terminal die we in dit project gebruiken. Open
die via het Startmenu (zoek op "Git Bash"). Alle commando's hieronder tik je daar,
niet in PowerShell of CMD — sommige npm-scripts gebruiken Unix-syntaxis die
alleen in Git Bash werkt.

Controle:

```bash
git --version
```

## 2. Node.js 22 installeren

Download de **LTS-versie van Node 22** (Windows Installer, .msi):
<https://nodejs.org/en/download>

Klik door met de standaardinstellingen. De VPS draait Node 22, dus door hier ook
22 te nemen krijg je geen verrassingen bij het bouwen.

Sluit Git Bash na de installatie en open hem opnieuw, anders kent hij `node` nog
niet.

Controle — beide moeten een versienummer geven, en node moet met `v22.` beginnen:

```bash
node -v && npm -v
```

## 3. PostgreSQL 16 installeren

Download de Windows-installer van EDB (kies **versie 16**, dat is wat de VPS
draait): <https://www.enterprisedb.com/downloads/postgres-postgresql-downloads>

Tijdens de installatie:

- **Components:** laat _PostgreSQL Server_, _pgAdmin 4_ en vooral **_Command
  Line Tools_** aangevinkt. Zonder die laatste heb je geen `psql` en `createdb`.
- **Password:** kies een wachtwoord voor de superuser `postgres` en schrijf het
  op. Je hebt het zo nodig.
- **Port:** laat op **5432**. Op een schone machine is die vrij.
- **Locale:** standaard laten.
- De Stack Builder aan het eind mag je overslaan.

### psql bereikbaar maken in Git Bash

De installer zet de Postgres-tools niet in je PATH. Voeg ze toe aan je Git Bash
profiel:

```bash
echo 'export PATH="$PATH:/c/Program Files/PostgreSQL/16/bin"' >> ~/.bashrc
```

Sluit Git Bash en open hem opnieuw.

Controle:

```bash
psql --version
```

Krijg je "command not found", kijk dan in de Verkenner of het pad
`C:\Program Files\PostgreSQL\16\bin` echt bestaat — staat er een ander
versienummer, pas het commando hierboven daarop aan.

### Databasegebruiker en databases aanmaken

Log in als superuser. Hij vraagt om het `postgres`-wachtwoord uit de installatie:

```bash
psql -U postgres -h localhost
```

Je krijgt nu een `postgres=#` prompt. Plak deze vier regels (het wachtwoord
`ticket_lokaal` mag je vervangen, maar onthoud het — het moet straks in
`DATABASE_URL`):

```sql
CREATE USER ticket WITH PASSWORD 'ticket_lokaal';
CREATE DATABASE ticketsysteem OWNER ticket;
CREATE DATABASE ticketsysteem_test OWNER ticket;
\q
```

Die laatste `\q` sluit psql af.

Controle — dit moet zonder foutmelding een lege prompt geven:

```bash
psql "postgresql://ticket:ticket_lokaal@localhost:5432/ticketsysteem" -c "select 1;"
```

## 4. De repo binnenhalen

Kies een map zonder spaties in het pad. Bijvoorbeeld:

```bash
mkdir -p ~/projecten && cd ~/projecten
```

Clonen via HTTPS (er opent een browservenster om met GitHub in te loggen; Git
for Windows onthoudt dat daarna):

```bash
git clone https://github.com/lillion83/ticketsysteem.git
```

Ga de map in — hier draai je vanaf nu alles:

```bash
cd ~/projecten/ticketsysteem
```

## 5. Dependencies installeren

`npm ci` installeert exact de versies uit `package-lock.json`. Dit duurt de
eerste keer een paar minuten.

```bash
npm ci
```

## 6. De env-bestanden maken

`.env` en `.env.test` staan bewust **niet** in GitHub (er staan geheimen in), dus
die maak je zelf. De `.example`-bestanden in de repo zijn de sjablonen.

```bash
cp .env.example .env
cp .env.test.example .env.test
```

Open beide in een editor (`notepad .env` werkt, of gebruik VS Code) en pas aan:

**In `.env`:**

```
DATABASE_URL=postgresql://ticket:ticket_lokaal@localhost:5432/ticketsysteem
TICKET_SECRET=<lang willekeurig geheim>
BETTER_AUTH_SECRET=<lang willekeurig geheim>
BETTER_AUTH_URL=http://localhost:3000
PUBLIC_BASE_URL=http://localhost:3000
MAIL_API_KEY=
ADMIN_EMAIL=lillion83@gmail.com
ADMIN_PASSWORD=<wachtwoord waarmee je lokaal inlogt>
ADMIN_NAME=Amresh
```

**In `.env.test`** hetzelfde, maar met `ticketsysteem_test` als database en
poort 3200 in `BETTER_AUTH_URL` en `PUBLIC_BASE_URL`.

Twee dingen om te weten:

- **`MAIL_API_KEY` leeg laten.** Dan wordt uitgaande mail alleen naar de console
  gelogd in plaats van echt verstuurd — precies wat je lokaal wilt.
- **De geheimen mogen anders zijn dan op de VPS**, en dat horen ze ook te zijn.
  Gevolg: ticketcodes uit productie zijn lokaal ongeldig, en andersom. Dat klopt
  en is de bedoeling — het zijn gescheiden werelden met gescheiden databases.

Nieuwe geheimen genereren kan met:

```bash
openssl rand -hex 32
```

## 7. Database vullen

Migraties draaien (bouwt alle tabellen op):

```bash
npm run db:migrate
```

Demo-data en je adminaccount erin zetten:

```bash
npm run db:seed && npm run db:seed-admin
```

Hetzelfde voor de testomgeving:

```bash
npm run db:migrate:test && npm run db:seed:test && npm run db:seed-admin:test
```

## 8. Starten

```bash
npm run dev
```

Open <http://localhost:3000>. Inloggen op `/admin` doe je met `ADMIN_EMAIL` en
`ADMIN_PASSWORD` uit je `.env`.

De testomgeving draai je in een **tweede** Git Bash-venster, naast de dev-server:

```bash
npm run dev:test
```

Die luistert op <http://localhost:3200> en praat met de test-database.

Stoppen doe je met `Ctrl+C` in het venster waar de server draait.

---

## Veelvoorkomende problemen

**`psql: command not found`**
Stap 3 overgeslagen of het versienummer in het pad klopt niet. Controleer de map
`C:\Program Files\PostgreSQL\` en pas de `export PATH`-regel in `~/.bashrc` aan.

**`ECONNREFUSED ::1:5432` of `connection refused`**
De Postgres-service draait niet. Start hem via het Startmenu → "Services" →
zoek `postgresql-x64-16` → rechtermuisknop → Start.

**`password authentication failed for user "ticket"`**
Het wachtwoord in `DATABASE_URL` komt niet overeen met wat je bij `CREATE USER`
hebt ingetypt. Opnieuw zetten kan met:
`psql -U postgres -h localhost -c "ALTER USER ticket WITH PASSWORD 'ticket_lokaal';"`

**Postgres luistert op 5433 in plaats van 5432**
Gebeurt als er nog resten van een oude installatie op de machine staan. Kijk met
`psql -U postgres -h localhost -p 5433 -c "select 1;"` of dat lukt, en zet dan
overal `5433` in je `DATABASE_URL`.

**`Port 3000 is already in use`**
Er draait nog een oude dev-server. Sluit het andere Git Bash-venster, of gebruik
`npm run dev:test` op 3200.

**Elk bestand lijkt gewijzigd na het clonen**
Line endings. Zet het om met:
`git config --global core.autocrlf input` en clone daarna opnieuw.

**Een commando werkt niet, met een rare foutmelding over `ENV_FILE`**
Je zit in PowerShell of CMD in plaats van Git Bash. De `:test`-scripts gebruiken
Unix-syntaxis. Open Git Bash.

---

## Dagelijks gebruik hierna

Werk ophalen dat op de VPS is gemaakt:

```bash
git pull
```

Zijn er na een `git pull` nieuwe dependencies of migraties, draai dan:

```bash
npm ci && npm run db:migrate
```

Zie `docs/TESTDB.md` voor het werken met de test-database, en `docs/PLAN.md`
voor de scope en het datamodel.
