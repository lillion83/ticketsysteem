# Lokale ontwikkelomgeving op Windows

Van een schone Windows-installatie naar een draaiende dev-server. Volg de
stappen op volgorde; elke stap eindigt met een controle die moet slagen voor je
verdergaat.

Aan het eind heb je:

| Omgeving  | URL                     | Database             | `APP_ENV`     |
| --------- | ----------------------- | -------------------- | ------------- |
| dev       | <http://localhost:3000> | `ticketsysteem_dev`  | `development` |
| test      | <http://localhost:3200> | `ticketsysteem_test` | `test`        |

**Productie staat op InterServer en wordt hierdoor niet geraakt.** Alles hieronder
is lokaal, op je eigen laptop, met eigen databases en eigen geheimen.

> De database die alleen `ticketsysteem` heet — zonder achtervoegsel — is de
> **productiedatabase op InterServer**. Op je laptop bestaat die naam niet; jij
> gebruikt `ticketsysteem_dev` en `ticketsysteem_test`. Zo betekent de naam overal
> hetzelfde en kun je de twee nooit verwarren.

Waar wordt er gewerkt? Op drie plekken, in twee rollen:

| Plek | Rol |
| --- | --- |
| Deze laptop | ontwikkelen en testen |
| `/home/amresh/dev/ticketsysteem` op InterServer | ontwikkelen en testen (waar Claude werkt) |
| `/home/amresh/ticketsysteem` op InterServer | **alleen productie**, krijgt alleen een deploy |

De laptop en de dev-map op InterServer zijn gelijkwaardig en praten met elkaar via
`origin/main` op GitHub. Productie haalt daar alleen op — zie `infra/DEPLOY.md`.

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

Klik door met de standaardinstellingen. InterServer draait Node 22, dus door hier ook
22 te nemen krijg je geen verrassingen bij het bouwen.

Sluit Git Bash na de installatie en open hem opnieuw, anders kent hij `node` nog
niet.

Controle — beide moeten een versienummer geven, en node moet met `v22.` beginnen:

```bash
node -v && npm -v
```

## 3. PostgreSQL 16 installeren

Download de Windows-installer van EDB (kies **versie 16**, dat is wat InterServer
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

Je krijgt nu een `postgres=#` prompt. Plak deze regels (het wachtwoord
`ticket_lokaal` mag je vervangen, maar onthoud het — het moet straks in
`DATABASE_URL`):

```sql
CREATE USER ticket WITH PASSWORD 'ticket_lokaal';
CREATE DATABASE ticketsysteem_dev OWNER ticket;
CREATE DATABASE ticketsysteem_test OWNER ticket;
COMMENT ON DATABASE ticketsysteem_dev IS 'app_env=development';
COMMENT ON DATABASE ticketsysteem_test IS 'app_env=test';
\q
```

Die laatste `\q` sluit psql af.

De twee `COMMENT`-regels zijn geen bijzaak: de seed-scripts lezen die marker en
**weigeren te draaien op een database zonder marker**, omdat onbekend voor hen niet
hetzelfde is als veilig. Sla je ze over, dan krijg je straks bij `npm run db:seed`
een melding die je hierheen terugstuurt.

Had je al een database `ticketsysteem` op je laptop van de oude opzet? Die kun je
opruimen met `DROP DATABASE ticketsysteem;` — die naam is nu voorbehouden aan
productie op InterServer.

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
APP_ENV=development
PORT=3000
DATABASE_URL=postgresql://ticket:ticket_lokaal@localhost:5432/ticketsysteem_dev
UPLOAD_DIR=./uploads
TICKET_SECRET=<lang willekeurig geheim>
BETTER_AUTH_SECRET=<lang willekeurig geheim>
BETTER_AUTH_URL=http://localhost:3000
PUBLIC_BASE_URL=http://localhost:3000
MAIL_API_KEY=
ADMIN_EMAIL=lillion83@gmail.com
ADMIN_PASSWORD=<wachtwoord waarmee je lokaal inlogt>
ADMIN_NAME=Amresh
```

**In `.env.test`** hetzelfde, maar met `APP_ENV=test`, `ticketsysteem_test` als
database, `PORT=3200`, poort 3200 in `BETTER_AUTH_URL` en `PUBLIC_BASE_URL`, en
`UPLOAD_DIR=./uploads-test`.

Vier dingen om te weten:

- **`APP_ENV` is verplicht.** Zonder die regel start de app niet en weigeren de
  migraties. Hij vertelt elk script in welke omgeving het zit, zodat niets per
  ongeluk op productie uitkomt.
- **`PORT` bepaalt de poort** van `npm run dev`. Vroeger stond die vast op 3000 in
  het script; nu komt hij uit het env-bestand, zodat dezelfde code op de laptop
  (3000) en in de dev-map op InterServer (3300) werkt.
- **`MAIL_API_KEY` leeg laten.** Dan wordt uitgaande mail alleen naar de console
  gelogd in plaats van echt verstuurd — precies wat je lokaal wilt. Zet je hier
  wél een echte key, dan weigert de app te starten: buiten productie mag geen
  echte mail de deur uit.
- **De geheimen mogen anders zijn dan op InterServer**, en dat horen ze ook te
  zijn. Gevolg: ticketcodes uit productie zijn lokaal ongeldig, en andersom. Dat
  klopt en is de bedoeling — anders zou een lokaal aangemaakt testticket aan de
  echte deur groen scannen.

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

**`'X' is not recognized as an internal or external command`**
Een npm-script probeert een omgevingsvariabele vooraf te zetten
(`X=... commando`). Dat werkt niet op Windows: npm draait scripts via `cmd.exe`,
óók als jij in Git Bash zit. Draai het commando dan rechtstreeks in Git Bash
(zonder `npm run`, met `npx` ervoor), en meld het — het script hoort
platform-onafhankelijk gemaakt te worden.

**`psql -c "..."` voert de query niet uit**
Op deze installatie wordt het argument genegeerd ("extra command-line argument
ignored") en opent psql gewoon een sessie. Gebruik in plaats daarvan:
`echo "\dt" | psql "<url>"`.

**`WARNING: Console code page (437) differs from Windows code page (1252)`**
Onschuldig. Gaat alleen over hoe accenttekens in psql-uitvoer worden getoond.

**`db:seed is geweigerd: deze database heeft geen omgevingsmarker`**
De vangrail doet zijn werk: hij weet niet of dit productie is. Zet de marker één
keer (zie stap 5), en kijk met `npm run db:omgeving` of het klopt.

**`.env hoort bij een development-omgeving, maar APP_ENV is ...`**
Het env-bestand en het script horen niet bij elkaar. `db:migrate` hoort bij `.env`,
`db:migrate:test` bij `.env.test`. Controleer de `APP_ENV`-regel bovenaan.

**`Omgevingsfout: APP_ENV is niet gezet`**
Je `.env` komt uit de oude opzet. Voeg `APP_ENV=development` toe (en `PORT` en
`UPLOAD_DIR`, zie stap 6) of begin opnieuw vanaf `.env.example`.

**`Port 3000 is already in use`**
Iets anders draait er al. De poort komt nu uit `PORT` in je `.env`; zet die op een
vrije waarde in plaats van het script aan te passen.

**`Found ~/.bashrc but no ~/.bash_profile`**
Onschuldig. Git Bash maakt de ontbrekende `~/.bash_profile` zelf aan en laadt
daarmee je `~/.bashrc` alsnog in. Sluit het venster en open het opnieuw.

---

## Dagelijks gebruik hierna

**Werk ophalen** dat in de dev-map op InterServer is gemaakt (daar werkt Claude):

```bash
git pull
```

Zijn er nieuwe dependencies of migraties, draai dan:

```bash
npm ci && npm run db:migrate
```

**Eigen werk terugsturen:** committen en `git push` naar `main`. De laptop en de
dev-map op InterServer zijn gelijkwaardig; `origin/main` is de enige plek waar ze
elkaar tegenkomen. Trek altijd eerst op vóór je begint, anders krijg je een merge
die je niet nodig had.

**Live zetten doet de laptop niet.** Deployen gebeurt op InterServer, in de
productiemap, volgens `infra/DEPLOY.md`. Een `git push` alleen verandert niets aan
de live site.

**Weten waar je zit:**

```bash
npm run db:omgeving
```

Toont database, `APP_ENV`, de marker op de database en of die twee met elkaar
kloppen. Draai dit als je twijfelt vóór een db-commando.

**Meekijken met wat er op InterServer draait.** De dev-server (3300) en
test-server (3200) staan daar niet open op internet. Tunnel ze naar je laptop:

```bash
ssh -L 3300:localhost:3300 -L 3200:localhost:3200 amresh@162.35.176.40
```

Laat dat venster open staan en open dan `http://localhost:3300` in je browser hier.

**De route van bug naar live** — wat je doet als je iets vindt of wil wijzigen —
staat in `docs/WERKWIJZE.md`. Lees die één keer door: het belangrijkste verschil
met vroeger is dat een `git push` niets live zet.

Zie verder `docs/TESTDB.md` voor het werken met de test-database, en `docs/PLAN.md`
voor de scope en het datamodel.
