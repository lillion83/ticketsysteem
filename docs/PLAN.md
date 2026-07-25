# Projectplan — E-ticketsysteem met QR en deurscanner

**Versie 1.1 — fase 1: één evenement, binnenlocatie, max. 200 tickets, offline-first scanner**

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

De mail via Brevo bevat dezelfde link plus de QR als afbeelding, zodat mensen die hun mail offline lezen ook binnenkomen.

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
