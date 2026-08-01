# Van "reserveringen" naar "ticketaanvragen"

UX-herziening zonder rewrite, in acht los deploybare stappen. Het volledige
ontwerp staat in het Claude Design-project _Ticketverkoop mobiele schermen_
(`Ticketverkoop UX.dc.html`), met de onderbouwing in `Migratieplan.md` en
`UX Audit Eventformulier.md` daarnaast. Dit bestand is de stand van zaken in
de repo.

## Wat blijft ongemoeid

Ticketcode + HMAC, QR-generatie, mail-delivery, WhatsApp-tekst, de scanner met
offline sync, Mijn Tickets en de publieke ticketpagina. De tabellen `tickets`,
`ticket_types`, `scans` en `scanner_sessions` veranderen niet.

**De tabel blijft `reserveringen` heten.** Alleen de UI-taal is gewijzigd. Een
rename over twaalf migraties en alle bestaande queries is een risico dat niets
oplevert.

## Terminologie

| Nooit meer in de UI      | Wel                                             |
| ------------------------ | ----------------------------------------------- |
| Reservering / Reserveren | Ticketaanvraag / Ticket aanvragen / Koop ticket |
| Verwerken                | Betaling ontvangen & ticket sturen              |
| Ticket uitgeven          | Direct ticket verkopen                          |
| Leverkanaal              | Stuur ticket via                                |
| Afgewezen                | Geannuleerd                                     |

Interne namen (de tabel `reserveringen`, het type `Leverkanaal`) blijven staan.

## Status

| #   | Stap                                               | Status         |
| --- | -------------------------------------------------- | -------------- |
| 1   | Migratie `0012_ticketaanvragen`                    | ✅             |
| 2   | `src/lib/verkoopkanaal.ts` + chipgroep             | ✅             |
| 3   | Serverlaag splitsen (`ticketaanvragen.ts`)         | ✅             |
| 4   | Admin-UI: tabs, badges, detailpaneel               | ✅             |
| 5   | Eventformulier: promokaart, ja/nee, betaalmethoden | ✅             |
| 6   | Publieke pagina + bevestigingspagina bezoeker      | openstaand     |
| 7   | `payments/`-map met alleen de handmatige provider  | ✅ (vervroegd) |
| 8   | Opruimen: re-exports weg, `afgewezen` uitfaseren   | openstaand     |

Het flyer-uploadscherm dat titel, datum en locatie automatisch uitleest (stap 0
van het ontwerp) staat bewust **buiten scope**: dat vraagt een vision-model en
een nieuwe dependency, en wordt apart besproken.

## 1. Migratie 0012

- `events.verkoop_actief` (default `true`) — `false` betekent: publieke
  eventpagina zonder ticketmodule.
- `events.betaalinstructies` — vrije tekst voor de bezoeker.
- Nieuwe tabel `event_betaalmethoden` met enum `betaalmethode_soort`
  (`whatsapp` | `bank` | `contant` | `online`). Aparte tabel in plaats van een
  enum-array, zodat Uni5Pay/Mope er later bij kunnen zonder enum-migratie en
  elke methode eigen config kan dragen. `organization_id` staat erop.
- `reservering_status` uitgebreid met `betaald`, `geannuleerd`, `verlopen`
  (`ALTER TYPE … ADD VALUE`, geen tabel-rewrite, geen datamigratie).
- `reserveringen` krijgt `betaald_op`, `betaalmethode`, `betaalreferentie`,
  `vervalt_op`.

Mapping oud → nieuw; bestaande rijen blijven geldig zonder UPDATE:

| DB-waarde     | UI-label                     |
| ------------- | ---------------------------- |
| `nieuw`       | Wacht op betaling            |
| `betaald`     | Betaald — klaar om te sturen |
| `afgehandeld` | Ticket verzonden / Afgerond  |
| `afgewezen`   | Geannuleerd (historisch)     |
| `geannuleerd` | Geannuleerd                  |
| `verlopen`    | Verlopen                     |

## 3. De kernwijziging: `verwerkReservering` gesplitst

De oude functie deed drie dingen tegelijk. In `src/server/ticketaanvragen.ts`:

```
markeerBetaald(id, { betaalmethode, betaalreferentie })
  status 'nieuw' → 'betaald', betaald_op = now()
  geen ticketcreatie, geen voorraadmutatie

genereerTickets(id)              // alleen vanaf status 'betaald'
  voorraad atomair ophogen (ongewijzigde SQL)
  tickets inserten (ongewijzigde signTicket-logica)
  status → 'afgehandeld'

betaalEnVerstuur(id)             // beide; wat de hoofdknop aanroept
```

De transactie zit ongewijzigd in `genereerTicketsIntern`; alleen de
statuscontrole verschilt. De voorraadbewaking
(`aantal_verkocht + n <= aantal_beschikbaar`) is intact — geen rij terug is
uitverkocht.

`src/server/reserveringen.ts` re-exporteert de oude namen nog één release, zodat
een gemiste importplek niet stilletjes breekt. Weg in stap 8.

### `ticketsVoorAanvraag` is een benadering

`tickets` heeft geen `reservering_id` — die kolom toevoegen zou de ticket-tabel
raken, en die blijft ongemoeid. De koppeling loopt daarom via event, tickettype,
koper en een verkoopkanaal dat op een online aanvraag wijst. Twee aanvragen van
dezelfde persoon voor hetzelfde tickettype vallen samen. Goed genoeg om
leverknoppen bij te tonen, **nooit** om iets op te muteren.

## 5. Eventformulier

Stap 2 van `src/routes/events.new.tsx` heet nu "Tickets verkopen" en begint met
de vraag óf de organisator digitaal wil verkopen — niet met een tier-editor. De
promokaart erboven benoemt expliciet dat hij zijn manier van geld ontvangen niet
hoeft te veranderen; dat is de drempel, niet de QR-code.

Bij "nee" verdwijnen tier-editor, betaalmethoden en instructies, en gaat er een
lege `tiers`-array mee. De server dwingt dat ook af in `parseFullEventInput`.

De tier-kaart toont nog drie velden: naam, prijs, aantal. Beschrijving,
kenmerken en vroegboekkorting zitten achter `<details>` "Meer opties".
`updateTier` en `addTier` zijn ongewijzigd.

Het formulier schrijft `verkoop_actief`, `betaalinstructies` en rijen in
`event_betaalmethoden`. `soort = 'online'` biedt het niet aan: die rij staat
uitgeschakeld in beeld als "Uni5Pay & Mope — binnenkort".

## 7. `payments/` — aansluiting, geen betaling

Harde regel 6 staat overeind: er is geen bedragberekening, geen ledger, geen
refund en geen online betaling. Er is één provider, `handmatig`, en die verwerkt
niets — hij geeft de instructietekst terug. Het geld gaat buiten het systeem om;
de organisator drukt in de admin op "Betaling ontvangen".

De interface bestaat zodat een echte provider later één bestand in
`src/server/payments/` is in plaats van een verbouwing van de aanvraagketen. Zo'n
provider zou dezelfde keten aanroepen als de handmatige knop:

```
verifieerWebhook(req)
  → markeerBetaald(aanvraagId, { betaalmethode, betaalreferentie })
  → genereerTickets(aanvraagId)
  → verstuurTickets(ids, 'mail')
```

Er is bewust nog **geen** webhookroute. Die komt pas als er een provider is.

## Wat expliciet niet gebeurt

- Geen rename van de tabel `reserveringen`.
- Geen wijziging aan `tickets`, `scans`, `scanner_sessions`, `ticket_types`.
- Geen nieuwe dependency, geen state-library, geen ander designsysteem.
- Geen online betaling — alleen de aansluiting ervoor.
