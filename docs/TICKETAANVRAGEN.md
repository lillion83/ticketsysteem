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
| 6   | Publieke pagina + bevestigingspagina bezoeker      | ✅             |
| 7   | `payments/`-map met alleen de handmatige provider  | ✅ (vervroegd) |
| 8   | Opruimen: re-exports weg, `afgewezen` uitfaseren   | ✅             |

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

`src/server/reserveringen.ts` re-exporteerde de oude namen één release als brug.
Dat bestand is in stap 8 verwijderd; importeer uit `#/server/ticketaanvragen`.

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

## 6. Publieke pagina + bevestigingspagina

`getPublicEvent` levert er twee velden bij: `verkoopActief` en `betaalmethoden`.
Bij `verkoopActief === false` verdwijnen op `events.$eventId.tsx` zowel het
ticketblok als de prijs en de knop in de rechter rail — flyer en informatie
blijven staan.

De knop heet **Koop ticket** zodra de bezoeker zelf een bedrag kan overmaken
(bank, en straks online), en **Ticket aanvragen** als het bij WhatsApp of contant
blijft; dan begint het met een gesprek. Eén helper, `ticketKnopLabel`.

Het formulier heeft een extra veld "Hoe wil je betalen?" — een voorkeur, geen
betaling. Het verschijnt alleen als de organisator methoden heeft aangezet, en
landt in `reserveringen.betaalmethode`.

Na verzenden geen inline "bedankt" meer: `createTicketaanvraag` geeft het id
terug en de bezoeker gaat naar **`/aanvraag/$aanvraagId`**. Dat uuid is de
sleutel, zoals de ticketcode dat is in `t.$code`; `getPubliekeAanvraag` is
daarom publiek en org-loos, met dezelfde uitzondering op harde regel 3 als
`publicTicket.ts`. Die functie geeft bewust **niet** het e-mailadres, telefoon-
nummer, de opmerking of de betaalreferentie terug — de link is deelbaar.

De pagina toont status, samenvatting, totaalbedrag en een blok per actieve
betaalmethode. WhatsApp wordt een groene knop via `whatsappLink()` op
`organizations.telefoon`; staat daar niets, dan valt hij terug op de
instructietekst. Bank en contant verwijzen naar diezelfde tekst — het
eventformulier schrijft nog geen `config` per methode, dus rekeningnummers staan
in `betaalinstructies`. De tekst komt via `maakHandmatig(...).start()` uit de
provider-laag, niet rechtstreeks uit het event: daar geeft een echte provider
later een redirect terug.

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

## 8. Opruimen

`src/server/reserveringen.ts` is weg — niets importeerde er nog uit.

`afgewezen` is uitgefaseerd: geen enkele codepad schrijft die status nog,
`annuleerTicketaanvraag` zet `geannuleerd`. De waarde blijft wél in de enum
staan, want Postgres kan een enumwaarde niet droppen zolang oude rijen hem
dragen, en die rijen omzetten is een datamigratie zonder opbrengst. De regel is
daarom: **wie statussen leest, telt `afgewezen` bij `geannuleerd`.** Zo doet de
admin het al, en sinds deze stap ook het dashboard.

Het dashboard telde alleen `afgewezen` en zag nieuwe annuleringen dus helemaal
niet meer. `EventDashboardData.reserveringen` heet nu `ticketaanvragen` en telt
zes statussen apart. De trechter gaat van Ticketaanvragen → Betaling ontvangen →
Tickets verzonden → Ingecheckt, er is een KPI "Wacht op betaling" in de fase vóór
het event, en de inzichtregels benoemen betaling in plaats van "verwerking".

Het woord "reservering" komt nu nergens meer in de UI voor. In de code staat het
alleen nog waar het een DB-naam spiegelt: de tabel `reserveringen` en het oude
verkoopkanaal `'reservering'`.

**Nog open, buiten dit migratieplan:** niets zet een aanvraag ooit op `verlopen`.
`vervalt_op` wordt gevuld en de bevestigingspagina toont de datum, maar er is geen
taak die de status omzet. Dat vraagt een cron of een check bij het lezen — een
eigen beslissing, geen opruimwerk.

## Wat expliciet niet gebeurt

- Geen rename van de tabel `reserveringen`.
- Geen wijziging aan `tickets`, `scans`, `scanner_sessions`, `ticket_types`.
- Geen nieuwe dependency, geen state-library, geen ander designsysteem.
- Geen online betaling — alleen de aansluiting ervoor.
