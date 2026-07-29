# Projectplan — E-ticketsysteem met QR en deurscanner

**Versie 1.2 — fase 1 (A–F) afgerond; tweede reeks G–K afgerond**

Secties 1 t/m 9 beschrijven fase 1 zoals oorspronkelijk gepland en gebouwd: één
evenement, handmatige verkoop, offline-first scanner. Die fundering staat en is
niet veranderd. **Sectie 10 beschrijft de tweede reeks fases (G t/m K)**, die
daar bovenop is gebouwd: de publieke discovery-kant, koper- en
organisator-accounts en rollen. Lees bij twijfel over de huidige stand sectie 10
— niet sectie 1, die is een momentopname van het begin.

---

## 1. Uitgangspunten

| Onderwerp | Keuze |
|---|---|
| Scope fase 1 | Eén evenement, één organisator, handmatige verkoop |
| Betaalmodel | Amresh koopt in bij organisator (contant), verkoopt door voor eigen rekening |
| Verkoper | Alleen Amresh. Organisator-uitgifte komt in fase 2 |
| Omvang | Onder de 200 tickets per event |
| Multi-tenancy | Wordt nu al ingebouwd (`organization_id` overal), maar niet gebruikt |
| Scanner | PWA, offline-first, camera-API |
| Deurcontrole | Alleen scannen, geen naamcontrole |
| Re-entry | Configureerbaar per event, standaard uit |
| Ticketlevering | WhatsApp én mail, beide via een link naar een ticketpagina |
| Annulering | Buiten het systeem afgehandeld; wel een knop om één ticket in te trekken |

**Wat expliciet buiten scope is in fase 1:** online betaling, publieke verkooppagina, self-service onboarding van organisatoren, ledger/uitbetalingen, refundflow, native app.

Deze zijn bewust uitgesteld, niet vergeten. Het datamodel blokkeert ze niet.

> **Inmiddels achterhaald:** de publieke verkooppagina (als *reserveringspagina*,
> zonder betaling) en de self-service onboarding van organisatoren zijn in de
> tweede reeks wél gebouwd — zie sectie 10, fases G en H. Online betaling,
> ledger, uitbetalingen, refunds en een native app blijven buiten scope (harde
> regel 6).

---

## 2. Technische stack

Zelfde fundering als Webwinkri, om herbruik te maximaliseren:

- **Framework:** TanStack Start
- **Database:** PostgreSQL + Drizzle ORM
- **Auth:** Better Auth (organization plugin, ook al is er één org)
- **Hosting:** VPS (InterServer), Caddy + PM2
- **Mail:** Resend (transactioneel, geen campagne)
- **Scanner:** PWA in dezelfde app, aparte route

Bewuste keuze: alles in één codebase, één deploy. Geen aparte scanner-repo.

---

## 3. Architectuurbeslissingen

### 3.1 Ticketcode = UUID + HMAC

De QR bevat één string: `{ticket_id}.{signature}`. De signature is een HMAC-SHA256 over `event_id + ticket_id`, afgekapt tot ~16 tekens, met een servergeheim.

**Waarom:** de scanner kan offline vaststellen dat een QR echt door ons systeem is uitgegeven, zónder database. Een zelfgemaakte QR wordt direct geweigerd. Pas daarna wordt de gebruikt-status gecheckt.

Geen oplopende nummers. Geen persoonsgegevens in de QR.

### 3.2 De scan is atomair, de database beslist

```sql
UPDATE tickets SET gebruikt_op = now(), gebruikt_door = $2
WHERE code = $1 AND gebruikt_op IS NULL
RETURNING *;
```

Rij terug → groen. Geen rij → rood, en dan pas ophalen wanneer/waar hij al gescand is. Nooit eerst lezen en dan schrijven.

### 3.3 Offline-first — vereenvoudigd door de kleine omvang

Onder de 200 tickets is de complete lijst ongeveer 15 kB. Dat verandert het ontwerp wezenlijk:

- **Geen IndexedDB.** De lijst past in het geheugen, met `localStorage` als backup bij een herstart van de browser.
- **Geen delta-sync.** Elke sync haalt gewoon de hele lijst opnieuw op. Simpeler en er is geen enkele reden om moeilijk te doen.
- **Geen paginering, geen streaming.** Eén request.

**Tijdens het scannen:**
1. Verifieer HMAC lokaal → vervalst? direct rood, klaar.
2. Check de lokale lijst → al gebruikt? rood met tijdstip.
3. Markeer lokaal als gebruikt, toon groen.
4. Zet de scan in een uploadqueue in `localStorage`.

**Queue:** elke scan krijgt een client-side UUID. De server accepteert dezelfde scan-UUID meerdere keren zonder dubbel te tellen (idempotent). Een mislukte upload is dus nooit een probleem — gewoon opnieuw sturen.

**Conflictafhandeling:** komt een scan binnen voor een ticket dat de server al als gebruikt kent, dan wint de vroegste tijdstempel en wordt het conflict gelogd. Niet stilzwijgend negeren.

### 3.4 Meerdere scanners

Binnenlocatie met minder dan 200 man, dus in de praktijk één deur. Het ontwerp kan er meer aan:

- Elke scanner heeft een eigen `scanner_sessie` met label ("Ingang", "VIP").
- Bij netwerk: volledige sync elke 10 seconden. Scanners zien elkaars scans vrijwel direct.
- Zonder netwerk: doorgeven van een ticket tussen twee deuren is theoretisch mogelijk. Geaccepteerd risico, wordt zichtbaar in het conflictlog.

### 3.5 Scannertoegang zonder accounts

Deurpersoneel krijgt geen gebruikersaccount. In de admin: "Scanner koppelen" → QR of 6-cijferige code → personeel scant die met hun eigen telefoon. Ze krijgen een token dat:

- alleen geldig is voor dat ene event,
- automatisch vervalt 6 uur na de eindtijd,
- op elk moment ingetrokken kan worden.

### 3.6 Levering: één ticketpagina voor beide kanalen

Belangrijk praktisch punt: **een `wa.me`-link kan alleen tekst versturen, geen afbeelding.** Daarom niet de QR zelf versturen, maar een link naar een ticketpagina:

```
https://[domein]/t/{ticket_id}.{signature}
```

Die pagina toont de QR groot, met naam, event, datum en tickettype eronder. Werkt identiek voor WhatsApp en mail, de koper kan hem altijd heropenen, en bij een correctie hoef je niets opnieuw te versturen.

De mail bevat dezelfde link plus de QR als afbeelding, zodat mensen die hun mail offline lezen ook binnenkomen. (De mail liep eerst via Brevo, sinds `8eabc7c` via Resend — zie sectie 2.)

De pagina is beveiligd door de HMAC in de URL — niet te raden, geen login nodig.

---

## 4. Datamodel

```
organizations
  id, naam, contactpersoon, telefoon, aangemaakt_op

events
  id, organization_id, naam, datum_start, datum_eind, locatie,
  re_entry_toegestaan (bool, default false), status, aangemaakt_op

ticket_types
  id, event_id, organization_id, naam, prijs_srd,
  inkoopprijs_srd, aantal_beschikbaar, aantal_verkocht

tickets
  id, event_id, ticket_type_id, organization_id,
  code (unique), koper_naam, koper_telefoon, koper_email,
  verkocht_op, verkocht_door_user_id, verkoopkanaal,
  geleverd_via, geleverd_op,
  gebruikt_op, gebruikt_door, ingetrokken_op, ingetrokken_reden

scans
  id, ticket_id, event_id, scanner_sessie_id,
  tijdstip_client, tijdstip_server, resultaat, client_scan_uuid (unique)

scanner_sessions
  id, event_id, organization_id, token_hash, label,
  vervalt_op, ingetrokken_op, laatste_sync
```

**Aandachtspunten:**

- `organization_id` staat overal, ook waar het via een join afleidbaar is. Dat maakt scoping en RLS in fase 2 triviaal.
- `verkocht_door_user_id` is een verwijzing naar een gebruiker, geen vrije tekst. Nu ben jij dat altijd; straks kan de organisator het zijn zonder migratie.
- `inkoopprijs_srd` erbij, zodat je je eigen marge kunt zien. Dat is nu je verdienmodel.
- `ingetrokken_op` maakt annuleren van één ticket mogelijk zonder rijen te verwijderen. Terugbetaling regel je buiten het systeem.
- `resultaat` in scans: `groen`, `rood_al_gebruikt`, `rood_ongeldig`, `rood_ingetrokken`, `rood_verkeerd_event`, `groen_re_entry`.
- Twee tijdstempels bij scans: wat de telefoon dacht en wanneer de server het ontving. Bij offline lopen die uren uiteen.

---

## 5. Bouwfasen met checkpoints

### Fase A — Fundering (halve dag)
Schema in Drizzle, migraties, seed met één organisatie en één testevent.

*Checkpoint:* migratie draait schoon op de VPS, testdata zichtbaar via `psql`.

### Fase B — Ticketuitgifte (1,5 dag)
Admin: event aanmaken, tickettypes instellen, ticket uitgeven (naam, telefoon, mail, type → knop "verkocht"). Verkooplijst met zoeken. Ticket intrekken. HMAC-generatie.

*Checkpoint:* 10 tickets uitgeven, codes uniek, HMAC verifieert, lijst klopt, intrekken werkt.

### Fase C — Ticketpagina en levering (1 dag)
Publieke ticketpagina op `/t/{code}`, QR-generatie, Brevo-mailtemplate, WhatsApp-knop die een voorgevulde tekst met link opent.

*Checkpoint:* ticket naar je eigen nummer én mailadres sturen, beide openen de pagina, QR leesbaar met een willekeurige scanner-app.

### Fase D — Scanner online (1 dag)
PWA-route, camera-API, scan-endpoint met de atomaire update, groen/rood-scherm met geluid en trilling.

*Checkpoint:* eigen ticket scannen → groen. Nogmaals → rood met tijdstip. Willekeurige QR → rood ongeldig. Ingetrokken ticket → rood.

### Fase E — Scanner offline (1 dag)
Volledige lijst pre-download, `localStorage`, lokale HMAC-verificatie, uploadqueue, sync-indicator in de UI.

*Checkpoint:* vliegtuigmodus aan, 20 tickets scannen inclusief duplicaten, vliegtuigmodus uit → alle scans komen door, geen dubbeltellingen.

### Fase F — Deurbeheer en rapportage (1 dag)
Scanner-sessies koppelen en intrekken, live teller (binnen / verkocht), scanlog met filter, export naar Excel.

*Checkpoint:* twee telefoons tegelijk, beide zichtbaar in de admin, teller klopt.

**Totaal: 5,5 tot 6 werkdagen.** Met tegenslag: ruim een week.

De kleine omvang scheelt een dag op de offline-laag; de ticketpagina kost er een halve terug.

---

## 6. Risico's

| Risico | Impact | Aanpak |
|---|---|---|
| Camera-API werkt niet op een oude Android bij de deur | Hoog | Testen op het échte toestel, minimaal een week vooraf. Fallback: code handmatig intypen. |
| Telefoon leeg tijdens het event | Hoog | Powerbank verplicht. Tweede toestel gereed met dezelfde sessie. |
| Doorgestuurde QR (één ticket, vijf vrienden) | Middel | Eerste scan wint. Geen naamcontrole aan de deur, dus dit is puur een first-come-first-served regel. Zet kopersnaam wél op de ticketpagina als afschrikking. |
| Ticketlijst niet gesynct vóór aanvang | Hoog | Scanner toont groot "laatste sync: X min geleden". Weigert te starten bij >2 uur oud. |
| Bezoeker claimt niet binnen te zijn geweest | Middel | Volledig scanlog met tijdstip en ingang. Discussie is feitelijk te beslechten. |
| Koper heeft geen internet bij de deur en kan de ticketpagina niet openen | Middel | Mail bevat de QR óók als afbeelding. Instructie bij verkoop: screenshot maken. |
| Conflict bij twee scanners offline | Laag | Geaccepteerd. Zichtbaar in conflictlog. |

---

## 7. Testplan vóór het echte event

Niet overslaan. Een uur oefenen bespaart een avond paniek.

1. **Droogtest thuis:** 50 testtickets, alle scenario's uit de checkpoints.
2. **Locatietest:** ter plekke, mét het toestel dat aan de deur gebruikt wordt. Netwerk checken, licht bij de ingang checken (QR op een telefoonscherm leest slecht bij fel licht of in het donker).
3. **Generale:** vijf mensen door de deur laten lopen alsof het echt is. Meet hoe lang één scan duurt. Boven de 5 seconden krijg je een rij.
4. **Uitwijkplan op papier:** geprinte deelnemerslijst als alles faalt. Kost vijf minuten en je hebt hem hopelijk nooit nodig.

---

## 8. Genomen beslissingen

| Vraag | Besluit | Gevolg voor de bouw |
|---|---|---|
| Wie verkoopt? | Nu alleen Amresh, later ook de organisator | `verkocht_door_user_id` als referentie, geen vrije tekst |
| Hoeveel tickets? | Onder de 200 | Geen IndexedDB, geen delta-sync, volledige lijst per keer |
| Levering? | WhatsApp én mail | Eén ticketpagina met signed URL voor beide kanalen |
| Naamcontrole aan de deur? | Nee, alleen scannen | Scanner toont alleen groen/rood; geen ID-veld in de scanner-UI |
| Annulering? | Buiten het systeem | Alleen een "intrekken"-knop per ticket, geen refundlogica |

---

## 9. Wat dit plan later mogelijk maakt

Zonder herbouw, alleen uitbreiding:

- **Organisator geeft zelf tickets uit** → Better Auth-rollen binnen de organisatie, admin-schermen scopen op `organization_id`. Datamodel verandert niet.
- **Meerdere organisatoren** → `organization_id` staat er al, alleen scoping en onboarding erbij.
- **Meer dan 200 tickets** → offline-laag omzetten naar IndexedDB met delta-sync. Geïsoleerde wijziging in de scanner.
- **Publieke verkooppagina** → nieuwe route, ticketmodel identiek.
- **Online betaling** → laag bovenop de ticketuitgifte, raakt de scanner niet.
- **Genummerde plaatsen** → extra tabel, `tickets` krijgt een verwijzing.

Wat een herbouw zou vereisen en dus nú goed moet: het codeformaat (HMAC), de atomaire scan, `organization_id` overal, en `verkocht_door` als user-referentie.

---

## 10. Tweede reeks: fases G t/m K (publieke kant, accounts en rollen)

Na fase F is een tweede reeks fases gebouwd die in losse sessies is bedacht en
niet in de oorspronkelijke planning stond. Dit is de inhaalslag: wat er is, en
waarom.

**De rode draad:** fase 1 had één verkoper (Amresh) en één organisator. Deze
reeks maakt er een platform van waar bezoekers events vinden en reserveren,
kopers hun tickets in een account terugvinden, en organisatoren zichzelf
aanmelden — zonder dat er ook maar één betaling in het systeem komt. Harde regel
6 staat overeind: reserveren is een *aanvraag*, de uitgifte blijft handmatig.

**Twee dingen om te weten voordat je hierin duikt:**

- **De letters zeggen niets over de bouwvolgorde.** Er is gebouwd in de volgorde
  G → I → K → H → J. Waar een fase op een latere leunt, staat dat hieronder.
- **De discovery-front-end kwam vóór fase G.** De publieke homepage,
  events-overzicht, event-detailpagina en de 3-staps organiseer-flow zijn
  gebouwd in `d4402ab` t/m `405c737`, als losse voorbereiding zonder faseletter.
  Fase G en I bouwen daarop verder. Zonder die commits hangen G en I in de lucht.

### Fase G — Reserveringsbrug (`4ad483e`)

Publiek reserveren aan de voorkant, handmatige uitgifte aan de achterkant. Een
bezoeker vraagt op de event-detailpagina een ticket aan (tickettype, aantal,
contactgegevens); de organisator ziet de aanvraag in de admin en verwerkt hem
met de bestaande uitgifte-flow uit fase B tot een echt ticket, of wijst hem af.

- **Schema (migratie 0005):** tabel `reserveringen` + enum
  `reservering_status` (`nieuw` / `afgehandeld` / `afgewezen`), org-gescoopt.
- **Server:** `src/server/reserveringen.ts`. `createReservering` is publiek
  (geen sessie — dezelfde bewuste uitzondering als `publicTicket.ts`);
  `listReserveringen`, `verwerkReservering` en `afwijzenReservering` zijn
  auth-gescoopt. Verwerken boekt de voorraad atomair op en geeft de tickets uit.

*Checkpoint:* uitgelogd een reservering plaatsen op `/events/{id}` → verschijnt
in de admin onder Reserveringen → "Ticket uitgeven" levert een echt ticket met
werkende QR, en de voorraad van het tickettype klopt.

### Fase I — Discovery-stubs echt maken (`b11041e`)

De discovery-front-end had werkende schermen met dode knoppen. Deze fase maakt
ze echt: de zoekbalk op de homepage navigeert naar `/events` met searchparams;
de filters op `/events` werken (datum, prijs-slider, gratis/betaald, sorteren,
paginering van 9 per pagina) en staan allemaal in de URL, dus een gefilterde
lijst is deelbaar. Op de detailpagina: "Bekijk op Kaart" → Google Maps, "Deel" →
Web Share API met clipboard-fallback, "Bewaar" → favoriet in `localStorage`.
"Volgen" is verborgen in plaats van nep.

Ook nieuw: `/mijn-ticket` als opzoeker — code of ticketlink invoeren →
doorsturen naar `/t/{code}`. Fase K bouwt die route later om tot een echt
kopersdashboard; de opzoeker blijft ernaast bestaan voor wie geen account heeft.

*Checkpoint:* filter op `/events` combineren, pagina verversen → dezelfde
resultaten (alles zit in de URL). Een ticketcode in `/mijn-ticket` invoeren
opent de ticketpagina.

### Fase K — Koper-accounts en Mijn Tickets (`761ad87`)

Kopers krijgen een account en zien hun tickets met status terug. Twee
inlogwegen: Google (optioneel, alleen als de env-variabelen gezet zijn) en een
code per e-mail (`emailOTP`). Account-linking op geverifieerd e-mailadres, zodat
beide wegen op dezelfde gebruiker uitkomen.

- **Schema (migratie 0006):** `tickets.koper_user_id` (FK → `user`). Gevuld bij
  uitgifte als het e-mailadres al een account heeft, anders bij de eerste login
  met dat adres — `listMijnTickets` claimt de tickets dan alsnog op het
  geverifieerde e-mailadres.
- **Sessie:** nieuwe `requireUser` — een sessie *zonder* org-eis. Nodig omdat
  kopers geen `organization_id` hebben. Admin en `/events/new` weren
  koper-sessies expliciet.

*Checkpoint:* inloggen met de e-mailcode op `/mijn-ticket` → de tickets die op
dat adres zijn uitgegeven staan er, met de juiste statusbadge (geldig / gebruikt
/ ingetrokken).

### Fase H — Organisator-onboarding (`5fc5010`)

Sluit de keten: een ingelogde koper zonder organisatie kan zich op
`/word-organisator` als organisator registreren, krijgt een eigen
`organization_id`, en daarmee toegang tot de admin en de organiseer-flow. Geen
schemawijziging nodig — `organizations` en `user.organization_id` bestonden al
uit fase A.

Eén tenant per gebruiker: `wordOrganisator()` weigert als je al organisator
bent. De onboarding neemt een `redirect`-parameter, zodat iemand die halverwege
de organiseer-flow strandde daarna terugkomt waar hij was.

*Checkpoint:* als koper `/events/new` openen → je komt op `/word-organisator`,
niet op de homepage. Organisatie aanmaken → je landt terug in de organiseer-flow
en kunt publiceren.

### Fase J — Rolgebaseerd systeem (`182bfb0`)

Drie echte rollen op user-niveau, elk met het juiste dashboard. Dit is de fase
die de andere vier aan elkaar knoopt.

- **Schema (migratie 0007):** enum `gebruiker_rol` + kolom `user.rol`, default
  `koper`.
- **Landing na inloggen:** `homePathForRole` in `src/lib/rol.ts` is de enige bron
  van waarheid — koper → `/mijn-ticket`, organisator → `/admin`, admin →
  `/platform`.
- **Platform-gebied** (`/platform`, alleen admin): dashboard met
  platform-brede KPI's en een events-lijst over alle organisatoren.
- Chart- en KPI-componenten uitgelicht naar `src/components/admin/charts.tsx`,
  gedeeld door het admin- en het platform-dashboard. Handgetekende SVG, geen
  chart-library.

**De uitzondering op harde regel 3, expliciet vastgelegd.** Regel 3 zegt: elke
query filtert op `organization_id`, geen uitzonderingen. Het platform-overzicht
kan dat per definitie niet. Daarom is er precies één cross-org leesweg:
`requireAdmin()` in `src/server/session.ts`. In `63abf3b` is die uitzondering
uitgebreid naar *schrijven* op event-inhoud (`requireContentAccess` in
`src/server/scope.ts`), zodat de admin de inhoud van elk event kan corrigeren:
eventgegevens, tickettypes, sprekers, agenda, FAQ. **Niet** tickets uitgeven,
scannen of reserveringen verwerken namens een organisator — dat blijft van de
organisator zelf. Wie hier iets aan verandert: dit is een afgesproken
uitzondering, geen vrijbrief. Nieuwe cross-org queries erbuiten zijn een bug.

*Checkpoint:* met elk van de drie rollen inloggen → je landt op het juiste
dashboard. Als koper `/admin` proberen → je wordt naar je eigen dashboard
gestuurd. `/profiel` toont je rol.

### Na fase K — losse verbeteringen

Geen faseletters, wel wezenlijke wijzigingen:

- **Admin in de huisstijl** (`36f9749`, `d398b22`, `bd3f077`): de admin-shell,
  het dashboard, de event-detailpagina en Deur & rapportage zijn herstijld en
  lopen op echte data in plaats van placeholders.
- **Event-dashboard per event** (`19da2da`): één scherm per event met tabbladen
  **vóór / tijdens / na**, dat automatisch op de huidige fase opent op basis van
  de datums. Eigen KPI's per fase, plus een Event Health Score en een
  Inzichten-blok. Route:
  `src/routes/admin/events.$eventId_.dashboard.tsx`.
- **Cover-afbeeldingen** (`8e6a4fb` t/m `a6a54d2`): uploaden in plaats van een
  URL invullen, met een door de organisator gekozen focuspunt, een banner die
  zich aan het formaat van de flyer aanpast, en een lightbox voor de volledige
  flyer. Bestanden staan in `uploads/`, buiten de build-output, zodat een deploy
  ze niet raakt.
- **Mijn Tickets herzien** (`b725148`): tickets gegroepeerd per event, met een
  detailpagina per event.
- **Test-omgeving** (`0a693e3`): aparte test-database `ticketsysteem_test` op
  poort 3200, met eigen env en migratie-/seedscripts. Zie `docs/TESTDB.md` en de
  droogtest-checklist in `docs/TESTPLAN-CHECKLIST.md`.

### Wat deze reeks openlaat

- **Betalen blijft handmatig.** Reserveren is een aanvraag; iemand moet hem
  verwerken. Dat is een bewuste keuze, geen ontbrekende feature.
- **De organization-plugin van Better Auth is nog niet in gebruik.** De tenant
  zit als `additionalField` op de user (`user.organization_id`). Eén organisatie
  per gebruiker, geen teams, geen leden. Voldoende voor nu; de plugin staat klaar
  voor het moment dat een organisatie meerdere medewerkers krijgt.
- **Rollen zijn platform-breed, niet per organisatie.** Je bent koper,
  organisator óf admin — niet "organisator bij deze org en koper bij die".
